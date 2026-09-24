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
import { AttachmentChip } from "./attachment-chip";
import { CitationList } from "./citation-list";
import type { Message, Profile, Reaction } from "@/lib/types";
import type { ReadReceipt } from "@/lib/read-receipts";
import { readReceiptLabel } from "@/lib/read-receipts";
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
  readReceipt?: ReadReceipt | null;
  onReact: (messageId: string, emoji: string) => void;
  onEdit: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
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
  readReceipt,
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
    if (v && v !== message.content) onEdit(message.id, v);
    setEditing(false);
  };

  const name = isAi ? "Confluence AI" : (author?.display_name ?? (isOwn ? "You" : "Unknown"));
  const isDirectOwn = !isGroup && isOwn && !isAi;

  return (
    <motion.div
      layout="position"
      variants={messageIn}
      initial="hidden"
      animate="show"
      transition={SPRING}
      id={`msg-${message.id}`}
      className={cn(
        "group relative flex gap-3 transition-colors duration-[--dur-fast]",
        showHeader ? "mt-4" : "mt-1",
        isDirectOwn ? "justify-end" : "justify-start",
        highlighted && "bg-[--accent-subtle] rounded-[--r-md] px-2 py-1",
      )}
    >
      {/* For left-aligned messages, show gutter with avatar or hover timestamp */}
      {!isDirectOwn && (
        <div className="w-8 shrink-0">
          {showHeader ? (
            isAi ? (
              <AiAvatar size="sm" status={streaming ? "responding" : "normal"} />
            ) : (
              <Avatar name={name} url={author?.avatar_url} size="sm" />
            )
          ) : (
            <span className="mt-1 hidden text-[11px] tabular-nums text-[--text-muted] opacity-0 transition-opacity duration-[--dur-micro] group-hover:opacity-100 sm:block">
              {clockTime(message.created_at)}
            </span>
          )}
        </div>
      )}

      <div className={cn("min-w-0", isDirectOwn ? "max-w-[80%]" : "flex-1")}>
        {/* Header row for human room messages and AI messages */}
        {showHeader && !isDirectOwn && (
          <div className="mb-1 flex items-baseline gap-2">
            <span
              className={cn(
                "text-[13px] font-medium",
                isAi
                  ? "text-[--ai]"
                  : isOwn
                    ? "text-[--accent-text] bg-[--accent-subtle] px-1.5 py-0.5 rounded-[--r-xs]"
                    : "text-[--text-primary]",
              )}
            >
              {name}
            </span>
            {isAi && <AiPill />}
            {isGroup && !isAi && !isOwn && author?.display_name && (
              <span className="text-[11px] text-[--text-muted]">member</span>
            )}
            <span className="text-[11.5px] tabular-nums text-[--text-muted]">
              {clockTime(message.created_at)}
            </span>
            {message.edited_at && (
              <span className="text-[11px] text-[--text-muted]">(edited)</span>
            )}
          </div>
        )}

        {/* message body */}
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
              className="border-[--border] bg-[--surface-input] text-[--text-primary]"
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
          <div className="flex items-start gap-2.5 rounded-[--r-md] border border-[--warning]/30 bg-[--warning]/10 px-3.5 py-2.5 text-[13px] text-[--warning] shadow-[--shadow-1]">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              This message wasn&apos;t sent. It may break the room&apos;s safety rules. Edit it and try again.
            </span>
          </div>
        ) : errored ? (
          <div className="flex items-start gap-2.5 rounded-[--r-md] border border-[--error]/30 bg-[--error]/10 px-3.5 py-2.5 text-[13px] text-[--error] shadow-[--shadow-1]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{message.content || "The assistant couldn't respond. Try again."}</span>
          </div>
        ) : isAi ? (
          /* AI Message: Section 24 full-width document surface with 2px left rule */
          <div
            className={cn(
              "border-l-2 pl-3.5 py-1 text-[15.5px] leading-[1.7] text-[--text-primary] transition-colors duration-[--dur-fast]",
              streaming
                ? "border-[--ai-live] ai-streaming-rule"
                : "border-[--ai]/60",
            )}
          >
            <Markdown content={message.content} />
            {streaming && (
              <span className="streaming-caret inline-block w-0.5 h-4 ml-0.5 align-middle bg-[--ai-live]" />
            )}
            {!streaming && <CitationList citations={message.citations} />}
          </div>
        ) : isDirectOwn ? (
          /* Direct chat user message: Section 24 right-aligned soft surface --surface-elevated, radius 16, 6px tail corner */
          <div className="rounded-[16px] rounded-br-[6px] border border-[--border-subtle] bg-[--surface-elevated] px-4 py-2.5 text-[15.5px] leading-[1.6] text-[--text-primary] shadow-[--shadow-1]">
            <Markdown content={message.content} />
            <div className="mt-1 flex justify-end">
              <span className="text-[10.5px] tabular-nums text-[--text-muted]">
                {clockTime(message.created_at)}
              </span>
            </div>
          </div>
        ) : (
          /* Group room human message: Section 24 compact row style */
          <div className="text-[15px] leading-[1.6] text-[--text-primary]">
            <Markdown content={message.content} />
          </div>
        )}

        {/* attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {message.attachments.map((a) => (
              <AttachmentChip key={a.id} attachment={a} />
            ))}
          </div>
        )}

        {/* read receipt */}
        {readReceipt && (
          <div className="mt-1 flex items-center gap-1 pl-1" aria-live="polite">
            <Check className="h-3 w-3 text-[--info]" aria-hidden />
            <span className="text-[11px] text-[--text-muted]">
              {readReceiptLabel(readReceipt) || "Sent"}
            </span>
          </div>
        )}

        {/* reactions: Section 24 24px pills */}
        {grouped.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            <AnimatePresence initial={false}>
              {grouped.map(([emoji, info]) => (
                <motion.button
                  key={emoji}
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  whileTap={{ scale: 0.94 }}
                  transition={SPRING}
                  onClick={() => onReact(message.id, emoji)}
                  className={cn(
                    "flex h-6 items-center gap-1 rounded-full border px-2 text-[12px] transition-colors duration-[--dur-fast]",
                    info.mine
                      ? "border-[--accent] bg-[--accent-subtle] text-[--accent-text]"
                      : "border-[--border-subtle] bg-[--surface] text-[--text-secondary] hover:border-[--border-strong] hover:bg-[--surface-hover]",
                  )}
                >
                  <span>{emoji}</span>
                  <span className="tabular-nums font-medium text-[11px]">{info.count}</span>
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
            "absolute -top-3.5 right-2 flex items-center gap-0.5 rounded-[10px] border border-[--border]",
            "bg-[--surface-elevated] p-0.5 opacity-0 shadow-[--shadow-2] transition-opacity duration-[--dur-fast]",
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
                    className="absolute right-0 top-8 z-20 flex gap-0.5 rounded-[--r-md] border border-[--border] bg-[--surface-elevated] p-1 shadow-[--shadow-3]"
                  >
                    {QUICK_EMOJI.map((e) => (
                      <motion.button
                        key={e}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.94 }}
                        transition={SPRING}
                        onClick={() => {
                          onReact(message.id, e);
                          setPickerOpen(false);
                        }}
                        className="grid h-7 w-7 place-items-center rounded-[--r-sm] text-[15px] hover:bg-[--surface-hover]"
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
            <IconAction
              label="Regenerate"
              onClick={() => onRegenerate(message.id)}
              icon={RefreshCw}
            />
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
              <IconAction label="Delete" onClick={() => onDelete(message.id)} icon={Trash2} danger />
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
      whileTap={{ scale: 0.92 }}
      transition={tEnter(0.12)}
      className={cn(
        "grid h-6 w-6 place-items-center rounded-[--r-xs] transition-colors duration-[--dur-fast]",
        danger
          ? "text-[--text-muted] hover:bg-[--error]/10 hover:text-[--error]"
          : accent
            ? "text-[--success]"
            : "text-[--text-muted] hover:bg-[--surface-hover] hover:text-[--text-primary]",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </motion.button>
  );
}