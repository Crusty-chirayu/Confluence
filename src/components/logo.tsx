import { cn } from "@/lib/utils";

/** Two streams converging into one — "confluence". */
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
      role="presentation"
    >
      <defs>
        <linearGradient id="cf-g" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--ai-accent)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0.92" />
        </linearGradient>
        <linearGradient id="cf-sheen" x1="16" y1="0" x2="16" y2="18" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.16" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="cf-edge" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.35" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* base surface */}
      <rect width="32" height="32" rx="9" fill="url(#cf-g)" />
      {/* hairline inner edge for a polished, faceted rim */}
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" stroke="url(#cf-edge)" strokeWidth="1" />
      {/* soft top sheen for controlled depth, no glow/blur cost */}
      <rect width="32" height="18" rx="9" fill="url(#cf-sheen)" />

      <path
        d="M9 9.5c0 4.4 3.1 6.5 7 6.5s7 2.1 7 6.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.96"
      />
      <path
        d="M23 9.5c0 4.4-3.1 6.5-7 6.5s-7 2.1-7 6.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.55"
      />
    </svg>
  );
}