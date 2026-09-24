import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Tag } from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { Logo } from "@/components/logo";
import { VERSION, VERSION_LABEL, RELEASE_NAME, RELEASE_DATE } from "@/lib/version";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Product updates, release notes, and improvements shipped to Confluence.",
};

interface ChangelogEntry {
  version: string;
  label: string;
  name: string;
  date: string;
  summary: string;
  isLatest?: boolean;
  newItems?: string[];
  improvedItems?: string[];
  fixedItems?: string[];
}

const RELEASES: ChangelogEntry[] = [
  {
    version: VERSION,
    label: VERSION_LABEL,
    name: RELEASE_NAME,
    date: RELEASE_DATE,
    summary:
      "A complete redesign of the user experience with restrained typography, disciplined 4px spacing, unified light/dark color systems, document-like message timelines, tactile composer controls, and a clearer AI participation model.",
    isLatest: true,
    newItems: [
      "Separately designed Light and Dark themes with programmatic WCAG 2.2 AA contrast compliance across all surfaces.",
      "Vertical timeline message experience replacing bubbly chat layouts with calm, document-like readability surfaces.",
      "Tactile composer featuring auto-growing textarea, instant mode status, keyboard send shortcuts, and attachment drag previews.",
      "Three-posture AI mode selector with distinct visual indicators for Off, Mention only, and Always on.",
      "Unified modal and sheet system with exact-name confirmation gating for destructive room deletions.",
    ],
    improvedItems: [
      "Rebuilt landing page centered around an interactive live product preview, segmented mode demos, and verified trust boundaries.",
      "Streamlined application shell with a 280px sidebar, 56px sticky chat header, and responsive drawer navigation.",
      "Strict keyboard accessibility with roving tabindex, dialog focus trapping, and polite ARIA announcements for streaming text.",
      "Clear loading skeletons and human error cards providing direct recovery steps rather than raw error codes.",
    ],
    fixedItems: [
      "Eliminated layout shifts during message streaming and sidebar toggling across mobile and desktop breakpoints.",
      "Prevented accidental double-click room deletions via responsive debouncing and focus-safe dialogs.",
    ],
  },
  {
    version: "2.0.0",
    label: "v2.0",
    name: "v2.0 — group rooms with opt-in AI",
    date: "January 2026",
    summary:
      "Introduced multi-member collaborative group rooms with configurable AI participation postures, invites, and presence tracking.",
    isLatest: false,
    newItems: [
      "Group rooms with invite codes, member roles (owner, admin, member), and presence tracking.",
      "Per-room AI participation modes allowing teams to choose when AI listens and replies.",
      "@ai mention autocomplete for targeted AI invocation.",
      "Two-stage moderation and per-user rate limiting persisted in Postgres.",
    ],
    improvedItems: [
      "Database access enforced via Row-Level Security on all room and message tables.",
      "Private storage bucket access for attachments with signed URLs.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="relative min-h-dvh bg-[--bg-page] text-[--text-primary]">
      <LandingNav />

      <main className="px-5 pb-24 pt-28 sm:px-8 sm:pt-36">
        <div className="mx-auto max-w-[800px]">
          {/* Header */}
          <div className="mb-12">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[--text-muted] transition-colors hover:text-[--text-primary]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to home</span>
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[--text-primary] sm:text-4xl">
              Changelog
            </h1>
            <p className="mt-2 text-[15px] text-[--text-secondary]">
              Product releases, design updates, and architectural improvements.
            </p>
          </div>

          {/* Merge Motif Timeline Spine (Section 41) */}
          <div className="relative border-l border-[--border-subtle] pl-6 sm:pl-8 space-y-12">
            {RELEASES.map((r) => (
              <article key={r.version} className="relative">
                {/* Timeline node */}
                <span
                  className="absolute -left-[31px] top-1.5 grid h-4 w-4 place-items-center rounded-full border border-[--border] bg-[--bg-page] sm:-left-[39px]"
                  aria-hidden
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      r.isLatest ? "bg-[--accent]" : "bg-[--text-muted]"
                    }`}
                  />
                </span>

                <div
                  className={`rounded-[--r-xl] border p-6 sm:p-8 transition-colors ${
                    r.isLatest
                      ? "border-[--accent]/30 bg-[--surface-elevated] shadow-[--shadow-2]"
                      : "border-[--border-subtle] bg-[--surface]"
                  }`}
                >
                  <header className="mb-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[--border-subtle] bg-[--surface] px-2.5 py-0.5 text-[12px] font-mono text-[--text-primary]">
                        <Tag className="h-3 w-3 text-[--text-muted]" />
                        {r.label}
                      </span>
                      {r.isLatest && (
                        <span className="rounded-full bg-[--accent-subtle] px-2.5 py-0.5 text-[11px] font-semibold text-[--accent-text]">
                          Latest
                        </span>
                      )}
                      <time className="text-[12.5px] text-[--text-muted]">{r.date}</time>
                    </div>

                    <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.01em] text-[--text-primary]">
                      {r.name}
                    </h2>
                    <p className="mt-1.5 text-[14px] leading-relaxed text-[--text-secondary]">
                      {r.summary}
                    </p>
                  </header>

                  {r.isLatest ? (
                    <div className="mt-6 space-y-6 border-t border-[--border-subtle] pt-6">
                      {r.newItems && r.newItems.length > 0 && (
                        <div>
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[--accent-text]">
                            New
                          </h3>
                          <ul className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-[--text-secondary]">
                            {r.newItems.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--accent]" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {r.improvedItems && r.improvedItems.length > 0 && (
                        <div>
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[--ai]">
                            Improved
                          </h3>
                          <ul className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-[--text-secondary]">
                            {r.improvedItems.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--ai]" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {r.fixedItems && r.fixedItems.length > 0 && (
                        <div>
                          <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[--success]">
                            Fixed
                          </h3>
                          <ul className="mt-2.5 space-y-2 text-[13.5px] leading-relaxed text-[--text-secondary]">
                            {r.fixedItems.map((item, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--success]" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <details className="mt-4 border-t border-[--border-subtle] pt-4 text-[13.5px]">
                      <summary className="cursor-pointer font-medium text-[--text-secondary] hover:text-[--text-primary] select-none">
                        Show release details
                      </summary>
                      <div className="mt-4 space-y-4 pl-2">
                        {r.newItems && (
                          <div>
                            <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
                              Added
                            </h4>
                            <ul className="mt-1.5 space-y-1.5 text-[13px] text-[--text-secondary]">
                              {r.newItems.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--text-muted]" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {r.improvedItems && (
                          <div>
                            <h4 className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
                              Security & Architecture
                            </h4>
                            <ul className="mt-1.5 space-y-1.5 text-[13px] text-[--text-secondary]">
                              {r.improvedItems.map((item, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[--text-muted]" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </main>

      <footer className="border-t border-[--border-subtle] bg-[--bg-page] px-5 py-8 sm:px-8">
        <div className="mx-auto flex max-w-[800px] items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={24} />
            <span className="text-[13px] font-semibold text-[--text-primary]">Confluence</span>
            <span className="text-[12px] text-[--text-muted]">· {VERSION_LABEL}</span>
          </div>
          <p className="text-[12px] text-[--text-muted]">
            © {new Date().getFullYear()} Confluence. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}