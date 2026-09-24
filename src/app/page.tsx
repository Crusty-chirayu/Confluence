"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/nav";
import { HeroConverge } from "@/components/landing/hero-converge";
import { ProductPreview } from "@/components/landing/product-preview";
import { TwoSpacesComparison } from "@/components/landing/two-spaces-comparison";
import { AiModeDemo } from "@/components/landing/ai-mode-demo";
import { VisionDemo } from "@/components/landing/vision-demo";
import { TrustDiagram } from "@/components/landing/trust-diagram";
import { Logo } from "@/components/logo";
import { VERSION, VERSION_LABEL, RELEASE_NAME, RELEASE_DATE } from "@/lib/version";

export default function LandingPage() {
  return (
    <div className="relative min-h-dvh bg-[--bg-page] text-[--text-primary] antialiased">
      <LandingNav />

      <main id="main-content">
        {/* ===================================================================
            SECTION 1: HERO (Section 18)
            =================================================================== */}
        <section className="relative overflow-hidden px-5 pt-32 pb-16 sm:px-8 sm:pt-40 sm:pb-24">
          <div className="mx-auto max-w-[1200px] text-center">
            {/* Version Kicker (Single source of truth) */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-[--border-subtle] bg-[--surface] px-3.5 py-1 text-[12px] font-medium text-[--text-secondary] shadow-[--shadow-1]">
              <span className="h-1.5 w-1.5 rounded-full bg-[--accent]" />
              <span>Confluence {VERSION_LABEL}</span>
              <span className="text-[--border-strong]">/</span>
              <span className="text-[--text-muted]">Redesigned experience</span>
            </div>

            {/* Headline */}
            <h1 className="mx-auto max-w-4xl text-balance text-4xl font-semibold tracking-[-0.04em] text-[--text-primary] sm:text-6xl md:text-7xl">
              Think with AI alone.
              <br />
              <span className="text-[--text-secondary]">Bring it into the room.</span>
            </h1>

            {/* Merge motif convergence lines */}
            <HeroConverge />

            {/* Subhead */}
            <p className="mx-auto max-w-2xl text-pretty text-[16px] leading-relaxed text-[--text-secondary] sm:text-[18px]">
              Private conversations when you want focus. Shared rooms where AI answers only when
              you invite it.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild href="/signup" size="lg" className="rounded-[--r-md] px-6">
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button
                asChild
                href="#product-preview"
                variant="secondary"
                size="lg"
                className="rounded-[--r-md] px-6"
              >
                See how rooms work
              </Button>
            </div>

            {/* Micro-trust line */}
            <p className="mt-4 text-[12px] text-[--text-muted]">
              Private attachments · Row-level security · You control when AI speaks
            </p>
          </div>

          {/* ===================================================================
              SECTION 2: LIVE PRODUCT PREVIEW (Section 19)
              =================================================================== */}
          <div id="product-preview" className="mt-12 sm:mt-16">
            <ProductPreview />
          </div>
        </section>

        {/* ===================================================================
            SECTION 3: TWO SPACES (Private vs Group Room)
            =================================================================== */}
        <section id="product" className="border-t border-[--border-subtle] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--accent-text]">
                Two Spaces
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-4xl">
                Your thoughts alone. Your team together.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[--text-secondary]">
                Switch between a private one-to-one thread when you need focus, and collaborative rooms
                where everyone works together.
              </p>
            </div>

            <TwoSpacesComparison />
          </div>
        </section>

        {/* ===================================================================
            SECTION 4: CONTROLLED AI (Off / Mention only / Always on)
            =================================================================== */}
        <section id="how" className="border-t border-[--border-subtle] bg-[--bg-elevated] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--ai]">
                Controlled AI Posture
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-4xl">
                You control when the assistant speaks.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[--text-secondary]">
                Every room chooses its own AI posture: stay completely out, answer strictly on @ai, or
                follow the discussion.
              </p>
            </div>

            <AiModeDemo />
          </div>
        </section>

        {/* ===================================================================
            SECTION 5: ATTACHMENTS & VISION
            =================================================================== */}
        <section className="border-t border-[--border-subtle] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--accent-text]">
                Private Attachments & Vision
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-4xl">
                Drop in an image. Ask about what&apos;s in it.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[--text-secondary]">
                Files are stored in private buckets and delivered with time-limited signed URLs. Multimodal
                vision lets AI analyze diagrams and screenshots securely.
              </p>
            </div>

            <VisionDemo />
          </div>
        </section>

        {/* ===================================================================
            SECTION 6: TRUST & SECURITY
            =================================================================== */}
        <section id="security" className="border-t border-[--border-subtle] bg-[--bg-elevated] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-[1200px]">
            <div className="mx-auto mb-14 max-w-2xl text-center">
              <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--success]">
                Trust & Architecture
              </p>
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-4xl">
                Access is enforced in the database.
              </h2>
              <p className="mt-3 text-[15px] leading-relaxed text-[--text-secondary]">
                Row-Level Security on every table guarantees that non-members cannot read messages or
                manipulate rooms, even if client code is bypassed.
              </p>
            </div>

            <TrustDiagram />
          </div>
        </section>

        {/* ===================================================================
            SECTION 7: CHANGELOG TEASER
            =================================================================== */}
        <section className="border-t border-[--border-subtle] px-5 py-20 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-[960px] rounded-[--r-xl] border border-[--border] bg-[--surface] p-6 shadow-[--shadow-2] sm:p-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-[--accent-subtle] px-2.5 py-0.5 text-[11.5px] font-semibold text-[--accent-text]">
                    Latest Release
                  </span>
                  <span className="text-[12.5px] text-[--text-muted]">{RELEASE_DATE}</span>
                </div>
                <h3 className="mt-2 text-[20px] font-semibold text-[--text-primary]">
                  {RELEASE_NAME}
                </h3>
                <p className="mt-1 text-[14px] text-[--text-secondary]">
                  A complete redesign with precision typography, calibrated WCAG 2.2 AA contrast, tactile
                  composer controls, and a clearer AI participation experience.
                </p>
              </div>

              <Button asChild href="/changelog" variant="secondary" className="shrink-0 self-start sm:self-auto">
                Read release notes
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </section>

        {/* ===================================================================
            SECTION 8: FINAL CTA
            =================================================================== */}
        <section className="border-t border-[--border-subtle] bg-[--bg-elevated] px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-5xl">
              Start your first room.
            </h2>
            <p className="mt-4 text-[16px] text-[--text-secondary]">
              Free to try. AI joins only when you say so.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild href="/signup" size="lg" className="rounded-[--r-md] px-8">
                Get started
                <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
              <Button asChild href="/login" variant="ghost" size="lg" className="rounded-[--r-md] px-6">
                Sign in
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* ===================================================================
          SECTION 9: FOOTER
          =================================================================== */}
      <footer className="border-t border-[--border-subtle] bg-[--bg-page] px-5 py-12 sm:px-8">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo size={24} />
            <span className="text-[15px] font-semibold tracking-[-0.02em] text-[--text-primary]">
              Confluence
            </span>
            <span className="text-[12px] text-[--text-muted]">· {VERSION_LABEL}</span>
          </div>

          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13.5px] text-[--text-secondary]">
            <a href="#product" className="transition-colors hover:text-[--text-primary]">
              Product
            </a>
            <a href="#how" className="transition-colors hover:text-[--text-primary]">
              How it works
            </a>
            <a href="#security" className="transition-colors hover:text-[--text-primary]">
              Security
            </a>
            <Link href="/changelog" className="transition-colors hover:text-[--text-primary]">
              Changelog
            </Link>
            <Link href="/login" className="transition-colors hover:text-[--text-primary]">
              Sign in
            </Link>
          </nav>
        </div>

        <div className="mx-auto mt-8 max-w-[1200px] border-t border-[--border-subtle] pt-6 text-center text-[12px] text-[--text-muted]">
          <p>© {new Date().getFullYear()} Confluence. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}