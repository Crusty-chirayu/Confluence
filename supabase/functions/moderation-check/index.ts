// moderation-check — standalone classifier endpoint.
// Lets the client pre-flight text (e.g. draft warnings) without ever
// touching the AI provider key. Same policy as the orchestrator: fail closed.
import { preflight, json } from "../_shared/cors.ts";
import { requireUser, HttpError } from "../_shared/supabase.ts";
import { moderate } from "../_shared/moderation.ts";

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  try {
    await requireUser(req);
    const { text, stage } = (await req.json()) as { text?: string; stage?: "pre" | "post" };
    if (typeof text !== "string") throw new HttpError(400, "text_required");

    const result = await moderate(text);
    return json(req, {
      stage: stage ?? "pre",
      verdict: result.verdict,
      reason: result.reason ?? null,
      allowed: result.verdict === "pass",
    });
  } catch (e) {
    if (e instanceof HttpError) {
      return json(req, { error: e.code, detail: e.detail ?? null }, e.status);
    }
    return json(req, { error: "internal_error" }, 500);
  }
});
