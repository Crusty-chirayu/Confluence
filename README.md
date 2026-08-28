# Confluence — AI Chat Platform (v2.0)

A ChatGPT/Discord hybrid: **private 1:1 AI chat** plus **opt-in AI participation inside multi-user group rooms**, sharing a single conversation model.

Built per the v2.0 master build prompt: Next.js 16 (App Router) + TypeScript + Tailwind v4 on the front, Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) on the back, Anthropic Messages API for streaming inference.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:3000
```

With no environment variables set, the app boots into **demo mode** — an in-browser store with seeded conversations and a locally simulated streaming assistant. Every screen is explorable without a backend.

### Connecting a real Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase_schema.sql`](./supabase_schema.sql) in the SQL Editor (or `supabase db push`).
3. Dashboard → Authentication → enable **Email** and **Google** providers.
4. Set the frontend keys:

   ```bash
   cp .env.example .env.local
   # fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
   ```

5. Set the server-only secrets and deploy the functions:

   ```bash
   supabase secrets set AI_PROVIDER_API_KEY=sk-ant-...
   supabase functions deploy ai-orchestrator moderation-check invite-consume
   ```

6. Confirm RLS is ON for every table (shield icon in the Table Editor) before going to production.

---

## Architecture

```
Browser ──▶ Next.js (Vercel)
              │
              ├── @supabase/ssr ──▶ Postgres  ← RLS enforces membership
              │                     Realtime  ← postgres_changes + broadcast
              │                     Storage   ← avatars (public) / attachments (private)
              │
              └── fetch(SSE) ────▶ Edge Functions (Deno)
                                    ├── ai-orchestrator   ← holds the provider key
                                    ├── moderation-check
                                    └── invite-consume    ← service_role
                                          │
                                          └──▶ Anthropic Messages API (streaming)
```

**The AI provider key never reaches the browser.** The client calls `ai-orchestrator`, which streams SSE back while progressively updating one `messages` row — so every member of a group room watches the same answer appear at the same moment.

### Streaming lifecycle

1. Client inserts the human message (RLS: must be a member, `sender_type = 'human'`, `sender_id = auth.uid()`).
2. Client calls `ai-orchestrator`.
3. Function verifies membership → rate limits → **pre-moderates** the trigger message.
4. Inserts a placeholder AI row with `status: 'streaming'`.
5. Streams from Anthropic; forwards SSE deltas to the caller and flushes the row every ~400ms.
6. **Post-moderates** the finished output. Pass → `status: 'sent'`. Fail → content redacted, `status: 'blocked'`.
7. Logs tokens and latency to `ai_usage_log`.

`regenerate()` reruns step 3 onward with `supersedes_id` set; the previous answer becomes `status: 'superseded'` and drops out of the view without being destroyed.

---

## Security model

| Concern | Enforcement |
| --- | --- |
| Who can read a conversation | RLS `is_conversation_member()` on `conversations`, `messages`, `reactions`, `message_attachments` |
| Who can administer a room | RLS `is_conversation_admin()` — owner/admin only |
| Audit tables | RLS **enabled with zero policies** → unreachable from `anon`/`authenticated`; only `service_role` |
| AI provider key | Only ever in the Edge Function environment |
| Invite redemption | `invite-consume` (service_role) — the client has no RLS path to an invite for a room it hasn't joined |
| Moderation | Two stages (`pre`, `post`), **fails closed** — a classifier error blocks publication |
| Rate limiting | Fixed-window counters in `rate_limit_events`: 30 msg/min, 10 AI calls/min, 20 invites/hr |
| Attachments | Private bucket, storage policies call the same membership check |
| Training data | `profiles.training_opt_in`, off by default |

The client-side classifier in `src/lib/data/moderation-local.ts` is a **UX affordance only** — it warns before you send. The authoritative check always runs server-side.

---

## Motion system (§2.7)

Every animation is driven by tokens in [`src/lib/motion.ts`](./src/lib/motion.ts) — no ad hoc per-component timings.

- **Durations** — `120ms` micro, `200ms` standard, `320ms` emphasis, `480ms` hero.
- **Easing** — `cubic-bezier(0.16, 1, 0.3, 1)` entering, `cubic-bezier(0.7, 0, 0.84, 0)` exiting.
- **Transform/opacity only** — never `width`/`height`/`top`/`left`.
- **Exit is always faster than entry.**
- **`prefers-reduced-motion`** collapses every animation to an instant cut (not a slower version) via a global override in `globals.css`.

Highlights: staggered scroll reveals on the landing page, hero parallax, blurred-glass nav after 40px, `layout` animation for conversation-list reordering, streaming reveal with a blinking caret (no per-token effects — that's visually noisy at speed), staggered-pulse typing dots, reactions popping in on an overshoot spring, sun↔moon rotate-and-fade theme morph with a 200ms surface crossfade, skeleton shimmer wherever content has a predictable shape (spinners only where it doesn't), toasts with a visible shrinking dismissal bar, and an accessible offline / reconnecting / restored banner that collapses to an instant cut under `prefers-reduced-motion`.

Destructive confirms use a **debounce with a visual tell** — clicking the confirm button within 450ms of the dialog opening shakes it instead of silently swallowing the click.

