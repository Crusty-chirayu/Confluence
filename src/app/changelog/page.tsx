import type { Metadata } from "next";
import Link from "next/link";
import { Tag } from "lucide-react";
import { LandingNav } from "@/components/landing/nav";
import { Reveal, RevealItem, SectionHeading } from "@/components/landing/section";
import { Logo } from "@/components/logo";
import { Markdown } from "@/components/chat/markdown";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Release notes for the AI chat platform, published from GitHub Releases.",
};

// §1: releases are the source of truth; regenerate hourly.
export const revalidate = 3600;

const REPO = process.env.NEXT_PUBLIC_GITHUB_REPO ?? "Crusty-chirayu/Group-Chatbot";

interface Release {
  id: number;
  name: string | null;
  tag_name: string;
  body: string | null;
  html_url: string;
  published_at: string | null;
  prerelease: boolean;
}

/** Shown when the GitHub API is unreachable or the repo has no releases yet. */
const FALLBACK: Release[] = [
  {
    id: 0,
    name: "AI chat platform v2.0",
    tag_name: "v2.0.0",
    published_at: null,
    html_url: `https://github.com/${REPO}/releases`,
    prerelease: false,
    body: [
      "### Added",
      "- 1:1 AI chat with streaming, stop, regenerate and edit",
      "- Group rooms with invites, roles, presence and typing indicators",
      "- Opt-in AI participation per room (`off` / `mention_only` / `auto`)",
      "- `@ai` mention autocomplete and a distinct teal identity for AI messages",
      "- Command palette (⌘K), cross-conversation search (⌘/), reactions",
      "- Two-stage moderation that fails closed, plus per-user rate limiting",
      "",
      "### Security",
      "- Row Level Security on every table, scoped to room membership",
      "- AI provider key confined to Edge Function secrets",
    ].join("\n"),
  },
];

async function getReleases(): Promise<{ releases: Release[]; live: boolean }> {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=20`, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      next: { revalidate },
    });
    if (!res.ok) return { releases: FALLBACK, live: false };
    const data = (await res.json()) as Release[];
    if (!Array.isArray(data) || data.length === 0) return { releases: FALLBACK, live: false };
    return { releases: data, live: true };
  } catch {
    return { releases: FALLBACK, live: false };
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "Unreleased";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function ChangelogPage() {
  const { releases, live } = await getReleases();

  return (
    <div className="min-h-dvh bg-[--bg-app]">
      <LandingNav />

      <main className="px-5 pb-24 pt-32 sm:pt-40">
        <Reveal className="mx-auto max-w-3xl">
          <SectionHeading
            eyebrow="Changelog"
            title="What's new"
            subtitle="Published automatically from GitHub Releases on every tagged version."
          />

          {!live && (
            <RevealItem>
              <p className="mx-auto mt-8 max-w-xl rounded-[--r-lg] border border-[--border-default] bg-[--bg-surface] px-4 py-3 text-center text-[12.5px] leading-relaxed text-[--text-secondary]">
                Showing the bundled release notes — no published GitHub Releases were found for{" "}
                <code className="font-mono">{REPO}</code>. Tag a version and this page fills in
                automatically.
              </p>
            </RevealItem>
          )}

          <div className="mt-14 space-y-10">
            {releases.map((r) => (
              <RevealItem key={r.id}>
                <article className="relative border-l-2 border-[--border-default] pl-6 sm:pl-8">
                  <span
                    className="absolute -left-[7px] top-1.5 grid h-3 w-3 place-items-center rounded-full bg-[--brand] ring-4 ring-[--bg-app]"
                    aria-hidden
                  />

                  <header className="mb-4">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <h2 className="text-[18px] font-semibold tracking-tight text-[--text-primary]">
                        {r.name || r.tag_name}
                      </h2>
                      <span className="inline-flex items-center gap-1 rounded-[--r-pill] bg-[--bg-hover] px-2 py-0.5 font-mono text-[11px] text-[--text-secondary]">
                        <Tag className="h-3 w-3" />
                        {r.tag_name}
                      </span>
                      {r.prerelease && (
                        <span className="rounded-[--r-pill] bg-[--warning-subtle] px-2 py-0.5 text-[11px] font-semibold text-[--warning]">
                          Pre-release
                        </span>
                      )}
                    </div>
                    <time
                      className="mt-1 block text-[12.5px] text-[--text-secondary]"
                      dateTime={r.published_at ?? undefined}
                    >
                      {formatDate(r.published_at)}
                    </time>
                  </header>

                  <div className="text-[14px] text-[--text-primary]">
                    {r.body?.trim() ? (
                      <Markdown content={r.body} />
                    ) : (
                      <p className="text-[--text-secondary]">No release notes for this version.</p>
                    )}
                  </div>

                  {live && (
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-[13px] font-medium text-[--brand] hover:underline"
                    >
                      View on GitHub →
                    </a>
                  )}
                </article>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </main>

      <footer className="border-t border-[--border-default] px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="text-[13.5px] font-semibold">Confluence</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[--text-secondary]">
            <Link href="/" className="hover:text-[--text-primary]">
              Home
            </Link>
            <Link href="/changelog" className="hover:text-[--text-primary]">
              Changelog
            </Link>
            <Link href="/login" className="hover:text-[--text-primary]">
              Sign in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
