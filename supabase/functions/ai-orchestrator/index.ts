// =====================================================================
// ai-orchestrator — the only place the AI provider key exists.
//
// Flow:
//   1. Authenticate caller (JWT) and verify conversation membership.
//   2. Rate limit (ai_invocations_per_min).
//   3. Pre-moderation on the triggering user message (fail closed).
//   4. Build context window from recent conversation history.
//   5. Stream from Anthropic Messages API -> SSE to client, while
//      progressively updating a placeholder AI message row (status
//      'streaming') so other group members see the same stream via
//      postgres_changes.
//   6. Post-moderation on the completed output (fail closed -> row
//      becomes status 'blocked' and the text is redacted).
//   7. Log tokens/latency to ai_usage_log.
// =====================================================================
import { preflight, corsHeaders, json } from "../_shared/cors.ts";
import { requireUser, adminClient, HttpError } from "../_shared/supabase.ts";
import { enforceRateLimit } from "../_shared/ratelimit.ts";
import { moderate, logModeration } from "../_shared/moderation.ts";

const MODEL = Deno.env.get("AI_MODEL") ?? "claude-sonnet-4-20250514";
const MAX_TOKENS = Number(Deno.env.get("AI_MAX_TOKENS") ?? 2048);
const HISTORY_LIMIT = Number(Deno.env.get("AI_HISTORY_LIMIT") ?? 30);
const API_KEY = Deno.env.get("AI_PROVIDER_API_KEY")!;

const BLOCKED_TEXT =
  "_This response was withheld by the safety filter._";

/**
 * §8 training-pipeline hook. Only ever invoked when EVERY participant in
 * the conversation has `training_opt_in = true`; the caller computes that
 * and defaults to false. No-op unless TRAINING_PIPELINE_URL is configured,
 * so the default deployment never routes anything.
 */
async function routeToTrainingPipeline(payload: {
  conversation_id: string;
  message_id: string;
}): Promise<void> {
  const url = Deno.env.get("TRAINING_PIPELINE_URL");
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("TRAINING_PIPELINE_TOKEN") ?? ""}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Never fail a user-facing response because the training sink is down.
  }
}

interface Body {
  conversation_id: string;
  /** id of the human message that triggered this invocation */
  trigger_message_id?: string;
  /** regenerate: the AI message being replaced */
  supersedes_id?: string;
}

