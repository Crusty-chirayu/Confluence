"use client";

import * as React from "react";
import { Database, Lock, Shield, User, HardDrive } from "lucide-react";
import { AiMarkIcon } from "@/components/icons";

export function TrustDiagram() {
  return (
    <div className="mx-auto w-full max-w-[960px] rounded-[--r-xl] border border-[--border] bg-[--surface] p-6 shadow-[--shadow-2] sm:p-8">
      <div className="mb-6 flex flex-col justify-between gap-3 border-b border-[--border-subtle] pb-4 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-[16px] font-semibold text-[--text-primary]">
            Database-enforced security boundaries
          </h3>
          <p className="mt-1 text-[13px] text-[--text-secondary]">
            Access control is verified at the Postgres layer via Row-Level Security, not just in UI code.
          </p>
        </div>
        <span className="self-start inline-flex items-center gap-1.5 rounded-full bg-[--success]/10 px-3 py-1 text-[11.5px] font-medium text-[--success] sm:self-auto">
          <Shield className="h-3.5 w-3.5" />
          Zero policy leaks
        </span>
      </div>

      {/* Grid of Boundary Layers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Layer 1: Authenticated Member */}
        <div className="relative rounded-[--r-lg] border border-[--border-subtle] bg-[--surface-input] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-[--r-md] bg-[--accent-subtle] text-[--accent-text]">
              <User className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-mono text-[--text-muted]">01. Client</span>
          </div>
          <h4 className="text-[14px] font-semibold text-[--text-primary]">Member Session</h4>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[--text-secondary]">
            Session verified via secure JWT. Browser never receives secret API keys or service tokens.
          </p>
        </div>

        {/* Layer 2: Room Membership Boundary */}
        <div className="relative rounded-[--r-lg] border border-[--border-subtle] bg-[--surface-input] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-[--r-md] bg-[--accent-subtle] text-[--accent-text]">
              <Database className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-mono text-[--text-muted]">02. Postgres</span>
          </div>
          <h4 className="text-[14px] font-semibold text-[--text-primary]">Row-Level Security</h4>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[--text-secondary]">
            Database queries enforce room membership. Non-members cannot read messages or metadata.
          </p>
        </div>

        {/* Layer 3: Edge Inference Gate */}
        <div className="relative rounded-[--r-lg] border border-[--border-subtle] bg-[--surface-input] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-[--r-md] bg-[--ai-subtle] text-[--ai]">
              <AiMarkIcon className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-mono text-[--text-muted]">03. Inference</span>
          </div>
          <h4 className="text-[14px] font-semibold text-[--text-primary]">AI Mode Gate</h4>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[--text-secondary]">
            AI invocations trigger strictly per room mode. Moderation runs on all inputs and outputs.
          </p>
        </div>

        {/* Layer 4: Private Storage */}
        <div className="relative rounded-[--r-lg] border border-[--border-subtle] bg-[--surface-input] p-4 text-left">
          <div className="mb-3 flex items-center justify-between">
            <span className="grid h-8 w-8 place-items-center rounded-[--r-md] bg-[--accent-subtle] text-[--accent-text]">
              <HardDrive className="h-4 w-4" />
            </span>
            <span className="text-[11px] font-mono text-[--text-muted]">04. Storage</span>
          </div>
          <h4 className="text-[14px] font-semibold text-[--text-primary]">Signed Object Access</h4>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-[--text-secondary]">
            Attachments live in a private bucket with time-limited signed URLs. No public endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}
