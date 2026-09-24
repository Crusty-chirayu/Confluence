"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AiMarkIcon } from "@/components/icons";

export function HeroConverge() {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    setReduced(
      typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  return (
    <div className="relative mx-auto my-6 flex h-14 w-full max-w-[560px] items-center justify-center">
      {/* Subtle ambient light - Section 18: One radial gradient at <= 12% opacity drifting slowly */}
      <div
        className="pointer-events-none absolute -inset-8 opacity-[0.10] blur-2xl transition-opacity duration-1000"
        style={{
          background:
            "radial-gradient(circle at 50% 50%, var(--ai), transparent 70%)",
        }}
        aria-hidden
      />

      <svg
        className="h-10 w-full"
        viewBox="0 0 560 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        {/* Left line: private stream */}
        <motion.path
          d="M 20 20 C 140 20, 220 20, 270 20"
          stroke="var(--accent)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />

        {/* Right line: group stream */}
        <motion.path
          d="M 540 20 C 420 20, 340 20, 290 20"
          stroke="var(--ai)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeOpacity="0.75"
          initial={reduced ? { pathLength: 1 } : { pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      {/* Central merge node */}
      <motion.div
        initial={reduced ? { scale: 1, opacity: 1 } : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 1.2, ease: "easeOut" }}
        className="absolute grid h-8 w-8 place-items-center rounded-full border border-[--border] bg-[--surface-elevated] shadow-[--shadow-1]"
      >
        <AiMarkIcon className="h-4 w-4 text-[--ai]" />
      </motion.div>
    </div>
  );
}