function systemPrompt(opts: {
  isGroup: boolean;
  roomName: string | null;
  topic: string | null;
  members: string[];
}) {
  const base = [
    "You are the AI assistant embedded in a chat product.",
    "Respond in GitHub-flavored Markdown. Be concise and concrete; prefer short paragraphs and lists over walls of text.",
    "Never claim to have taken real-world actions you cannot take.",
    "If you are unsure, say so plainly rather than inventing details.",
  ];

  if (opts.isGroup) {
    base.push(
      "",
      "GROUP CONTEXT:",
      `You are one participant in a multi-person room${opts.roomName ? ` called "${opts.roomName}"` : ""}.`,
      opts.topic ? `The room topic is: ${opts.topic}` : "",
      `Current members: ${opts.members.join(", ") || "unknown"}.`,
      "Messages are labelled with their author. Address people by name when replying to them specifically.",
      "Do not summarise the whole conversation unless asked. Answer the most recent request; stay out of the way otherwise.",
    );
  }
  return base.filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const admin = adminClient();
  let aiMessageId: string | null = null;

  try {
    const { user } = await requireUser(req);
    const body = (await req.json()) as Body;
    const conversationId = body.conversation_id;
    if (!conversationId) throw new HttpError(400, "conversation_id_required");

    // --- 1. membership check -------------------------------------------------
    const { data: membership } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!membership) throw new HttpError(403, "not_a_member");

    const { data: conversation } = await admin
      .from("conversations")
      .select("id, type, name, topic, ai_mode")
      .eq("id", conversationId)
      .single();
    if (!conversation) throw new HttpError(404, "conversation_not_found");
    if (conversation.ai_mode === "off") throw new HttpError(409, "ai_disabled_for_room");

    // --- 2. rate limit -------------------------------------------------------
    await enforceRateLimit(admin, user.id, "ai_invocations_per_min");

    // --- 2b. §8: training-pipeline gate --------------------------------------
    // Default OFF is a hard requirement. Routing to any training pipeline
    // requires EVERY participant to have opted in — one hold-out disables it
    // for the whole conversation. A missing/failed read is treated as opted OUT.
    const { data: memberIds } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);

    const { data: optInRows } = await admin
      .from("profiles")
      .select("id, training_opt_in")
      .in("id", (memberIds ?? []).map((m) => m.user_id));

    const participantCount = (memberIds ?? []).length;
    const trainingAllowed =
      participantCount > 0 &&
      (optInRows ?? []).length === participantCount &&
      (optInRows ?? []).every((p) => p.training_opt_in === true);

    // --- 3. history ----------------------------------------------------------
    const { data: history } = await admin
      .from("messages")
      .select("id, sender_id, sender_type, content, status, created_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .in("status", ["sent"])
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    const ordered = (history ?? []).slice().reverse();

    // resolve display names for group labelling
    const humanIds = [...new Set(ordered.filter((m) => m.sender_id).map((m) => m.sender_id!))];
    const { data: profiles } = humanIds.length
      ? await admin.from("profiles").select("id, display_name").in("id", humanIds)
      : { data: [] as Array<{ id: string; display_name: string }> };
    const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));

    const { data: memberRows } = await admin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", conversationId);
    const { data: memberProfiles } = await admin
      .from("profiles")
      .select("display_name")
      .in("id", (memberRows ?? []).map((m) => m.user_id));

    const isGroup = conversation.type === "group";

    // --- 4. pre-moderation ---------------------------------------------------
    const trigger =
      ordered.find((m) => m.id === body.trigger_message_id) ??
      [...ordered].reverse().find((m) => m.sender_type === "human");

    if (trigger) {
      const pre = await moderate(trigger.content);
      if (pre.verdict !== "pass") {
        await logModeration(admin, trigger.id, "pre", pre);
        await admin.from("messages").update({ status: "blocked" }).eq("id", trigger.id);
        throw new HttpError(422, "input_blocked", pre.reason);
      }
      await logModeration(admin, trigger.id, "pre", pre);
    }

    // --- 5. placeholder AI row (visible to the whole room immediately) -------
    const { data: placeholder, error: phErr } = await admin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: null,
        sender_type: "ai",
        content: "",
        status: "streaming",
        supersedes_id: body.supersedes_id ?? null,
      })
      .select("id")
      .single();
    const placeholderId: unknown = placeholder?.id;
    if (phErr || typeof placeholderId !== "string" || placeholderId.length === 0) {
      // Fail closed: never proceed without a real message id from the DB.
      // (Also pins the type — the untyped client returns `id: any`, which
      // would otherwise leak `string | null` into the streaming closure.)
      throw new HttpError(500, "placeholder_failed", phErr?.message);
    }
    aiMessageId = placeholderId;

    if (body.supersedes_id) {
      await admin.from("messages").update({ status: "superseded" }).eq("id", body.supersedes_id);
    }

    // --- 6. build provider messages -----------------------------------------
    const providerMessages = ordered
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.sender_type === "ai" ? ("assistant" as const) : ("user" as const),
        content:
          m.sender_type === "ai" || !isGroup
            ? m.content
            : `${nameById.get(m.sender_id!) ?? "Someone"}: ${m.content}`,
      }));

    // Anthropic requires the first message to be from `user`.
    while (providerMessages.length && providerMessages[0].role === "assistant") {
      providerMessages.shift();
    }
    if (providerMessages.length === 0) {
      providerMessages.push({ role: "user", content: "Say hello and offer to help." });
    }

    const started = Date.now();
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        stream: true,
        system: systemPrompt({
          isGroup,
          roomName: conversation.name,
          topic: conversation.topic,
          members: (memberProfiles ?? []).map((p) => p.display_name),
        }),
        messages: providerMessages,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      // Log upstream detail server-side (function logs) but never return it:
      // provider error bodies can echo request headers, and the request
      // headers carry the provider key.
      const detail = await upstream.text().catch(() => "");
      console.error("ai-orchestrator: provider_error", upstream.status, detail.slice(0, 500));
      await admin
        .from("messages")
        .update({ content: "_The assistant is unavailable right now._", status: "error" })
        .eq("id", aiMessageId);
      throw new HttpError(502, "provider_error", "The model provider rejected the request.");
    }

    // --- 7. stream to client + persist progressively -------------------------
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const msgId = aiMessageId;

    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) =>
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

        send("start", { message_id: msgId });

        let full = "";
        let inTok = 0;
        let outTok = 0;
        let buffer = "";
        let lastPersist = 0;

        const persist = async (final = false) => {
          const now = Date.now();
          if (!final && now - lastPersist < 400) return;
          lastPersist = now;
          await admin.from("messages").update({ content: full }).eq("id", msgId);
        };

        try {
          const reader = upstream.body!.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const chunks = buffer.split("\n\n");
            buffer = chunks.pop() ?? "";

            for (const chunk of chunks) {
              const line = chunk.split("\n").find((l) => l.startsWith("data: "));
              if (!line) continue;
              const payload = line.slice(6);
              if (payload === "[DONE]") continue;

              let evt: Record<string, unknown>;
              try {
                evt = JSON.parse(payload);
              } catch {
                continue;
              }

              if (evt.type === "content_block_delta") {
                const delta = evt.delta as { text?: string } | undefined;
                if (delta?.text) {
                  full += delta.text;
                  send("delta", { text: delta.text });
                  await persist();
                }
              } else if (evt.type === "message_start") {
                const usage = (evt.message as { usage?: { input_tokens?: number } })?.usage;
                inTok = usage?.input_tokens ?? 0;
              } else if (evt.type === "message_delta") {
                const usage = evt.usage as { output_tokens?: number } | undefined;
                outTok = usage?.output_tokens ?? outTok;
              }
            }
          }

          // --- 8. post-moderation (fail closed) ---------------------------
          const post = await moderate(full);
          await logModeration(admin, msgId, "post", post);

          if (post.verdict !== "pass") {
            await admin
              .from("messages")
              .update({ content: BLOCKED_TEXT, status: "blocked" })
              .eq("id", msgId);
            send("blocked", { reason: post.reason ?? "policy" });
          } else {
            full = full.trim();
            await admin
              .from("messages")
              .update({ content: full, status: "sent" })
              .eq("id", msgId);
            send("done", { message_id: msgId, content: full });
          }

          await admin.from("ai_usage_log").insert({
            conversation_id: conversationId,
            message_id: msgId,
            model: MODEL,
            input_tokens: inTok,
            output_tokens: outTok,
            latency_ms: Date.now() - started,
          });

          // §8: training-pipeline routing is gated on unanimous opt-in.
          // `trainingAllowed` is false unless every member set it true.
          if (trainingAllowed) {
            await routeToTrainingPipeline({
              conversation_id: conversationId,
              message_id: msgId,
            });
          }
        } catch (err) {
          await admin
            .from("messages")
            .update({
              content: full || "_The response was interrupted._",
              status: full ? "sent" : "error",
            })
            .eq("id", msgId);
          send("error", { message: String(err).slice(0, 300) });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders(req.headers.get("origin")),
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    if (aiMessageId) {
      await admin
        .from("messages")
        .update({ content: "_The assistant could not respond._", status: "error" })
        .eq("id", aiMessageId);
    }
    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    // Unexpected failures stay opaque to the caller — internal messages leak
    // schema, urls and identifiers. They go to the function logs instead.
    console.error("ai-orchestrator: internal_error", e);
    return json(req, { error: "internal_error", detail: null }, 500);
  }
});
