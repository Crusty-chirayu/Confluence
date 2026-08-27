"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { riseIn, staggerParent } from "@/lib/motion";
import { DEMO_MODE } from "@/lib/env";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-[--bg]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
        <div
          className="aurora absolute left-1/2 top-[-20rem] h-[34rem] w-[46rem] -translate-x-1/2 rounded-full opacity-[0.14] blur-[100px]"
          style={{ background: "radial-gradient(circle, var(--accent), transparent 62%)" }}
        />
      </div>

      <header className="flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo className="h-7 w-7" />
          <span className="text-[15px] font-semibold tracking-tight">Confluence</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <motion.div
          variants={staggerParent(0.05)}
          initial="hidden"
          animate="show"
          className="w-full max-w-[26rem]"
        >
          <motion.div variants={riseIn} className="mb-7 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-2 text-[14px] text-[--fg-muted]">{subtitle}</p>}
          </motion.div>

          <motion.div
            variants={riseIn}
            className="rounded-[--r-lg] border border-[--border] bg-[--surface] p-6 shadow-[--e2]"
          >
            {DEMO_MODE && (
              <div className="mb-5 rounded-[--r-md] border border-[--accent-border] bg-[--accent-subtle] px-3.5 py-3 text-[12.5px] leading-relaxed text-[--accent]">
                <strong className="font-semibold">Demo mode.</strong> Supabase isn&apos;t configured,
                so any details below will sign you into a local sandbox with seeded conversations.
              </div>
            )}
            {children}
          </motion.div>

          {footer && (
            <motion.div variants={riseIn} className="mt-5 text-center text-[13.5px] text-[--fg-muted]">
              {footer}
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
