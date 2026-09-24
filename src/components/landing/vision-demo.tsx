"use client";

import * as React from "react";
import { Eye, FileImage } from "lucide-react";
import { AiAvatar } from "@/components/ui/avatar";

export function VisionDemo() {
  return (
    <div className="mx-auto w-full max-w-[800px] overflow-hidden rounded-[--r-xl] border border-[--border] bg-[--surface] p-6 shadow-[--shadow-2] sm:p-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        {/* Uploaded image thumbnail card */}
        <div className="w-full sm:w-[240px] shrink-0">
          <div className="group relative overflow-hidden rounded-[--r-lg] border border-[--border] bg-[--surface-input] p-3 shadow-[--shadow-1]">
            <div className="aspect-[4/3] w-full rounded-[--r-md] bg-[--surface-elevated] flex flex-col items-center justify-center border border-[--border-subtle]">
              <FileImage className="h-8 w-8 text-[--accent-text] opacity-75" />
              <span className="mt-2 font-mono text-[11px] text-[--text-muted]">architecture-v2.png</span>
              <span className="text-[10px] text-[--text-muted]">540 KB · Image</span>
            </div>
            <div className="mt-2.5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-[--ai]">
                <Eye className="h-3 w-3" />
                AI vision ready
              </span>
              <span className="text-[11px] text-[--text-muted]">Uploaded</span>
            </div>
          </div>
        </div>

        {/* AI response card referencing the image */}
        <div className="flex-1 space-y-3">
          <div className="rounded-[16px] rounded-br-[6px] bg-[--surface-elevated] px-4 py-3 text-[14px] text-[--text-primary] shadow-[--shadow-1]">
            What is the single point of failure in this deployment diagram?
          </div>

          <div className="rounded-[--r-lg] border-l-2 border-l-[--ai] bg-[--surface-elevated] p-4 text-left">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AiAvatar size="xs" />
                <span className="text-[13px] font-medium text-[--text-primary]">
                  Confluence AI
                </span>
                <span className="rounded-[--r-xs] bg-[--ai-subtle] px-1.5 py-0.5 text-[10.5px] font-medium text-[--ai]">
                  Based on 1 image
                </span>
              </div>
              <span className="text-[11px] text-[--text-muted]">10:48 AM</span>
            </div>
            <p className="text-[13.5px] leading-relaxed text-[--text-primary]">
              In your diagram, the shared Redis instance sits as the single message broker across all three worker pools without a sentinel or replica cluster configured. If Redis restarts, worker task queue state and rate limit counters will be lost.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
