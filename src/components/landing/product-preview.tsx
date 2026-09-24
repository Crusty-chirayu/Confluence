"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy, Hash, Paperclip, Send } from "lucide-react";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { AiMarkIcon, AiModeAlwaysIcon, AiModeMentionIcon, AiModeOffIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type DemoMode = "off" | "mention_only" | "auto";

interface DemoMessage {
  id: string;
  sender: string;
  isAi?: boolean;
  text: string;
  time: string;
}

export function ProductPreview() {
  const [mode, setMode] = React.useState<DemoMode>("mention_only");
  const [streamProgress, setStreamProgress] = React.useState(0);
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const aiReply =
    "Launch blockers are cleared. Staging passed with 0 test regressions, and the database migration reversibility was verified. Remaining risk is low (on-call rotation required).";

  React.useEffect(() => {
    setReducedMotion(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // Streaming text animation loop
  React.useEffect(() => {
    if (reducedMotion) {
      setStreamProgress(aiReply.length);
      return;
    }

    let interval: ReturnType<typeof setInterval>;
    let timeout: ReturnType<typeof setTimeout>;

    const cycle = () => {
      setStreamProgress(0);
      timeout = setTimeout(() => {
        let i = 0;
        interval = setInterval(() => {
          i += 3;
          if (i >= aiReply.length) {
            setStreamProgress(aiReply.length);
            clearInterval(interval);
            timeout = setTimeout(cycle, 5000);
          } else {
            setStreamProgress(i);
          }
        }, 50);
      }, 1200);
    };

    cycle();
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [reducedMotion, mode]);

  const displayedAiText = aiReply.slice(0, streamProgress);
  const isStreaming = streamProgress > 0 && streamProgress < aiReply.length;

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div
      className="relative mx-auto w-full max-w-[960px] overflow-hidden rounded-[22px] border border-[--border] bg-[--surface] shadow-[--shadow-4]"
      aria-label="Live product preview of Confluence collaborative room"
      role="region"
    >
      {/* 1px inner top-edge highlight */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
        aria-hidden
      />

      <div className="flex h-[520px] sm:h-[580px]">
        {/* Miniature sidebar rail */}
        <aside className="hidden w-[200px] shrink-0 flex-col border-r border-[--border-subtle] bg-[--bg-elevated] p-3 md:flex">
          <div className="mb-4 flex items-center gap-2 px-1">
            <span className="grid h-6 w-6 place-items-center rounded-[--r-sm] bg-[--accent-subtle] text-[--accent-text]">
              <AiMarkIcon className="h-3.5 w-3.5" />
            </span>
            <span className="text-[13px] font-semibold tracking-[-0.01em] text-[--text-primary]">
              Confluence
            </span>
          </div>

          <div className="space-y-1">
            <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
              Rooms
            </p>
            <div className="flex items-center gap-2 rounded-[--r-md] bg-[--surface-active] px-2.5 py-1.5 text-[12.5px] font-medium text-[--text-primary]">
              <Hash className="h-3.5 w-3.5 text-[--text-secondary]" />
              <span className="truncate">product-sync</span>
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[--accent]" />
            </div>
            <div className="flex items-center gap-2 rounded-[--r-md] px-2.5 py-1.5 text-[12.5px] text-[--text-secondary] hover:bg-[--surface-hover]">
              <Hash className="h-3.5 w-3.5 text-[--text-muted]" />
              <span className="truncate">infrastructure</span>
            </div>
          </div>

          <div className="mt-4 space-y-1">
            <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
              Private AI
            </p>
            <div className="flex items-center gap-2 rounded-[--r-md] px-2.5 py-1.5 text-[12.5px] text-[--text-secondary] hover:bg-[--surface-hover]">
              <AiMarkIcon className="h-3.5 w-3.5 text-[--ai]" />
              <span className="truncate">Refactoring plan</span>
            </div>
          </div>
        </aside>

        {/* Main conversation column */}
        <div className="flex min-w-0 flex-1 flex-col bg-[--bg-page]">
          {/* Header (Section 23) */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[--border-subtle] px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-[--r-md] border border-[--border-subtle] bg-[--surface] text-[--text-muted]">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-medium text-[--text-primary]">product-sync</h3>
                  {/* Clickable mode chip to test interaction */}
                  <button
                    type="button"
                    onClick={() =>
                      setMode((m) =>
                        m === "mention_only" ? "auto" : m === "auto" ? "off" : "mention_only",
                      )
                    }
                    className="flex items-center gap-1.5 rounded-full border border-[--border-subtle] bg-[--surface] px-2.5 py-0.5 text-[11px] font-medium text-[--text-secondary] transition-colors hover:border-[--border] hover:text-[--text-primary]"
                    title="Click to cycle AI mode"
                  >
                    {mode === "off" ? (
                      <>
                        <AiModeOffIcon className="h-3 w-3 text-[--text-muted]" />
                        <span>AI: Off</span>
                      </>
                    ) : mode === "auto" ? (
                      <>
                        <AiModeAlwaysIcon className="h-3 w-3 text-[--ai]" />
                        <span className="text-[--ai]">AI: Always on</span>
                      </>
                    ) : (
                      <>
                        <AiModeMentionIcon className="h-3 w-3 text-[--ai]" />
                        <span>AI: Mention only</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-[11.5px] text-[--text-muted]">3 members · Launch readiness</p>
              </div>
            </div>

            {/* Member avatar stack with online indicators */}
            <div className="flex items-center -space-x-1.5">
              <div className="relative">
                <Avatar name="Maya Chen" size="xs" className="ring-2 ring-[--bg-page]" />
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[--success] ring-1 ring-[--bg-page]" />
              </div>
              <div className="relative">
                <Avatar name="Alex Rivera" size="xs" className="ring-2 ring-[--bg-page]" />
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[--success] ring-1 ring-[--bg-page]" />
              </div>
              <div className="relative">
                <Avatar name="Elena Rostova" size="xs" className="ring-2 ring-[--bg-page]" />
                <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-[--success] ring-1 ring-[--bg-page]" />
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
            {/* Human message 1 */}
            <div className="flex gap-3 text-left">
              <Avatar name="Maya Chen" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[--text-primary]">Maya</span>
                  <span className="text-[11px] text-[--text-muted]">10:42 AM</span>
                </div>
                <p className="mt-0.5 text-[14px] text-[--text-primary]">
                  Can someone summarize the final release status before we sign off?
                </p>
              </div>
            </div>

            {/* Human message 2 with @ai */}
            <div className="flex gap-3 text-left">
              <Avatar name="Alex Rivera" size="sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[--text-primary]">Alex</span>
                  <span className="text-[11px] text-[--text-muted]">10:43 AM</span>
                </div>
                <p className="mt-0.5 text-[14px] text-[--text-primary]">
                  <span className="mr-1.5 inline-flex items-center gap-1 rounded-[--r-xs] bg-[--ai-subtle] px-1.5 py-0.5 text-[12px] font-medium text-[--ai]">
                    @ai
                  </span>
                  give us the TL;DR on launch blockers and rollback safety.
                </p>
              </div>
            </div>

            {/* AI Document surface message (Section 24) */}
            <div
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => setIsHovered(false)}
              className={cn(
                "relative rounded-[--r-lg] border border-[--border-subtle] bg-[--surface-elevated] p-4 text-left transition-all",
                isStreaming
                  ? "border-l-2 border-l-[--ai-live]"
                  : "border-l-2 border-l-[--ai]",
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AiAvatar size="xs" status={isStreaming ? "responding" : "normal"} />
                  <span className="text-[13px] font-medium text-[--text-primary]">
                    Confluence AI
                  </span>
                  <span className="text-[11px] text-[--text-muted]">Responding to @ai</span>
                </div>

                {/* Hover toolbar */}
                <div
                  className={cn(
                    "flex items-center gap-1 transition-opacity duration-[--dur-fast]",
                    isHovered ? "opacity-100" : "opacity-0",
                  )}
                >
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-[--r-sm] border border-[--border-subtle] bg-[--surface] px-2 py-0.5 text-[11px] text-[--text-muted] hover:text-[--text-primary]"
                    aria-label="Copy AI message"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-[--success]" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-[14px] leading-relaxed text-[--text-primary]">
                {displayedAiText}
                {isStreaming && (
                  <span className="inline-block h-3.5 w-0.5 ml-0.5 translate-y-0.5 bg-[--ai-live] animate-pulse" />
                )}
              </div>
            </div>
          </div>

          {/* Composer (Section 25) */}
          <div className="border-t border-[--border-subtle] p-3 sm:p-4">
            <div className="flex items-center gap-2 rounded-[--r-lg] border border-[--border] bg-[--surface-input] px-3 py-2.5 shadow-[--shadow-1]">
              <button
                type="button"
                className="text-[--text-muted] hover:text-[--text-primary]"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <span className="flex-1 text-[13.5px] text-[--text-muted]">
                Message the room ·{" "}
                <span className="text-[--ai]">@ai</span> to invite assistant
              </span>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-[--r-md] bg-[--accent] text-white hover:bg-[--accent-hover]"
                aria-label="Send message"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
