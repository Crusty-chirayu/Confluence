"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Paperclip, ShieldAlert, Sparkles, Square, X } from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { classifyLocal, MAX_MESSAGE_LENGTH } from "@/lib/data/moderation-local";
import type { ConversationMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatFileSize, validateAttachmentFile } from "@/lib/attachments";
import { popover, SPRING, tEnter, tExit } from "@/lib/motion";

/** The mention popup's listbox id, referenced by the combobox. */
const MENTION_LISTBOX_ID = "composer-mention-listbox";
const MENTION_OPTION_PREFIX = "composer-mention-option-";
const mentionOptionId = (index: number) => `${MENTION_OPTION_PREFIX}${index}`;

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
  onSend: (text: string, files: File[]) => void;
  onStop: () => void;
  onTyping?: () => void;
}) {
  const [value, setValue] = React.useState("");
  const [mentionQuery, setMentionQuery] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState(0);
  const [files, setFiles] = React.useState<File[]>([]);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const ref = React.useRef<HTMLTextAreaElement>(null);

  const verdict = React.useMemo(() => classifyLocal(value), [value]);
  const tooLong = value.length > MAX_MESSAGE_LENGTH;
  const canSend =
    value.trim().length > 0 &&
    verdict.verdict === "pass" &&
    !disabled &&
    fileError === null;

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

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFileError(null);
    for (const file of Array.from(list)) {
      const v = validateAttachmentFile(file);
      if (!v.ok) {
        setFileError(v.error);
        continue;
      }
      setFiles((prev) => (prev.some((f) => f.name + f.size === file.name + file.size) ? prev : [...prev, file]));
    }
  };

  const send = () => {
    if (!canSend) return;
    onSend(value.trim(), files);
    setValue("");
    setFiles([]);
    setFileError(null);
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

  // The popup is "open" for ARIA purposes only while it has options — an
  // `aria-expanded="true"` with nothing to expand to is worse than false.
  const mentionOpen = mentionQuery !== null && options.length > 0;

  const willInvokeAi =
    aiMode === "auto" || (aiMode === "mention_only" && /@ai\b/i.test(value));

  return (
    <div className="relative border-t border-[--border] bg-[--bg] px-3 pb-3 pt-2 sm:px-4 sm:pb-4">
      {/*
        moderation pre-warning.
        The live region is rendered unconditionally and only its contents
        change: a `role="status"` node inserted *with* its text already in
        it is missed by some screen readers, so the container has to be in
        the DOM before the warning appears.
      */}
      <div role="status" aria-live="polite" className="empty:hidden">
        <AnimatePresence initial={false}>
          {verdict.verdict !== "pass" && (
            <motion.div
              initial={{ opacity: 0, y: 6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: tExit() }}
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
      </div>

      {/* pending attachments */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, transition: tExit() }}
            transition={tEnter(0.16)}
            className="mb-2 flex flex-wrap gap-1.5 overflow-hidden"
          >
            {files.map((f, i) => (
              <span
                key={`${f.name}-${f.size}-${i}`}
                className="flex max-w-[15rem] items-center gap-1.5 rounded-full border border-[--border] bg-[--surface] py-1 pl-2.5 pr-1 text-[12px] font-medium text-[--fg]"
              >
                <Paperclip className="h-3 w-3 text-[--fg-muted]" />
                <span className="truncate">{f.name}</span>
                <span className="shrink-0 text-[10.5px] text-[--fg-subtle]">{formatFileSize(f.size)}</span>
                <button
                  type="button"
                  aria-label={`Remove ${f.name}`}
                  onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[--fg-subtle] transition-colors hover:bg-[--bg-active] hover:text-[--fg]"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Same reasoning as the warning above: the region exists first. */}
      <div role="alert" className="empty:hidden">
        {fileError && <p className="mb-2 text-[12px] font-medium text-[--danger]">{fileError}</p>}
      </div>

      <div
        className={cn(
          "flex items-end gap-2 rounded-[--r-lg] border bg-[--surface] px-3 py-2 shadow-[--e1]",
          "transition-[border-color,box-shadow] duration-[--d-micro]",
          "focus-within:border-[--accent] focus-within:ring-4 focus-within:ring-[--accent]/12",
          verdict.verdict !== "pass" ? "border-[--warning]/50" : "border-[--border]",
        )}
      >
        {/*
          WAI-ARIA combobox (ARIA 1.2). The role lives on the wrapper, not on
          the textarea: `role="combobox"` is only defined for text *inputs*,
          and axe flags it on a <textarea>. A combobox owns its textbox and,
          when expanded, its listbox — hence both live inside this element.

          Without this a screen-reader user gets no indication that @mention
          suggestions exist, and the highlighted one is never announced
          (WCAG 4.1.2).
        */}
        <div
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={mentionOpen}
          // Only set while the popup exists: an aria-controls pointing at an
          // id that is not in the DOM is itself a validity error.
          aria-controls={mentionOpen ? MENTION_LISTBOX_ID : undefined}
          aria-label="Message"
          className="relative min-w-0 flex-1"
        >
          <textarea
            ref={ref}
            rows={1}
            value={value}
            disabled={disabled}
            data-testid="composer-input"
            aria-autocomplete="list"
            aria-activedescendant={
              mentionOpen && options[cursor] ? mentionOptionId(cursor) : undefined
            }
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
            className="max-h-[200px] min-h-[24px] w-full resize-none bg-transparent py-1 text-[14px] leading-relaxed text-[--fg] outline-none placeholder:text-[--fg-subtle] disabled:opacity-60"
          />

          {/* @mention autocomplete — scales+fades up from the input */}
          <AnimatePresence>
            {mentionOpen && (
              <motion.div
                id={MENTION_LISTBOX_ID}
                role="listbox"
                aria-label="Mention suggestions"
                variants={popover}
                initial="hidden"
                animate="show"
                exit="exit"
                style={{ transformOrigin: "bottom left" }}
                className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,100%)] overflow-hidden rounded-[--r-md] border border-[--border] bg-[--surface-raised] shadow-[--e3]"
              >
                {options.map((o, i) => (
                  <button
                    key={o.id}
                    id={mentionOptionId(i)}
                    role="option"
                    aria-selected={i === cursor}
                    // The options are driven with the arrow keys from the
                    // textarea (aria-activedescendant); a stray Tab would
                    // move focus out of the popup and desync the cursor.
                    tabIndex={-1}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => applyMention(o)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-[--d-micro]",
                      i === cursor ? "bg-[--bg-hover]" : "hover:bg-[--bg-hover]",
                    )}
                  >
                    {o.isAi ? (
                      <AiAvatar size="xs" />
                    ) : (
                      <Avatar name={o.sub} url={o.avatarUrl} size="xs" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">@{o.label}</span>
                      <span className="block truncate text-[11.5px] text-[--fg-muted]">
                        {o.sub}
                      </span>
                    </span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* attach a file (private, member-scoped) */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          data-testid="attachment-input"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          aria-label="Attach a file"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] text-[--fg-muted] transition-colors hover:bg-[--bg-active] hover:text-[--fg] disabled:opacity-60"
        >
          <Paperclip className="h-4 w-4" />
        </button>

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
              className="flex shrink-0 items-center gap-1 text-[11px] font-medium text-[--accent-text]"
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
