"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Hash, Settings2, Users } from "lucide-react";
import { Composer } from "./composer";
import { MessageItem } from "./message-item";
import { RoomSettingsModal } from "./room-settings-modal";
import { StreamAnnouncer } from "./stream-announcer";
import { AiModeBadge } from "@/components/layout/sidebar";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { MessageListSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useSession } from "@/components/session-provider";
import { useNetworkStatus } from "@/components/network-provider";
import { AppDataContext } from "@/app/app/app-data";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import {
  deleteMessage,
  editMessage,
  invokeAi,
  listMembers,
  listMessages,
  listReactions,
  markRead,
  sendMessage,
  toggleReaction,
  uploadAttachment,
  type AiHandle,
} from "@/lib/data/api";
import type { Conversation, ConversationMember, Message, Reaction } from "@/lib/types";
import { conversationTitle, dayLabel, shouldInvokeAi } from "@/lib/utils";
import { computeReadReceipt, type ReadReceipt } from "@/lib/read-receipts";
import { tEnter, tExit } from "@/lib/motion";

/** Shared empty array — a stable identity for MessageItem's memo. */
const EMPTY_REACTIONS: Reaction[] = [];

export function ChatView({ conversation: initial }: { conversation: Conversation }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { profile } = useSession();
  const { refreshConversations } = React.useContext(AppDataContext);
  const { unavailable } = useNetworkStatus();
  const highlightId = params.get("m");

  const [conversation, setConversation] = React.useState(initial);
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [members, setMembers] = React.useState<ConversationMember[]>([]);
  const [reactions, setReactions] = React.useState<Reaction[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [streamingId, setStreamingId] = React.useState<string | null>(null);
  const [streamText, setStreamText] = React.useState("");
  const [typingUsers, setTypingUsers] = React.useState<string[]>([]);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [atBottom, setAtBottom] = React.useState(true);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const aiHandle = React.useRef<AiHandle | null>(null);
  const isGroup = conversation.type === "group";
  const uid = profile?.id ?? "";

  const me = members.find((m) => m.user_id === uid);
  const isAdmin = me?.role === "owner" || me?.role === "admin";

  /* ---------------- load ---------------- */
  const load = React.useCallback(async () => {
    const [msgs, mems, reacts] = await Promise.all([
      listMessages(conversation.id),
      listMembers(conversation.id),
      listReactions(conversation.id),
    ]);
    setMessages(msgs);
    setMembers(mems);
    setReactions(reacts);
    setLoading(false);
  }, [conversation.id]);

  React.useEffect(() => {
    setLoading(true);
    void load();
    void markRead(conversation.id);
  }, [load, conversation.id]);

  React.useEffect(() => setConversation(initial), [initial]);

  /* ---------------- realtime ---------------- */
  React.useEffect(() => {
    if (DEMO_MODE) return demo.subscribe(() => void load());

    const supa = getSupabaseBrowser();
    if (!supa || !profile) return;

    const channel = supa
      .channel(`conv:${conversation.id}`, { config: { presence: { key: uid } } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const row = payload.new as Message;
          setMessages((prev) => {
            if (payload.eventType === "INSERT") {
              return prev.some((m) => m.id === row.id) ? prev : [...prev, row];
            }
            if (payload.eventType === "UPDATE") {
              return prev.map((m) => (m.id === row.id ? { ...m, ...row } : m));
            }
            if (payload.eventType === "DELETE") {
              return prev.filter((m) => m.id !== (payload.old as Message).id);
            }
            return prev;
          });
        },
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reactions" }, () => {
        void listReactions(conversation.id).then(setReactions);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_members" }, () => {
        // Last-read timestamps (read receipts) live here — refresh when they change.
        void listMembers(conversation.id).then(setMembers);
      })
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const { user_id, name } = payload as { user_id: string; name: string };
        if (user_id === profile.id) return;
        setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
        setTimeout(() => setTypingUsers((prev) => prev.filter((n) => n !== name)), 3200);
      })
      .subscribe();

    return () => {
      void supa.removeChannel(channel);
    };
  }, [conversation.id, profile, load]);

  /* ---------------- scroll ---------------- */
  const scrollToBottom = React.useCallback((smooth = true) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? "smooth" : "auto" });
  }, []);

  React.useEffect(() => {
    if (atBottom) scrollToBottom(false);
  }, [messages.length, streamText, atBottom, scrollToBottom]);

  React.useEffect(() => {
    if (!loading && highlightId) {
      const el = document.getElementById(`msg-${highlightId}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [loading, highlightId]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 120);
  };

  /* ---------------- AI ---------------- */
  // Streaming deltas arrive in 1–3-token bursts. Applying each one directly
  // re-renders the whole conversation (including a full markdown re-parse of
  // the growing reply) several times per frame, which under load produces
  // multi-hundred-ms main-thread stalls (§2.7). Buffer the deltas and flush
  // at most once per animation frame so streaming work is frame-aligned.
  const streamBufRef = React.useRef("");
  const streamRafRef = React.useRef<number | null>(null);
  const clearStream = React.useCallback(() => {
    if (streamRafRef.current != null) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    streamBufRef.current = "";
    setStreamText("");
  }, []);
  const onStreamDelta = React.useCallback((chunk: string) => {
    streamBufRef.current += chunk;
    if (streamRafRef.current == null) {
      streamRafRef.current = requestAnimationFrame(() => {
        streamRafRef.current = null;
        setStreamText(streamBufRef.current);
      });
    }
  }, []);

  const runAi = React.useCallback(
    async (prompt: string, triggerId?: string, supersedesId?: string) => {
      clearStream();
      const handle = await invokeAi(
        conversation.id,
        {
          triggerMessageId: triggerId,
          supersedesId,
          isGroup,
          roomName: conversation.name,
          prompt,
        },
        {
          onStart: (id) => {
            setStreamingId(id);
            if (DEMO_MODE) void load();
          },
          onDelta: onStreamDelta,
          onDone: () => {
            setStreamingId(null);
            clearStream();
            void load();
          },
          onBlocked: () => {
            setStreamingId(null);
            clearStream();
            toast.push({
              kind: "warning",
              title: "Response withheld",
              description: "The answer didn't pass moderation.",
            });
            void load();
          },
          onError: (msg) => {
            setStreamingId(null);
            clearStream();
            toast.push({ kind: "error", title: "The assistant failed", description: msg });
            void load();
          },
        },
      );
      aiHandle.current = handle;
    },
    [conversation.id, conversation.name, isGroup, load, toast, clearStream, onStreamDelta],
  );

  const handleSend = async (text: string, files: File[]) => {
    setAtBottom(true);
    // In real (Supabase) mode we must not pretend a message reached the server
    // while the connection is down. Demo mode is localStorage-backed, so a
    // send works offline — but we still tell the user they're offline.
    if (unavailable && !DEMO_MODE) {
      toast.push({
        kind: "warning",
        title: "You're offline",
        description: "Reconnect before sending — your message hasn't been sent yet.",
      });
      return;
    }
    try {
      const msg = await sendMessage(conversation.id, text);
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]));
      // Upload any attached files now that the message row exists.
      for (const file of files) {
        try {
          await uploadAttachment(conversation.id, msg.id, file);
        } catch (e) {
          toast.push({
            kind: "error",
            title: "Couldn't upload attachment",
            description: String(e),
          });
        }
      }
      if (files.length > 0) void load();
      if (shouldInvokeAi(text, conversation.ai_mode)) {
        await runAi(text, msg.id);
      }
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't send", description: String(e) });
    }
  };

  /* -------- stable per-message handlers (keep MessageItem's memo effective
     across streaming re-renders — identity, not value, is what matters) ------- */
  const handleReact = React.useCallback(
    async (messageId: string, emoji: string) => {
      await toggleReaction(messageId, emoji);
      setReactions(await listReactions(conversation.id));
    },
    [conversation.id],
  );
  const handleEditMessage = React.useCallback(
    async (messageId: string, content: string) => {
      await editMessage(messageId, content);
      void load();
    },
    [load],
  );
  const handleDeleteMessage = React.useCallback(
    async (messageId: string) => {
      await deleteMessage(messageId);
      void load();
    },
    [load],
  );
  const handleRegenerateId = React.useCallback(
    async (messageId: string) => {
      const idx = messages.findIndex((m) => m.id === messageId);
      const prompt =
        [...messages.slice(0, idx)].reverse().find((m) => m.sender_type === "human")?.content ?? "";
      setAtBottom(true);
      await runAi(prompt, undefined, messageId);
    },
    [messages, runAi],
  );

  // Group reactions and read receipts per message once, so each MessageItem
  // receives referentially stable props across streaming re-renders.
  const reactionsByMessage = React.useMemo(() => {
    const map = new Map<string, Reaction[]>();
    for (const r of reactions) {
      const arr = map.get(r.message_id);
      if (arr) arr.push(r);
      else map.set(r.message_id, [r]);
    }
    return map;
  }, [reactions]);
  const readReceiptsByMessage = React.useMemo(() => {
    const map = new Map<string, ReadReceipt | null>();
    if (isGroup) {
      for (const m of messages) {
        if (m.sender_type === "human" && m.sender_id === uid) {
          map.set(m.id, computeReadReceipt(m, members, uid));
        }
      }
    }
    return map;
  }, [messages, members, uid, isGroup]);

  const broadcastTyping = React.useRef(0);
  const handleTyping = React.useCallback(() => {
    if (DEMO_MODE || !isGroup || !profile) return;
    const now = Date.now();
    if (now - broadcastTyping.current < 1800) return;
    broadcastTyping.current = now;
    void getSupabaseBrowser()
      ?.channel(`conv:${conversation.id}`)
      .send({
        type: "broadcast",
        event: "typing",
        payload: { user_id: profile.id, name: profile.display_name },
      });
  }, [isGroup, profile, conversation.id]);

  const handleStop = React.useCallback(() => {
    aiHandle.current?.stop();
    aiHandle.current = null;
    setStreamingId(null);
    clearStream();
    void load();
  }, [clearStream, load]);

  /* ---------------- derived ---------------- */
  const profilesById = React.useMemo(() => {
    const map = new Map<string, ConversationMember["profile"]>();
    members.forEach((m) => m.profile && map.set(m.user_id, m.profile));
    return map;
  }, [members]);

  const visible = React.useMemo(
    () => messages.filter((m) => !m.deleted_at && m.status !== "superseded"),
    [messages],
  );

  const title = conversationTitle(conversation);
  const canRegenerate = !streamingId;

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col bg-[--bg-page]">
      {/* ---------- header (Section 23: 56px, --bg-page, bottom hairline, sticky) ---------- */}
      <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-[--border-subtle] bg-[--bg-page] px-4">
        <div className="flex min-w-0 items-center gap-3">
          {isGroup ? (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] border border-[--border-subtle] bg-[--surface] text-[--text-muted]">
              <Hash className="h-4 w-4" />
            </span>
          ) : (
            <AiAvatar size="sm" status={streamingId ? "responding" : "normal"} />
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-medium tracking-[-0.01em] text-[--text-primary]">
                {title}
              </h1>
              {isGroup && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="rounded-[--r-sm] transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]"
                  aria-label="Change AI mode"
                >
                  <AiModeBadge mode={conversation.ai_mode} />
                </button>
              )}
            </div>
            <p className="truncate text-[12px] text-[--text-muted]">
              {isGroup
                ? conversation.topic ||
                  `${members.length} member${members.length === 1 ? "" : "s"}`
                : streamingId
                  ? "Responding…"
                  : "Private AI conversation"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isGroup && (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="hidden items-center -space-x-1.5 rounded-full p-1 transition-opacity hover:opacity-85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] sm:flex"
              aria-label={`${members.length} members`}
            >
              {members.slice(0, 4).map((m) => (
                <Avatar
                  key={m.user_id}
                  name={m.profile?.display_name ?? "?"}
                  url={m.profile?.avatar_url}
                  size="xs"
                  className="ring-2 ring-[--bg-page]"
                />
              ))}
              {members.length > 4 && (
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[--surface] border border-[--border-subtle] text-[10px] font-semibold text-[--text-muted] ring-2 ring-[--bg-page]">
                  +{members.length - 4}
                </span>
              )}
            </button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="press-fluid text-[--text-muted] hover:text-[--text-primary]"
            onClick={() => setSettingsOpen(true)}
            aria-label={isGroup ? "Room settings" : "Conversation settings"}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* ---------- messages ---------- */}
      <div className="relative min-h-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={onScroll}
          className="h-full scroll-smooth overflow-y-auto px-4 pb-6 sm:px-6"
        >
          {loading ? (
            <MessageListSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState isGroup={isGroup} aiMode={conversation.ai_mode} />
          ) : (
            <div
              className="mx-auto max-w-[760px] space-y-4"
              role="log"
              aria-label={isGroup ? `Messages in ${title}` : "Conversation with the assistant"}
            >
              {visible.map((m, i) => {
                const prev = visible[i - 1];
                const newDay =
                  !prev ||
                  new Date(prev.created_at).toDateString() !==
                    new Date(m.created_at).toDateString();
                const showHeader =
                  newDay ||
                  !prev ||
                  prev.sender_id !== m.sender_id ||
                  prev.sender_type !== m.sender_type ||
                  new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() >
                    5 * 60_000;

                const isStreaming = m.id === streamingId;
                const content = isStreaming ? streamText : m.content;

                return (
                  <React.Fragment key={m.id}>
                    {newDay && (
                      <div className="sticky top-2 z-10 my-6 flex justify-center">
                        <span className="rounded-full border border-[--border-subtle] bg-[--surface] px-3 py-1 text-[11px] font-medium tracking-[-0.005em] text-[--text-muted] shadow-[--shadow-1]">
                          {dayLabel(m.created_at)}
                        </span>
                      </div>
                    )}
                    <MessageItem
                      message={isStreaming ? { ...m, content } : m}
                      author={
                        m.sender_id ? (profilesById.get(m.sender_id) ?? null) : null
                      }
                      isOwn={m.sender_id === uid}
                      isGroup={isGroup}
                      showHeader={showHeader}
                      streaming={isStreaming}
                      highlighted={m.id === highlightId}
                      currentUserId={uid}
                      canRegenerate={canRegenerate}
                      reactions={reactionsByMessage.get(m.id) ?? EMPTY_REACTIONS}
                      readReceipt={readReceiptsByMessage.get(m.id) ?? null}
                      onReact={handleReact}
                      onEdit={handleEditMessage}
                      onDelete={handleDeleteMessage}
                      onRegenerate={handleRegenerateId}
                    />
                  </React.Fragment>
                );
              })}

              {/* typing indicator: Section 24, 12px muted, opacity-only dots */}
              <AnimatePresence>
                {typingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, transition: tExit() }}
                    transition={tEnter(0.2)}
                    className="mt-2 flex w-fit items-center gap-2 rounded-full border border-[--border-subtle] bg-[--surface] px-3 py-1.5 shadow-[--shadow-1]"
                  >
                    <div className="flex w-6 justify-center gap-1">
                      {[0, 1, 2].map((d) => (
                        <span
                          key={d}
                          className="h-1.5 w-1.5 rounded-full bg-[--text-muted] animate-pulse"
                          style={{ animationDelay: `${d * 200}ms` }}
                        />
                      ))}
                    </div>
                    <span className="text-[12px] text-[--text-muted]">
                      {typingUsers.slice(0, 2).join(" and ")}
                      {typingUsers.length > 2 ? ` and ${typingUsers.length - 2} more` : ""}{" "}
                      {typingUsers.length === 1 ? "is" : "are"} typing…
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="h-2" />
            </div>
          )}
        </div>

        {/* jump to latest */}
        <AnimatePresence>
          {!atBottom && !loading && (
            <motion.button
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96, transition: tExit() }}
              transition={tEnter(0.2)}
              onClick={() => {
                setAtBottom(true);
                scrollToBottom();
              }}
              className="press-fluid absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-[--border] bg-[--surface-elevated] px-3.5 py-1.5 text-[12.5px] font-medium text-[--text-primary] shadow-[--shadow-2] transition-colors duration-[--dur-fast] hover:bg-[--surface-hover]"
            >
              <ArrowDown className="h-3.5 w-3.5 text-[--accent]" />
              New messages ↓
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* batched aria-live announcements for streamed tokens */}
      <StreamAnnouncer text={streamText} active={Boolean(streamingId)} />

      {/* ---------- composer ---------- */}
      <Composer
        members={members}
        isGroup={isGroup}
        aiMode={conversation.ai_mode}
        streaming={Boolean(streamingId)}
        onSend={handleSend}
        onStop={handleStop}
        onTyping={handleTyping}
      />

      <RoomSettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        conversation={conversation}
        members={members}
        isAdmin={Boolean(isAdmin)}
        currentUserId={uid}
        onChanged={async () => {
          await load();
          router.refresh();
        }}
        onLeft={() => {
          refreshConversations();
          router.push("/app");
        }}
      />
    </div>
  );
}

function EmptyState({ isGroup, aiMode }: { isGroup: boolean; aiMode: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={tEnter(0.3)}
      className="mx-auto flex h-full max-w-md flex-col items-center justify-center px-6 text-center"
    >
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-[--r-lg] border border-[--border-subtle] bg-[--surface] text-[--text-primary] shadow-[--shadow-1]">
        {isGroup ? <Users className="h-5 w-5 text-[--text-muted]" /> : <Logo size={24} />}
      </div>
      <h2 className="text-[17px] font-semibold tracking-[-0.01em] text-[--text-primary]">
        {isGroup ? "This room is quiet" : "What are you working on?"}
      </h2>
      <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-[--text-secondary]">
        {isGroup
          ? aiMode === "off"
            ? "AI is off in this room. Turn it on in room settings."
            : aiMode === "mention_only"
              ? "Say something, or type @ai to ask the AI."
              : "AI follows the conversation and joins in when it can help."
          : "Start a conversation. Ask a question, work through a problem, or explore ideas."}
      </p>
    </motion.div>
  );
}