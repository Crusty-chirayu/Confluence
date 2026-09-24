import React from "react";
import { cn } from "@/lib/utils";

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
  className?: string;
}

/**
 * AI Mark Icon — Precision converging stream glyph.
 * 1.5px stroke, rounded terminals, no fills.
 */
export function AiMarkIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M5 5C5 10.5 12 11.5 12 16V19" />
      <path d="M19 5C19 10.5 12 11.5 12 16" />
    </svg>
  );
}

/**
 * AI Mode: Off
 * A single unbranched line.
 */
export function AiModeOffIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="var(--error)" strokeWidth="1.5" />
    </svg>
  );
}

/**
 * AI Mode: Mention Only
 * A line with an @ node.
 */
export function AiModeMentionIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <line x1="12" y1="4" x2="12" y2="9" />
      <circle cx="12" cy="14" r="5" />
      <path d="M12 12.5C11 12.5 10.5 13.2 10.5 14C10.5 14.8 11 15.5 12 15.5C13.2 15.5 13.8 14.8 13.8 13.5V12" />
      <line x1="12" y1="19" x2="12" y2="20" />
    </svg>
  );
}

/**
 * AI Mode: Always On
 * Two lines converging into one stream.
 */
export function AiModeAlwaysIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M6 5C6 11 12 12 12 16V19" />
      <path d="M18 5C18 11 12 12 12 16" />
    </svg>
  );
}

/**
 * Room Indicator: 2-member group silhouette
 */
export function RoomGlyphIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3.5 18C3.5 15 6 13.5 9 13.5C12 13.5 14.5 15 14.5 18" />
      <path d="M15.5 6C16.5 6.5 17 7.5 17 8.5C17 9.5 16.5 10.5 15.5 11" />
      <path d="M16 14C18 14.5 20.5 15.5 20.5 18" />
    </svg>
  );
}

/**
 * Direct Chat Glyph: Single conversation message
 */
export function DirectChatGlyphIcon({ size = 16, className, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden="true"
      {...props}
    >
      <path d="M20 12C20 16.4183 16.4183 20 12 20C10.5 20 9.1 19.6 7.9 18.9L4 20L5.1 16.1C4.4 14.9 4 13.5 4 12C4 7.58172 7.58172 4 12 4C16.4183 4 20 7.58172 20 12Z" />
    </svg>
  );
}
