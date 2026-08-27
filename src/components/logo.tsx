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
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#cf-g)" />
      <path
        d="M9 9.5c0 4.4 3.1 6.5 7 6.5s7 2.1 7 6.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.95"
      />
      <path
        d="M23 9.5c0 4.4-3.1 6.5-7 6.5s-7 2.1-7 6.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}
