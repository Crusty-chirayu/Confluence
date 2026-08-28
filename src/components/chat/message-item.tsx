"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Copy,
  Pencil,
  RefreshCw,
  ShieldAlert,
  SmilePlus,
  Trash2,
  X,
} from "lucide-react";
import { Avatar, AiAvatar, AiPill } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Markdown } from "./markdown";
import type { Message, Profile, Reaction } from "@/lib/types";
import { cn, clockTime } from "@/lib/utils";
import { messageIn, popIn, popover, SPRING, tEnter } from "@/lib/motion";

const QUICK_EMOJI = ["👍", "🎉", "❤️", "😂", "🤔", "👀"];

export interface MessageItemProps {
  message: Message;
  author: Profile | null;
  isOwn: boolean;
  isGroup: boolean;
  showHeader: boolean;
  streaming: boolean;
  reactions: Reaction[];
  currentUserId: string;
  highlighted?: boolean;
  canRegenerate: boolean;
  onReact: (emoji: string) => void;
  onEdit: (content: string) => void;
  onDelete: () => void;
  onRegenerate: () => void;
}

export const MessageItem = React.memo(function MessageItem({
  message,
  author,
  isOwn,
  isGroup,
  showHeader,
  streaming,
  reactions,
  currentUserId,
  highlighted,
  canRegenerate,
  onReact,
  onEdit,
  onDelete,
  onRegenerate,
}: MessageItemProps) {
  const [copied, setCopied] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(message.content);
  const [pickerOpen, setPickerOpen] = React.useState(false);

  const isAi = message.sender_type === "ai";
  const blocked = message.status === "blocked";
  const errored = message.status === "error";

  const grouped = React.useMemo(() => {
    const map = new Map<string, { count: number; mine: boolean }>();
    for (const r of reactions) {
      const cur = map.get(r.emoji) ?? { count: 0, mine: false };
      cur.count += 1;
      if (r.user_id === currentUserId) cur.mine = true;
      map.set(r.emoji, cur);
    }
    return [...map.entries()];
  }, [reactions, currentUserId]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  const saveEdit = () => {
    const v = draft.trim();
    if (v && v !== message.content) onEdit(v);
    setEditing(false);
  };

  const name = isAi ? "Assistant" : (author?.display_name ?? (isOwn ? "You" : "Unknown"));

  return (
    <motion.div
      layout="position"
      variants={messageIn}
      initial="hidden"
      animate="show"
      transition={SPRING}
      id={`msg-${message.id}`}
      className={cn(
        "group relative flex gap-3 rounded-[--r-md] px-2 py-1.5 transition-colors duration-[--d-standard]",
        showHeader ? "mt-4" : "mt-0.5",
        highlighted && "bg-[--accent-subtle]",
      )}
    >
      {/* gutter: avatar or hover timestamp */}
      <div className="w-8 shrink-0">
        {showHeader ? (
          isAi ? (
            <AiAvatar size="sm" />
          ) : (
            <Avatar name={name} url={author?.avatar_url} size="sm" />
          )
        ) : (
          <span className="mt-1 hidden text-[10px] tabular-nums text-[--fg-subtle] opacity-0 transition-opacity duration-[--d-micro] group-hover:opacity-100 sm:block">
            {clockTime(message.created_at)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        {showHeader && (
          <div className="mb-0.5 flex items-baseline gap-2">
            <span
              className={cn(
                "text-[13px] font-semibold",
                isAi ? "text-[--ai-accent]" : "text-[--fg]",
              )}
            >
              {name}
            </span>
            {isAi && (
              <AiPill />
            )}
            {isGroup && !isAi && isOwn && (
              <span className="text-[10.5px] text-[--fg-subtle]">you</span>
            )}
            <span className="text-[11px] tabular-nums text-[--fg-subtle]">
              {clockTime(message.created_at)}
            </span>
            {message.edited_at && (
              <span className="text-[10.5px] text-[--fg-subtle]">(edited)</span>
            )}
          </div>
        )}

        {/* body */}
        {editing ? (
          <div className="space-y-2 py-1">
            <Textarea
              value={draft}
              rows={Math.min(12, draft.split("\n").length + 1)}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) saveEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={saveEdit}>
                <Check className="h-3.5 w-3.5" />
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </Button>
            </div>
          </div>
        ) : blocked ? (
          <div className="flex items-start gap-2 rounded-[--r-md] border border-[--warning]/30 bg-[--warning-subtle] px-3 py-2.5 text-[13px] text-[--warning]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Withheld by the safety filter.</strong> This content
              didn&apos;t pass moderation, so it wasn&apos;t published to the room.
            </span>
          </div>
        ) : errored ? (
          <div className="flex items-start gap-2 rounded-[--r-md] border border-[--danger]/30 bg-[--danger-subtle] px-3 py-2.5 text-[13px] text-[--danger]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.content || "The assistant couldn't respond."}</span>
          </div>
        ) : (
          /* §2.2/§2.5: real bubbles — a background container carries the
             sender identity. AI = teal, own = brand accent, others = neutral. */
          <div
            className={cn(
              "inline-block max-w-full rounded-[--r-lg] px-3 py-2 text-[14px] leading-5",
              message.status === "superseded" && "opacity-45",
              isAi
                ? "bg-[--bubble-ai-bg] text-[--bubble-ai-fg]"
                : isOwn
                  ? "bg-[--bubble-user-bg] text-[--bubble-user-fg]"
                  : "bg-[--bubble-other-bg] text-[--bubble-other-fg]",
            )}
          >
            <Markdown content={message.content} />
            {/* streaming caret — the reveal IS the animation; no per-token effects */}
            {streaming && message.content.length === 0 ? (
              <span className="inline-flex items-center gap-1 py-1">
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="typing-dot h-1.5 w-1.5 rounded-full"
                    style={{ animationDelay: `${d * 140}ms` }}
                  />
                ))}
              </span>
            ) : streaming ? (
              <span className="stream-caret" />
            ) : null}
          </div>
        )}

        {/* reactions */}
        {grouped.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <AnimatePresence initial={false}>
              {grouped.map(([emoji, info]) => (
                <motion.button
                  key={emoji}
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  onClick={() => onReact(emoji)}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] transition-colors duration-[--d-micro]",
                    info.mine
                      ? "border-[--accent] bg-[--accent-subtle] text-[--accent-text]"
                      : "border-[--border] bg-[--surface] text-[--fg-muted] hover:border-[--border-strong]",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="tabular-nums font-medium">{info.count}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* hover actions — opacity fade only, no layout shift */}
      {!editing && !streaming && (
        <div
          className={cn(
            "absolute -top-3 right-2 flex items-center gap-0.5 rounded-[--r-md] border border-[--border]",
            "bg-[--surface-raised] p-0.5 opacity-0 shadow-[--e2] transition-opacity duration-[--d-micro]",
            "group-hover:opacity-100 focus-within:opacity-100",
          )}
        >
          <div className="relative">
            <IconAction
              label="Add reaction"
              onClick={() => setPickerOpen((o) => !o)}
              icon={SmilePlus}
            />
            <AnimatePresence>
              {pickerOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setPickerOpen(false)} />
                  <motion.div
                    variants={popover}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    className="absolute right-0 top-9 z-20 flex gap-0.5 rounded-[--r-md] border border-[--border] bg-[--surface-raised] p-1 shadow-[--e3]"
                  >
                    {QUICK_EMOJI.map((e) => (
                      <motion.button
                        key={e}
                        whileHover={{ scale: 1.22 }}
                        whileTap={{ scale: 0.92 }}
                        transition={SPRING}
                        onClick={() => {
                          onReact(e);
                          setPickerOpen(false);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-[--r-sm] text-[15px] hover:bg-[--bg-hover]"
                      >
                        {e}
                      </motion.button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <IconAction
            label={copied ? "Copied" : "Copy"}
            onClick={copy}
            icon={copied ? Check : Copy}
            accent={copied}
          />

          {isAi && canRegenerate && (
            <IconAction label="Regenerate" onClick={onRegenerate} icon={RefreshCw} />
          )}

          {isOwn && !isAi && (
            <>
              <IconAction
                label="Edit"
                onClick={() => {
                  setDraft(message.content);
                  setEditing(true);
                }}
                icon={Pencil}
              />
              <IconAction label="Delete" onClick={onDelete} icon={Trash2} danger />
            </>
          )}
        </div>
      )}
    </motion.div>
  );
});

function IconAction({
  label,
  onClick,
  icon: Icon,
  danger,
  accent,
}: {
  label: string;
  onClick: () => void;
  icon: React.ElementType;
  danger?: boolean;
  accent?: boolean;
}) {
  return (
    <motion.button
      onClick={onClick}
      aria-label={label}
      title={label}
      whileTap={{ scale: 0.9 }}
      transition={tEnter(0.12)}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-[--r-sm] transition-colors duration-[--d-micro]",
        danger
          ? "text-[--fg-muted] hover:bg-[--danger-subtle] hover:text-[--danger]"
          : accent
            ? "text-[--success]"
            : "text-[--fg-muted] hover:bg-[--bg-hover] hover:text-[--fg]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </motion.button>
  );
}
