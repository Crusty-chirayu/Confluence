"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { AiMarkIcon } from "@/components/icons";
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
    <div className="relative flex min-h-dvh flex-col bg-[--bg-page] text-[--text-primary]">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="group flex items-center gap-2.5">
          <Logo className="h-7 w-7 transition-transform duration-[--dur-micro] group-hover:scale-105" />
          <span className="text-[16px] font-semibold tracking-tight text-[--text-primary]">Confluence</span>
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
            <h1 className="text-2xl font-semibold tracking-tight text-[--text-primary]">{title}</h1>
            {subtitle && (
              <p className="mt-2 text-[14px] leading-relaxed text-[--text-secondary]">{subtitle}</p>
            )}
          </motion.div>

          <motion.div
            variants={riseIn}
            className="overflow-hidden rounded-[--r-xl] border border-[--border] bg-[--surface-modal] p-6 shadow-[--shadow-4]"
          >
            {DEMO_MODE && (
              <div className="mb-5 flex items-start gap-2.5 rounded-[--r-md] border border-[--border] bg-[--accent-subtle] px-3.5 py-3 text-[12.5px] leading-relaxed text-[--accent-text]">
                <AiMarkIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  <strong className="font-semibold">Demo mode.</strong> Supabase isn&apos;t
                  configured, so any details below will sign you into a local sandbox with seeded
                  conversations.
                </span>
              </div>
            )}
            {children}
          </motion.div>

          {footer && (
            <motion.div variants={riseIn} className="mt-5 text-center text-[13.5px] text-[--text-secondary]">
              {footer}
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}