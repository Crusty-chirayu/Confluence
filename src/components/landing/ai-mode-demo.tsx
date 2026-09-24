"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { AiModeAlwaysIcon, AiModeMentionIcon, AiModeOffIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

type ModeOption = "off" | "mention_only" | "auto";

interface ModeConfig {
  key: ModeOption;
  label: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  messages: Array<{
    sender: string;
    text: string;
    isAi?: boolean;
    isMention?: boolean;
  }>;
}

const MODES: ModeConfig[] = [
  {
    key: "off",
    label: "Off",
    tagline: "Just people.",
    description: "AI stays out of this room. It won't read or reply.",
    icon: AiModeOffIcon,
    messages: [
      { sender: "Sarah", text: "Are we aligned on keeping the migration offline?" },
      { sender: "Devin", text: "Yes, team discussion only. No automated summarization." },
      { sender: "Sarah", text: "Clean and private. Just the engineering team." },
    ],
  },
  {
    key: "mention_only",
    label: "Mention only",
    tagline: "Silent until called.",
    description: "AI replies only when someone types @ai in the message.",
    icon: AiModeMentionIcon,
    messages: [
      { sender: "Sarah", text: "Has anyone benchmarked our Redis cluster memory footprint?" },
      { sender: "Devin", text: "Not since the last cluster upgrade." },
      {
        sender: "Sarah",
        text: "@ai what was the peak memory consumption during the last stress run?",
        isMention: true,
      },
      {
        sender: "Confluence AI",
        text: "Peak memory reached 4.2 GB at 12,000 req/s, remaining well within the 8 GB allocated headroom.",
        isAi: true,
      },
    ],
  },
  {
    key: "auto",
    label: "Always on",
    tagline: "Follows along, joins in.",
    description: "AI follows the conversation and joins in when it can help.",
    icon: AiModeAlwaysIcon,
    messages: [
      { sender: "Devin", text: "We need an idempotent cleanup function for stale invite codes." },
      {
        sender: "Confluence AI",
        text: "I can draft that query. We can purge expired invites where used_count >= max_uses in a batch job.",
        isAi: true,
      },
      { sender: "Devin", text: "Sounds good, verify with the database constraints." },
    ],
  },
];

export function AiModeDemo() {
  const [selected, setSelected] = React.useState<ModeOption>("mention_only");
  const current = MODES.find((m) => m.key === selected) ?? MODES[1];

  return (
    <div className="mx-auto w-full max-w-[1000px] rounded-[--r-xl] border border-[--border-subtle] bg-[--surface] p-6 shadow-[--shadow-2] sm:p-8">
      <div className="grid gap-8 lg:grid-cols-12 lg:items-center">
        {/* Left: Mode Selector Radio Group (Section 26) */}
        <div className="space-y-3 lg:col-span-5" role="radiogroup" aria-label="AI participation mode selector">
          {MODES.map((m) => {
            const isSelected = m.key === selected;
            const Icon = m.icon;

            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => setSelected(m.key)}
                className={cn(
                  "relative flex w-full items-start gap-3.5 rounded-[--r-lg] border p-4 text-left transition-all duration-[--dur-fast]",
                  isSelected
                    ? "border-[--accent] bg-[--accent-subtle] shadow-[--shadow-1]"
                    : "border-[--border-subtle] bg-[--surface-input] hover:border-[--border] hover:bg-[--surface-hover]",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-[--r-sm]",
                    isSelected ? "text-[--accent-text]" : "text-[--text-muted]",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-semibold text-[--text-primary]">
                      {m.label}
                    </span>
                    <span className="text-[12px] font-medium text-[--text-muted]">
                      {m.tagline}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-[--text-secondary]">
                    {m.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Right: Room Reaction Simulation */}
        <div className="lg:col-span-7">
          <div className="rounded-[--r-lg] border border-[--border] bg-[--bg-page] p-5 shadow-[--shadow-1]">
            {/* Header with state indicator */}
            <div className="mb-4 flex items-center justify-between border-b border-[--border-subtle] pb-3">
              <div className="flex items-center gap-2.5">
                <span className="text-[13.5px] font-semibold text-[--text-primary]">
                  #architecture-sync
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    selected === "off"
                      ? "bg-[--surface-hover] text-[--text-muted]"
                      : "bg-[--ai-subtle] text-[--ai]",
                  )}
                >
                  {selected === "off"
                    ? "AI: Off"
                    : selected === "auto"
                      ? "AI: Always on"
                      : "AI: Mention only"}
                </span>
              </div>

              <div className="text-[11.5px] text-[--text-muted]">
                {selected === "off"
                  ? "AI is quiet"
                  : selected === "auto"
                    ? "AI is following along"
                    : "Waiting for @ai"}
              </div>
            </div>

            {/* Conversation Messages */}
            <div className="space-y-3.5 min-h-[220px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selected}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-3"
                >
                  {current.messages.map((msg, i) => (
                    <div
                      key={i}
                      className={cn(
                        "flex gap-3 text-left",
                        msg.isAi
                          ? "rounded-[--r-md] border-l-2 border-l-[--ai] bg-[--surface-elevated] p-3 text-[13.5px]"
                          : "",
                      )}
                    >
                      {msg.isAi ? (
                        <AiAvatar size="xs" />
                      ) : (
                        <Avatar name={msg.sender} size="xs" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span
                            className={cn(
                              "text-[12.5px] font-medium",
                              msg.isAi ? "text-[--ai]" : "text-[--text-primary]",
                            )}
                          >
                            {msg.sender}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[13.5px] leading-relaxed text-[--text-primary]">
                          {msg.isMention && (
                            <span className="mr-1 inline-flex rounded-[--r-xs] bg-[--ai-subtle] px-1 py-0.5 text-[11px] font-medium text-[--ai]">
                              @ai
                            </span>
                          )}
                          {msg.text.replace("@ai ", "")}
                        </p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