---

## Page inventory

| Route | Purpose |
| --- | --- |
| `/` | Landing — hero with a live animated demo, features, how-it-works, security, pricing |
| `/login`, `/signup` | Email + Google auth, inline validation, password strength, in-place success states |
| `/forgot-password`, `/reset-password` | Recovery flow |
| `/auth/callback` | OAuth / magic-link code exchange |
| `/onboarding` | 3-step: profile & training opt-in → theme → first conversation |
| `/app` | Dashboard — greeting, quick actions, starter prompts |
| `/app/c/[id]` | Chat surface — 1:1 and group, streaming, reactions, edit, regenerate |
| `/app/settings` | Profile, appearance, privacy & data, account |
| `/join/[code]` | Invite redemption |

Room settings (name, topic, AI mode, members, roles, invites, danger zone) live in a modal on the chat surface.

---

## Project layout

```
src/
  app/                      routes (App Router)
  components/
    ui/                     button, input, modal, toast, avatar, skeleton
    chat/                   chat-view, composer, message-item, markdown, room-settings
    layout/                 sidebar, search / join / new-conversation modals
    landing/                nav, hero-demo, section primitives
    theme-provider.tsx      light/dark/system + morphing toggle
    session-provider.tsx    auth state, works in both modes
    network-provider.tsx    online/offline/reconnecting state (§27)
    offline-banner.tsx      accessible offline / restored banner
  lib/
    motion.ts               §2.7 motion tokens — single source of truth
    data/api.ts             unified data layer (Supabase ⟷ demo)
    data/demo-store.ts      in-browser Supabase stand-in
    supabase/               browser + server clients
supabase/
  functions/                ai-orchestrator, moderation-check, invite-consume
  migrations/               versioned copy of the schema
supabase_schema.sql         the complete, runnable database layer
```

---

## CI/CD — "push everything" release policy (§1)

- **[`.github/workflows/ci.yml`](./.github/workflows/ci.yml)** — live; on every push/PR: typecheck, lint, unit tests, token-contrast, build, plus `deno check` on all three Edge Functions, the moderation fail-closed integration test, a gitleaks secret scan, and a dedicated **Playwright E2E + browser axe job** (`e2e`).
- **[`.github/workflows/release.yml`](./.github/workflows/release.yml)** — live; on push to `main`, in strict dependency order: **migrations → Edge Functions → frontend**. A partial deploy is treated as a failed deploy.

> Both workflows were initially shipped under [`ci/`](./ci) (the original push credential
> lacked the `workflows` permission) and were activated into `.github/workflows/` once
> that was resolved. They now live **only** there — [`ci/README.md`](./ci/README.md) is
> the documentation for them (jobs, Deno configuration contract, required secrets).

Edge Function type-checking uses two synchronized Deno configs — the root
[`deno.json`](./deno.json) (applied when CI runs `deno` from the repo root; provisions
npm deps from the committed [`deno.lock`](./deno.lock)) and
[`supabase/functions/deno.json`](./supabase/functions/deno.json) (applied when the
Supabase CLI bundles functions for deploy). Their `imports` must stay identical; see
the contract note in each file and in [`ci/README.md`](./ci/README.md).

Required repository secrets are listed in [`.env.example`](./.env.example) and [`ci/README.md`](./ci/README.md).

Audit & release docs:
- [`SECURITY.md`](./SECURITY.md) — secrets, RLS/authorization, input/output handling (XSS, fail-closed moderation, unanimous training consent), and the owner/config follow-ups.
- [`AUDIT.md`](./AUDIT.md) — the verifiable security / performance / accessibility audit (measurable numbers, nothing fabricated).
- [`RELEASING.md`](./RELEASING.md) — the owner-run release checklist (server secrets, CI activation + action bumps, release secrets, db push + function deploy, verification).

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run start    # serve the build
npm run lint     # eslint
npx tsc --noEmit # typecheck
npm test         # unit + component + a11y (axe-core) suites
npm run test:a11y  # vitest axe-core accessibility suite (jsdom, structural)
npm run test:edge  # Deno moderation fail-closed integration test
npm run test:contrast  # WCAG AA token contrast against globals.css (no browser)
npm run test:e2e       # Playwright E2E + browser axe audit (needs Chromium)
npm run test:e2e:install  # download Chromium for the E2E suite
```

### End-to-end / browser accessibility

The Playwright suite (`e2e/`) runs the app in **demo mode** and covers the
critical journeys: AI chat streaming + persistence, group rooms, @ai mention
and moderation, ⌘K command palette, history, and a real-browser **axe-core
audit (light + dark, WCAG AA — not disabled)**. It targets stable selectors
(roles, labels, `data-testid`), emulates `prefers-reduced-motion`, and
produces a report + traces on failure.

```bash
npx playwright install --with-deps chromium  # one-time
npm run test:e2e
```

The token contrast script parses `src/app/globals.css`, resolves the semantic
tokens for both themes, and asserts every text-on-surface pair meets 4.5:1
(normal) / 3:1 (large & UI). It runs in CI and is a real, runnable substitute
for the browser contrast scan.
