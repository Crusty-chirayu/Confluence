"use client";

import { AiMarkIcon } from "@/components/icons";
import { cn, hueFrom, initials } from "@/lib/utils";

const sizes = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

export function Avatar({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const hue = hueFrom(name);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-semibold border border-[--border-subtle]",
        sizes[size],
        className,
      )}
      style={
        url
          ? undefined
          : {
              background: `linear-gradient(140deg, hsl(${hue} 45% 42%), hsl(${(hue + 36) % 360} 45% 32%))`,
              color: "#F3F5F8",
            }
      }
      aria-hidden="true"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}

export function AiAvatar({
  size = "md",
  className,
  status = "normal",
}: {
  size?: keyof typeof sizes;
  className?: string;
  status?: "normal" | "listening" | "following" | "responding" | "off";
}) {
  const isOff = status === "off";
  const isLive = status === "responding";

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full bg-[--surface-elevated] text-[--ai] transition-all duration-[--dur-fast]",
        isOff
          ? "opacity-50 ring-1 ring-[--border-strong] text-[--text-muted]"
          : isLive
            ? "ring-2 ring-[--ai-live] text-[--ai-live]"
            : "ring-2 ring-[--ai]",
        sizes[size],
        className,
      )}
      aria-hidden="true"
    >
      <AiMarkIcon className="h-1/2 w-1/2" />
      {isLive && (
        <span
          className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-[--ai-live] ring-2 ring-[--bg-page]"
          aria-hidden="true"
        />
      )}
    </span>
  );
}

/** Section 6 & 24 "Confluence AI" pill badge */
export function AiPill({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-[--r-xs] border border-[--ai]/30 bg-[--ai-subtle] px-1.5 py-0.5 text-[10px] font-semibold uppercase leading-[12px] tracking-[0.08em] text-[--ai]",
        className,
      )}
    >
      AI
    </span>
  );
}
