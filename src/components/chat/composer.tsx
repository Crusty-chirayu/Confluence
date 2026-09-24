"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUp, Paperclip, ShieldAlert, Square, X } from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { AiMarkIcon } from "@/components/icons";
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
      base.push({ id: "ai", label: "ai", sub: "Bring Confluence AI into this message", isAi: true });
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

  // auto-resize (height on textarea)
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
    if (e.nativeEvent.isComposing) return;

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

  const mentionOpen = mentionQuery !== null && options.length > 0;
  const willInvokeAi =
    aiMode === "auto" || (aiMode === "mention_only" && /@ai\b/i.test(value));

  const placeholder = disabled
    ? "You cannot post in this conversation."
    : isGroup
      ? aiMode === "off"
        ? "Message the room…"
        : aiMode === "mention_only"
          ? "Message the room · @ai to ask AI…"
          : "Message the room · AI is following along…"
      : "Message Confluence AI…";

  return (
    <div className="relative w-full px-4 pb-4 pt-1 sm:px-6">
      <div className="mx-auto max-w-[760px]">
        {/* moderation pre-warning */}
        <div role="status" aria-live="polite" className="empty:hidden">
          <AnimatePresence initial={false}>
            {verdict.verdict !== "pass" && (
              <motion.div
                initial={{ opacity: 0, y: 4, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, height: 0, transition: tExit() }}
                transition={tEnter()}
                className="mb-2 overflow-hidden"
              >
                <div className="flex items-start gap-2 rounded-[--r-md] border border-[--warning]/30 bg-[--warning]/10 px-3 py-2 text-[12.5px] text-[--warning] shadow-[--shadow-1]">
                  <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <strong className="font-semibold">{verdict.label}.</strong>{" "}
                    {tooLong
                      ? `Trim it to ${MAX_MESSAGE_LENGTH.toLocaleString()} characters or fewer.`
                      : "This message will not pass moderation."}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* pending attachment previews */}
        <AnimatePresence>
          {files.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0, transition: tExit() }}
              transition={tEnter(0.14)}
              className="mb-2 flex flex-wrap gap-2 overflow-hidden"
            >
              {files.map((f, i) => (
                <span
                  key={`${f.name}-${f.size}-${i}`}
                  className="flex max-w-[15rem] items-center gap-1.5 rounded-[--r-sm] border border-[--border-subtle] bg-[--surface-elevated] py-1 pl-2.5 pr-1.5 text-[12px] font-medium text-[--text-primary] shadow-[--shadow-1]"
                >
                  <Paperclip className="h-3 w-3 text-[--text-muted]" />
                  <span className="truncate">{f.name}</span>
                  <span className="shrink-0 text-[10.5px] text-[--text-muted]">
                    {formatFileSize(f.size)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="press-fluid grid h-4 w-4 shrink-0 place-items-center rounded-full text-[--text-muted] hover:bg-[--surface-hover] hover:text-[--text-primary] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <div role="alert" className="empty:hidden">
          {fileError && <p className="mb-2 text-[12px] font-medium text-[--error]">{fileError}</p>}
        </div>

        {/* Section 25 Composer card: radius 12, --surface-input, 1px border, shadow-1 */}
        <div
          className={cn(
            "relative flex flex-col rounded-[--r-lg] border bg-[--surface-input] p-2.5 shadow-[--shadow-1]",
            "transition-[border-color,box-shadow] duration-[--dur-fast]",
            "focus-within:border-[--accent]/60 focus-within:ring-4 focus-within:ring-[--accent-subtle]",
            verdict.verdict !== "pass" ? "border-[--warning]/50" : "border-[--border]",
            disabled && "opacity-60",
          )}
        >
          <div
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={mentionOpen}
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
              placeholder={placeholder}
              className="max-h-[200px] min-h-[36px] w-full resize-none bg-transparent px-1.5 py-1 text-[15px] sm:text-[15.5px] leading-[1.6] text-[--text-primary] outline-none placeholder:text-[--text-muted] disabled:opacity-50"
            />

            {/* @mention autocomplete listbox */}
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
                  className="absolute bottom-full left-0 z-30 mb-2 w-[min(20rem,100%)] overflow-hidden rounded-[--r-md] border border-[--border] bg-[--surface-elevated] shadow-[--shadow-3]"
                >
                  {options.map((o, i) => (
                    <button
                      key={o.id}
                      id={mentionOptionId(i)}
                      role="option"
                      aria-selected={i === cursor}
                      tabIndex={-1}
                      onMouseEnter={() => setCursor(i)}
                      onClick={() => applyMention(o)}
                      className={cn(
                        "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-[--dur-micro]",
                        i === cursor ? "bg-[--surface-hover]" : "hover:bg-[--surface-hover]",
                      )}
                    >
                      {o.isAi ? (
                        <AiAvatar size="xs" />
                      ) : (
                        <Avatar name={o.sub} url={o.avatarUrl} size="xs" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium text-[--text-primary]">
                          @{o.label}
                        </span>
                        <span className="block truncate text-[11.5px] text-[--text-muted]">
                          {o.sub}
                        </span>
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Bottom control row: 32px height */}
          <div className="mt-1 flex items-center justify-between pt-1">
            <div className="flex items-center gap-1.5">
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
                className="press-fluid grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] text-[--text-muted] transition-colors hover:bg-[--surface-hover] hover:text-[--text-primary] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {isGroup && aiMode === "mention_only" && (
                <button
                  type="button"
                  onClick={() => {
                    const el = ref.current;
                    if (!el) return;
                    setValue((v) => (v ? `${v} @ai ` : "@ai "));
                    el.focus();
                  }}
                  className="inline-flex h-7 items-center gap-1 rounded-[--r-xs] border border-[--border-subtle] bg-[--surface] px-2 text-[11px] font-medium text-[--ai] hover:bg-[--ai-subtle] transition-colors"
                  title="Mention Confluence AI"
                >
                  <AiMarkIcon size={12} />
                  <span>@ai</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <AnimatePresence mode="wait" initial={false}>
                {streaming ? (
                  <motion.button
                    key="stop"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING}
                    onClick={onStop}
                    aria-label="Stop generating"
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] bg-[--surface-active] text-[--text-primary] border border-[--border] shadow-[--shadow-1] transition-colors hover:bg-[--surface-hover] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </motion.button>
                ) : (
                  <motion.button
                    key="send"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={canSend ? { scale: 1.04 } : undefined}
                    whileTap={canSend ? { scale: 0.96 } : undefined}
                    transition={SPRING}
                    onClick={send}
                    disabled={!canSend}
                    aria-label="Send message"
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-[--r-md] transition-all duration-[--dur-fast] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]",
                      canSend
                        ? "bg-[--accent] text-white shadow-[--shadow-1] hover:bg-[--accent-hover]"
                        : "bg-[--surface-active] text-[--text-disabled]",
                    )}
                  >
                    <ArrowUp className="h-4 w-4" strokeWidth={2.5} />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Section 25 Hint row */}
        <div className="mt-1.5 flex items-center justify-between gap-3 px-1 text-[11.5px] text-[--text-muted]">
          <p className="hidden sm:inline">
            <kbd className="font-sans font-medium text-[--text-secondary]">↵</kbd> send ·{" "}
            <kbd className="font-sans font-medium text-[--text-secondary]">⇧↵</kbd> newline
          </p>
          <AnimatePresence>
            {willInvokeAi && value.trim().length > 0 && (
              <motion.span
                initial={{ opacity: 0, x: 4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={tEnter(0.12)}
                className="flex items-center gap-1 font-medium text-[--ai]"
              >
                <AiMarkIcon size={12} />
                <span>AI will reply</span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}