"use client";

import * as React from "react";
import { AiAvatar, Avatar } from "@/components/ui/avatar";
import { AiMarkIcon } from "@/components/icons";
import { Hash, Lock, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function TwoSpacesComparison() {
  const [activeTab, setActiveTab] = React.useState<"private" | "room">("private");

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      {/* Switcher pills */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex rounded-full border border-[--border-subtle] bg-[--surface] p-1 shadow-[--shadow-1]">
          <button
            type="button"
            onClick={() => setActiveTab("private")}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition-all duration-[--dur-fast]",
              activeTab === "private"
                ? "bg-[--accent] text-white shadow-[--shadow-1]"
                : "text-[--text-secondary] hover:text-[--text-primary]",
            )}
          >
            <Lock className="h-3.5 w-3.5" />
            <span>Private AI Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("room")}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2 text-[13.5px] font-medium transition-all duration-[--dur-fast]",
              activeTab === "room"
                ? "bg-[--accent] text-white shadow-[--shadow-1]"
                : "text-[--text-secondary] hover:text-[--text-primary]",
            )}
          >
            <Users className="h-3.5 w-3.5" />
            <span>Shared Group Room</span>
          </button>
        </div>
      </div>

      {/* Comparison Container */}
      <div className="overflow-hidden rounded-[--r-xl] border border-[--border] bg-[--surface] p-6 shadow-[--shadow-2] sm:p-8">
        {activeTab === "private" ? (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 border-b border-[--border-subtle] pb-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[--accent-subtle] text-[--accent-text]">
                    <Lock className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[16px] font-semibold text-[--text-primary]">
                    Your private thinking space
                  </h4>
                </div>
                <p className="mt-1 text-[13px] text-[--text-secondary]">
                  Isolated thread with Confluence AI. Stored encrypted, never visible to teammates.
                </p>
              </div>
              <span className="self-start rounded-full bg-[--surface-hover] px-2.5 py-1 text-[11px] font-medium text-[--text-muted] sm:self-auto">
                Only you
              </span>
            </div>

            {/* Chat Timeline Mock */}
            <div className="space-y-4">
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-[16px] rounded-br-[6px] bg-[--surface-elevated] px-4 py-3 text-[14px] text-[--text-primary] shadow-[--shadow-1]">
                  Review this architecture decision: what breaks if we move authentication to session tokens instead of JWTs?
                </div>
              </div>

              <div className="rounded-[--r-lg] border-l-2 border-l-[--ai] bg-[--surface-elevated] p-4 text-left">
                <div className="mb-2 flex items-center gap-2">
                  <AiAvatar size="xs" />
                  <span className="text-[13px] font-medium text-[--text-primary]">
                    Confluence AI
                  </span>
                </div>
                <p className="text-[14px] leading-relaxed text-[--text-primary]">
                  Session tokens require server-side state or Redis lookups for validation on each request, adding single-digit millisecond latency. However, they allow immediate revocation on password resets, eliminating the stale token window inherent to stateless JWTs.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 border-b border-[--border-subtle] pb-4 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[--ai-subtle] text-[--ai]">
                    <Users className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-[16px] font-semibold text-[--text-primary]">
                    Shared rooms with controlled AI
                  </h4>
                </div>
                <p className="mt-1 text-[13px] text-[--text-secondary]">
                  Everyone on the team collaborates together. AI responds only according to the room&apos;s mode.
                </p>
              </div>
              <span className="self-start rounded-full bg-[--ai-subtle] px-2.5 py-1 text-[11px] font-medium text-[--ai] sm:self-auto">
                Team space
              </span>
            </div>

            {/* Room Timeline Mock */}
            <div className="space-y-3.5">
              <div className="flex gap-3 text-left">
                <Avatar name="Kavita Rao" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-[--text-primary]">Kavita</span>
                    <span className="text-[11px] text-[--text-muted]">11:05 AM</span>
                  </div>
                  <p className="mt-0.5 text-[14px] text-[--text-primary]">
                    Our API endpoint latency spiked during the database backup window.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 text-left">
                <Avatar name="Liam Ortiz" size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-medium text-[--text-primary]">Liam</span>
                    <span className="text-[11px] text-[--text-muted]">11:06 AM</span>
                  </div>
                  <p className="mt-0.5 text-[14px] text-[--text-primary]">
                    <span className="mr-1.5 inline-flex items-center rounded-[--r-xs] bg-[--ai-subtle] px-1.5 py-0.5 text-[11.5px] font-medium text-[--ai]">
                      @ai
                    </span>
                    suggest a zero-downtime backup configuration for Postgres under high load.
                  </p>
                </div>
              </div>

              <div className="rounded-[--r-lg] border-l-2 border-l-[--ai] bg-[--surface-elevated] p-4 text-left">
                <div className="mb-2 flex items-center gap-2">
                  <AiAvatar size="xs" />
                  <span className="text-[13px] font-medium text-[--text-primary]">
                    Confluence AI
                  </span>
                  <span className="text-[11px] text-[--text-muted]">Responding to @ai</span>
                </div>
                <p className="text-[14px] leading-relaxed text-[--text-primary]">
                  Switch pg_dump from exclusive locks to snapshot-based backups via standby replicas, or enable continuous archiving with WAL archiving to Amazon S3. This isolates I/O load completely from primary read/write queries.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
