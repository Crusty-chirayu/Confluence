"use client";

import * as React from "react";
import { Check, Copy, Hash, Paperclip, Send } from "lucide-react";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { AiMarkIcon, AiModeMentionIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

interface DemoScenario {
  roomName: string;
  topic: string;
  contextMessage?: {
    name: string;
    time: string;
    text: string;
  };
  triggerMessage: {
    name: string;
    time: string;
    mention: string;
    text: string;
  };
  aiReply: string;
  replyTime: string;
}

const SCENARIOS: DemoScenario[] = [
  {
    roomName: "product-sync",
    topic: "3 members · Launch readiness",
    contextMessage: {
      name: "Maya Chen",
      time: "10:42 AM",
      text: "Can someone summarize the final release status before we sign off?",
    },
    triggerMessage: {
      name: "Alex Rivera",
      time: "10:43 AM",
      mention: "@ai",
      text: "give us the TL;DR on launch blockers and rollback safety.",
    },
    aiReply:
      "Launch blockers are cleared. Staging passed with 0 test regressions, and the database migration reversibility was verified. Remaining risk is low (on-call rotation required).",
    replyTime: "10:43 AM",
  },
  {
    roomName: "infrastructure",
    topic: "4 members · Reliability & failover",
    contextMessage: {
      name: "Liam Ortiz",
      time: "10:47 AM",
      text: "We are reviewing DR procedures for the primary Postgres cluster.",
    },
    triggerMessage: {
      name: "Elena Rostova",
      time: "10:48 AM",
      mention: "@ai",
      text: "what is the failover strategy if our primary database replica drops?",
    },
    aiReply:
      "Automated failover promotes the warm standby replica within 12 seconds with zero data loss. Client connections automatically re-route through PgBouncer connection pooling.",
    replyTime: "10:48 AM",
  },
];

type DemoPhase = "entering" | "thinking" | "streaming" | "completed";

export function ProductPreview() {
  const [scenarioIndex, setScenarioIndex] = React.useState(0);
  const [phase, setPhase] = React.useState<DemoPhase>("entering");
  const [streamedWords, setStreamedWords] = React.useState<number>(0);
  const [copied, setCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const scenario = SCENARIOS[scenarioIndex];
  const words = React.useMemo(() => scenario.aiReply.split(" "), [scenario.aiReply]);

  React.useEffect(() => {
    setReducedMotion(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  // Orchestrate the live demo timeline
  React.useEffect(() => {
    if (reducedMotion) {
      setPhase("completed");
      setStreamedWords(words.length);
      return;
    }

    let timer: ReturnType<typeof setTimeout>;
    let interval: ReturnType<typeof setInterval>;

    // Step 1: Entering (0 -> 500ms)
    setPhase("entering");
    setStreamedWords(0);

    timer = setTimeout(() => {
      // Step 2: AI Thinking / Typing indicator (500ms -> 1300ms)
      setPhase("thinking");

      timer = setTimeout(() => {
        // Step 3: Progressive streaming (1300ms onward)
        setPhase("streaming");
        let currentWord = 0;

        interval = setInterval(() => {
          currentWord += 2;
          if (currentWord >= words.length) {
            setStreamedWords(words.length);
            setPhase("completed");
            clearInterval(interval);

            // Step 4: Dwell on completed state, then transition to next scenario
            timer = setTimeout(() => {
              setScenarioIndex((prev) => (prev + 1) % SCENARIOS.length);
            }, 5500);
          } else {
            setStreamedWords(currentWord);
          }
        }, 65);
      }, 800);
    }, 500);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [scenarioIndex, reducedMotion, words.length]);

  const displayedAiText = React.useMemo(() => {
    if (phase === "completed" || reducedMotion) {
      return scenario.aiReply;
    }
    return words.slice(0, streamedWords).join(" ");
  }, [phase, reducedMotion, scenario.aiReply, words, streamedWords]);

  const handleCopy = () => {
    setCopied(true);
    navigator.clipboard?.writeText?.(scenario.aiReply);
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
            <button
              type="button"
              onClick={() => setScenarioIndex(0)}
              className={cn(
                "flex w-full items-center gap-2 rounded-[--r-md] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors text-left",
                scenarioIndex === 0
                  ? "bg-[--surface-active] text-[--text-primary]"
                  : "text-[--text-secondary] hover:bg-[--surface-hover]",
              )}
            >
              <Hash className="h-3.5 w-3.5 text-[--text-secondary]" />
              <span className="truncate">product-sync</span>
              {scenarioIndex === 0 && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[--accent]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setScenarioIndex(1)}
              className={cn(
                "flex w-full items-center gap-2 rounded-[--r-md] px-2.5 py-1.5 text-[12.5px] font-medium transition-colors text-left",
                scenarioIndex === 1
                  ? "bg-[--surface-active] text-[--text-primary]"
                  : "text-[--text-secondary] hover:bg-[--surface-hover]",
              )}
            >
              <Hash className="h-3.5 w-3.5 text-[--text-muted]" />
              <span className="truncate">infrastructure</span>
              {scenarioIndex === 1 && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[--accent]" />
              )}
            </button>
          </div>

          <div className="mt-4 space-y-1">
            <p className="px-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
              Private AI
            </p>
            <div className="flex items-center gap-2 rounded-[--r-md] px-2.5 py-1.5 text-[12.5px] text-[--text-secondary] hover:bg-[--surface-hover]">
              <AiMarkIcon className="h-3.5 w-3.5 text-[--ai]" />
              <span className="truncate">Architecture review</span>
            </div>
          </div>
        </aside>

        {/* Main conversation column */}
        <div className="flex min-w-0 flex-1 flex-col bg-[--bg-page]">
          {/* Header */}
          <div className="flex h-14 shrink-0 items-center justify-between border-b border-[--border-subtle] px-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-7 w-7 place-items-center rounded-[--r-md] border border-[--border-subtle] bg-[--surface] text-[--text-muted]">
                <Hash className="h-3.5 w-3.5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-[14px] font-medium text-[--text-primary]">
                    {scenario.roomName}
                  </h3>
                  {/* Dynamic AI Mode Status Pill */}
                  {phase === "thinking" || phase === "streaming" ? (
                    <span className="flex items-center gap-1.5 rounded-full border border-[--ai-subtle] bg-[--ai-subtle] px-2.5 py-0.5 text-[11px] font-medium text-[--ai]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[--ai] animate-pulse" />
                      <span>AI: Responding to @ai</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-full border border-[--border-subtle] bg-[--surface] px-2.5 py-0.5 text-[11px] font-medium text-[--text-secondary]">
                      <AiModeMentionIcon className="h-3 w-3 text-[--ai]" />
                      <span>AI: Mention only</span>
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-[--text-muted]">{scenario.topic}</p>
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
            {/* Context message */}
            {scenario.contextMessage && (
              <div className="flex items-start gap-3 text-left">
                <Avatar name={scenario.contextMessage.name} size="sm" />
                <div className="min-w-0 flex-1 max-w-[85%]">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-[--text-primary]">
                      {scenario.contextMessage.name.split(" ")[0]}
                    </span>
                    <span className="text-[11px] text-[--text-muted]">
                      {scenario.contextMessage.time}
                    </span>
                  </div>
                  <div className="mt-1 rounded-[16px] rounded-tl-[4px] bg-[--surface-active] px-4 py-2.5 text-[14px] text-[--text-primary]">
                    {scenario.contextMessage.text}
                  </div>
                </div>
              </div>
            )}

            {/* Trigger message with @ai */}
            <div className="flex items-start gap-3 text-left">
              <Avatar name={scenario.triggerMessage.name} size="sm" />
              <div className="min-w-0 flex-1 max-w-[85%]">
                <div className="flex items-baseline gap-2">
                  <span className="text-[13px] font-medium text-[--text-primary]">
                    {scenario.triggerMessage.name.split(" ")[0]}
                  </span>
                  <span className="text-[11px] text-[--text-muted]">
                    {scenario.triggerMessage.time}
                  </span>
                </div>
                <div className="mt-1 rounded-[16px] rounded-tl-[4px] bg-[--surface-active] px-4 py-2.5 text-[14px] text-[--text-primary]">
                  <span className="mr-1.5 inline-flex items-center gap-1 rounded-[--r-xs] bg-[--ai-subtle] px-1.5 py-0.5 text-[11.5px] font-medium text-[--ai]">
                    {scenario.triggerMessage.mention}
                  </span>
                  {scenario.triggerMessage.text}
                </div>
              </div>
            </div>

            {/* AI Response row (Canonical grid) */}
            {(phase === "thinking" || phase === "streaming" || phase === "completed") && (
              <div
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                className="flex items-start gap-3 text-left transition-all duration-200"
              >
                <AiAvatar
                  size="sm"
                  status={phase === "streaming" || phase === "thinking" ? "responding" : "normal"}
                />
                <div className="min-w-0 flex-1 max-w-[85%]">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-medium text-[--text-primary]">
                        Confluence AI
                      </span>
                      <span className="text-[11px] text-[--text-muted]">
                        {phase === "thinking"
                          ? "Thinking..."
                          : phase === "streaming"
                            ? "Responding to @ai"
                            : "Responded to @ai"}
                      </span>
                    </div>

                    {/* Copy action on completed */}
                    {phase === "completed" && (
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={cn(
                          "flex items-center gap-1 rounded-[--r-sm] border border-[--border-subtle] bg-[--surface] px-2 py-0.5 text-[11px] text-[--text-muted] transition-opacity hover:text-[--text-primary]",
                          isHovered ? "opacity-100" : "opacity-0",
                        )}
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
                    )}
                  </div>

                  <div
                    className={cn(
                      "mt-1 rounded-[16px] rounded-tl-[4px] border border-[--border-subtle] bg-[--surface-elevated] px-4 py-3 text-[14px] leading-relaxed text-[--text-primary] shadow-[--shadow-1] transition-colors",
                      phase === "streaming"
                        ? "border-l-2 border-l-[--ai-live]"
                        : "border-l-2 border-l-[--ai]",
                    )}
                  >
                    {phase === "thinking" ? (
                      <div className="flex items-center gap-1.5 py-1 px-0.5" aria-label="AI is thinking">
                        <span className="h-1.5 w-1.5 rounded-full bg-[--ai] animate-pulse" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[--ai] animate-pulse [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 rounded-full bg-[--ai] animate-pulse [animation-delay:300ms]" />
                      </div>
                    ) : (
                      <div>
                        <span>{displayedAiText}</span>
                        {phase === "streaming" && (
                          <span className="inline-block h-3.5 w-0.5 ml-0.5 translate-y-0.5 bg-[--ai-live] animate-pulse" />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
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
