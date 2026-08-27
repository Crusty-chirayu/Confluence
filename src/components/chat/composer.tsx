"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, ShieldAlert, Sparkles, Square } from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { classifyLocal, MAX_MESSAGE_LENGTH } from "@/lib/data/moderation-local";
import type { ConversationMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { popover, SPRING, tEnter } from "@/lib/motion";

interface MentionOption {
  id: string;
  label: string;
  sub: string;
  isAi: boolean;
  avatarUrl?: string | null;
}

export function Composer({
  members,
  isGroup,
  aiMode,
  streaming,
  disabled,
  onSend,
  onStop,
  onTyping,
}: {
  members: ConversationMember[];
  isGroup: boolean;
  aiMode: string;
  streaming: boolean;
  disabled?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
  onTyping?: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const verdict = React.useMemo(() => classifyLocal(value), [value]);
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend = value.trim().length > 0 && verdict.verdict === "pass" && !disabled;

  const options = React.useMemo<MentionOption[]>(() => {
    const base: MentionOption[] = [];
    if (aiMode !== "off") {
      base.push({ id: "ai", label: "ai", sub: "Bring the assistant into this message", isAi: true });
    }
    if (isGroup) {
      for (const m of members) {
        if (!m.profile) continue;
        base.push({
          id: m.profile.id,
          label: m.profile.display_name.replace(/\s+/g, ""),
          sub: m.profile.display_name,
          isAi: false,
          avatarUrl: m.profile.avatar_url,
        });
      }
    }
    if (mentionQuery === null) return [];
    const q = mentionQuery.toLowerCase();
    return base.filter((o) => o.label.toLowerCase().startsWith(q)).slice(0, 6);
  }, [members, isGroup, aiMode, mentionQuery]);

  // auto-resize (height on a textarea is unavoidable, but it's not animated)
  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  const detectMention = (text: string, caret: number) => {
    const before = text.slice(0, caret);
    const match = /(?:^|\s)@([A-Za-z0-9_-]*)$/.exec(before);
    setMentionQuery(match ? match[1] : null);
    setCursor(0);
  };

  const applyMention = (opt: MentionOption) => {
    const el = ref.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = value.slice(0, caret);
    const after = value.slice(caret);
    const replaced = before.replace(/@([A-Za-z0-9_-]*)$/, `@${opt.label} `);
    const next = replaced + after;
    setValue(next);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      el.focus();
      const pos = replaced.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const send = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue("");
    setMentionQuery(null);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery !== null && options.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => (c + 1) % options.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => (c - 1 + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyMention(options[cursor]);
        return;
      }
      if (e.key === "Escape") {
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const willInvokeAi =
    aiMode === "auto" || (aiMode === "mention_only" && /@ai\b/i.test(value));

  return (
    <div className="relative border-t border-[--border] bg-[--bg] px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      {/* moderation pre-warning */}
      <AnimatePresence initial={false}>
        {verdict.verdict !== "pass" && (
          <motion.div
            initial={{ opacity: 0, y: 6, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
            transition={tEnter()}
            className="mb-2 overflow-hidden"
          >
            <div className="flex items-start gap-2 rounded-[--r-md] border border-[--warning]/30 bg-[--warning-subtle] px-3 py-2 text-[12.5px] text-[--warning]">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                <strong className="font-semibold">{verdict.label}.</strong>{" "}
                {tooLong
                  ? `Trim it to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`
                  : "This won't pass moderation, so it can't be sent."}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* @mention autocomplete — scales+fades from the caret area */}
      <AnimatePresence>
        {mentionQuery !== null && options.length > 0 && (
          <motion.div
            variants={popover}
            initial="hidden"
            animate="show"
            exit="exit"
            style={{ transformOrigin: "bottom left" }}
            className="absolute bottom-full left-3 z-30 mb-2 w-[min(20rem,calc(100%-1.5rem))] overflow-hidden rounded-[--r-md] border border-[--border] bg-[--surface-raised] shadow-[--e3] sm:left-4"
          >
            {options.map((o, i) => (
              <button
                key={o.id}
                onMouseEnter={() => setCursor(i)}
                onClick={() => applyMention(o)}
                className={cn(
                  "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-[--d-micro]",
                  i === cursor ? "bg-[--bg-hover]" : "hover:bg-[--bg-hover]",
                )}
              >
                {o.isAi ? <AiAvatar size="xs" /> : <Avatar name={o.sub} url={o.avatarUrl} size="xs" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">@{o.label}</span>
                  <span className="block truncate text-[11.5px] text-[--fg-muted]">{o.sub}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className={cn(
          "flex items-end gap-2 rounded-[--r-lg] border bg-[--surface] px-3 py-2 shadow-[--e1]",
          "transition-[border-color,box-shadow] duration-[--d-micro]",
          "focus-within:border-[--accent] focus-within:ring-4 focus-within:ring-[--accent]/12",
          verdict.verdict !== "pass" ? "border-[--warning]/50" : "border-[--border]",
        )}
      >
        <textarea
          ref={ref}
          rows={1}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            detectMention(e.target.value, e.target.selectionStart);
            onTyping?.();
          }}
          onKeyDown={onKeyDown}
          onClick={(e) => detectMention(value, e.currentTarget.selectionStart)}
          placeholder={
            disabled
              ? "You can't post in this conversation."
              : isGroup
                ? aiMode === "off"
                  ? "Message the room…"
                  : "Message the room… type @ai to bring in the assistant"
                : "Ask anything…"
          }
          className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-1 text-[14px] leading-relaxed text-[--fg] outline-none placeholder:text-[--fg-subtle] disabled:opacity-60"
        />

        <AnimatePresence mode="wait" initial={false}>
          {streaming ? (
            <motion.button
              key="stop"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={SPRING}
              onClick={onStop}
              aria-label="Stop generating"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] bg-[--bg-active] text-[--fg] transition-colors hover:bg-[--border-strong]"
            >
              <Square className="h-3 w-3 fill-current" />
            </motion.button>
          ) : (
            <motion.button
              key="send"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              whileTap={canSend ? { scale: 0.92 } : undefined}
              transition={SPRING}
              onClick={send}
              disabled={!canSend}
              aria-label="Send message"
              className={cn(
                "grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] transition-colors duration-[--d-micro]",
                canSend
                  ? "bg-[--accent] text-[--accent-fg] hover:bg-[--accent-hover]"
                  : "bg-[--bg-active] text-[--fg-subtle]",
              )}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
        <p className="text-[11px] text-[--fg-subtle]">
          <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
          <kbd className="font-sans font-medium">Shift+Enter</kbd> for a new line
        </p>
        <AnimatePresence>
          {willInvokeAi && value.trim().length > 0 && (
            <motion.span
              initial={{ opacity: 0, x: 4 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={tEnter(0.12)}
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[--accent]"
            >
              <Sparkles className="h-3 w-3" />
              AI will reply
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
