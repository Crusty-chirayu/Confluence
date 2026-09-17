"use client";

import { useReducedMotion, MotionConfig } from "framer-motion";

/**
 * Makes framer-motion honour `prefers-reduced-motion` app-wide.
 *
 * `reducedMotion="user"` skips transform and layout animations entirely while
 * still cross-fading opacity — which is exactly the reduced-motion contract:
 * feedback stays, movement goes. The CSS-level override in globals.css covers
 * the transitions framer does not own (hover/press colours, the sidebar
 * collapse, the toast progress bar), so between the two nothing moves for a
 * user who asked for stillness.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <MotionConfig reducedMotion="user" skipAnimations={Boolean(reduce)}>
      {children}
    </MotionConfig>
  );
}
