import React from "react";
import { cn } from "@/lib/utils";

export interface LogoProps {
  size?: 16 | 24 | 32;
  className?: string;
  monochrome?: boolean;
}

/**
 * Confluence Brand Mark — The Merge
 * Two thin lines (1.5px) converging into one stream on a 24x24 grid.
 * Precision over decoration: rounded terminals, no fills, disciplined stroke.
 */
export function Logo({ size = 24, className, monochrome = false }: LogoProps) {
  const dim = size;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      role="presentation"
    >
      {/* Stream 1 (Left / Private): Curves inward to merge */}
      <path
        d="M 5 4.5 C 5 10.5 12 11.5 12 16 L 12 20"
        stroke={monochrome ? "currentColor" : "var(--accent)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Stream 2 (Right / Room / AI): Curves inward and merges at the confluence trunk */}
      <path
        d="M 19 4.5 C 19 10.5 12 11.5 12 16"
        stroke={monochrome ? "currentColor" : "var(--ai)"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Full brand lockup: Logo Mark + Wordmark */
export function BrandLockup({
  size = 24,
  className,
  markOnly = false,
}: {
  size?: 16 | 24 | 32;
  className?: string;
  markOnly?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <Logo size={size} />
      {!markOnly && (
        <span className="text-[14px] font-semibold tracking-[-0.02em] text-[--text-primary]">
          Confluence
        </span>
      )}
    </div>
  );
}