"use client";

import Link from "next/link";
import { motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";
import { tEnter } from "@/lib/motion";

const LINKS = [
  { href: "#product", label: "Product" },
  { href: "#how", label: "How it works" },
  { href: "#security", label: "Security" },
  { href: "/changelog", label: "Changelog" },
];

export function LandingNav() {
  const { scrollY } = useScroll();
  const [stuck, setStuck] = useState(false);
  const [open, setOpen] = useState(false);

  useMotionValueEvent(scrollY, "change", (y) => setStuck(y > 16));

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-[--r-md] focus:bg-[--accent] focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-[--focus-ring]"
      >
        Skip to content
      </a>

      <motion.header
        initial={{ y: -16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={tEnter(0.36)}
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-all duration-[--dur-base]",
          stuck
            ? "border-b border-[--border-subtle] bg-[--bg-page]/85 shadow-[--shadow-1] backdrop-blur-md"
            : "border-b border-transparent bg-transparent",
        )}
      >
        <nav
          aria-label="Main"
          className="mx-auto flex h-14 max-w-[1200px] items-center justify-between gap-6 px-5 sm:h-16 sm:px-8"
        >
          <Link href="/" className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] rounded-[--r-sm]">
            <Logo size={24} />
            <span className="text-[16px] font-semibold tracking-[-0.02em] text-[--text-primary]">
              Confluence
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {LINKS.map((l) =>
              l.href.startsWith("/") ? (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-[--r-sm] px-3 py-1.5 text-[14px] font-medium text-[--text-secondary] transition-colors duration-[--dur-fast] hover:text-[--text-primary]"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  className="rounded-[--r-sm] px-3 py-1.5 text-[14px] font-medium text-[--text-secondary] transition-colors duration-[--dur-fast] hover:text-[--text-primary]"
                >
                  {l.label}
                </a>
              ),
            )}
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              asChild
              href="/login"
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex text-[--text-secondary] hover:text-[--text-primary]"
            >
              Sign in
            </Button>
            <Button asChild href="/signup" size="sm" className="hidden sm:inline-flex">
              Get started
            </Button>
            <button
              className="grid h-10 w-10 place-items-center rounded-[--r-md] text-[--text-secondary] hover:bg-[--surface-hover] hover:text-[--text-primary] md:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-label="Menu"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>

        {/* Mobile menu sheet */}
        <motion.div
          initial={false}
          animate={{ opacity: open ? 1 : 0, y: open ? 0 : -8 }}
          transition={tEnter(0.2)}
          className={cn(
            "overflow-hidden border-t border-[--border-subtle] bg-[--bg-page] md:hidden",
            open ? "pointer-events-auto block" : "pointer-events-none hidden",
          )}
        >
          <div className="flex flex-col gap-1 p-4">
            {LINKS.map((l) =>
              l.href.startsWith("/") ? (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-[--r-md] px-3.5 py-2.5 text-[15px] font-medium text-[--text-secondary] hover:bg-[--surface-hover] hover:text-[--text-primary]"
                >
                  {l.label}
                </Link>
              ) : (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-[--r-md] px-3.5 py-2.5 text-[15px] font-medium text-[--text-secondary] hover:bg-[--surface-hover] hover:text-[--text-primary]"
                >
                  {l.label}
                </a>
              ),
            )}
            <div className="mt-4 flex flex-col gap-2 pt-2 border-t border-[--border-subtle]">
              <Button asChild href="/login" variant="secondary" className="w-full" onClick={() => setOpen(false)}>
                Sign in
              </Button>
              <Button asChild href="/signup" className="w-full" onClick={() => setOpen(false)}>
                Get started
              </Button>
            </div>
          </div>
        </motion.div>
      </motion.header>
    </>
  );
}
