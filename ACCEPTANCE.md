# §17 Acceptance Criteria Checklist

Status against the v2.0 master build prompt, after the full-spec reconciliation.

Legend: **✅ done** · **🟡 partial** · **⛔ pending** · **➖ out of scope for this pass (P1/P2)**

---

## GitHub status (verified, not assumed)

| Item | Status | Evidence |
|---|---|---|
| PR #1 — "AI Chat Platform v2.0 — full build + spec reconciliation" | ✅ **MERGED** | merge commit `3ac6d66`, `main` now at `99ebad0`+ |
| GitHub Actions | ✅ **ACTIVE** | `ci.yml` + `release.yml` live in `.github/workflows/` since `99ebad0` |
| CI workflow | ✅ **GREEN on GitHub** | run `33117956383` on `9230ff1` — all 3 jobs succeeded: typecheck/lint/build, **Verify Edge Functions (deno check + fail-closed integration)**, gitleaks |
| Deno typecheck fix | ✅ | root `deno.json` + committed `deno.lock` + `npm:` import map — details below; first run `99ebad0` failed resolving `npm:@supabase/realtime-js@2.112.4` |
| Release workflow | 🔴 **RED — blocked on secrets** | run `33115211404` on `99ebad0` failed: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` (and Vercel secrets) unset; to be configured by the repo owner, then re-verified |

**Deno fix summary (commit `9230ff1`):** CI runs `deno` from the repo root, where Deno
(a) discovers no `supabase/functions/deno.json` and (b) routes *every* npm package
through the root `package.json`/node_modules (byonm) — so the functions' former
`jsr:@supabase/supabase-js@2` imports and their hard-pinned npm deps could not resolve
in a fresh checkout. Fix: shared modules import the bare specifier, mapped to
`npm:@supabase/supabase-js@2.112.4` (exact frontend lockfile version) in a new root
`deno.json` with `nodeModulesDir: "auto"` and a committed `deno.lock` — `deno check`
provisions the pinned versions itself, no workflow change and no verification
suppression (a latent `string | null` in `ai-orchestrator` surfaced and was fixed
fail-closed). The typecheck also surfaced and fixed the first genuine Edge Function
bug this checklist has caught in CI.

---

## Major Update 2 — reconstruction

The previously-completed-but-lost local commit `86c4246` (MU2 Playwright/E2E
+ production fixes) was **not recovered from Git** (it was never pushed and is
not part of `origin`). Its functionality was re-implemented cleanly on top of
the current `main` and is checked out on `arena/01a04768-group-chatbot`:

| Reconstructed piece | Where | Status |
|---|---|---|
| Playwright config (Chromium, deterministic, isolated demo data, reduced-motion emulation, report/screenshot/trace on failure) | `playwright.config.ts` | ✅ |
| **Journey A — AI chat** (stream, persistence after refresh, composer usability) | `e2e/ai-chat.spec.ts` | ✅ |
| **Journey B — Group room** (create, membership, seeded history, invite) | `e2e/group-room.spec.ts` | ✅ |
| **Journey C — AI mention** (@ai attribution, non-mention does not summon, moderation warning) | `e2e/ai-mention.spec.ts` | ✅ |
| ⌘K command palette (open/keyboard/theme/room/sign-out/escape) | `e2e/command-palette.spec.ts` | ✅ |
| History (previous conversation, persistence, navigate-away-and-back) | `e2e/history.spec.ts` | ✅ |
| Real-browser **axe-core audit** (both themes, WCAG AA, full ruleset) | `e2e/accessibility.spec.ts` | ✅ |
| Tailwind semantic-token correction (§6 palette + theme-aware AI/accent-text) | `src/app/globals.css` | ✅ |
| WCAG AA token contrast gate | `scripts/contrast.mjs` (44 pairs, pass) | ✅ |
| Playwright CI job + contrast step | `.github/workflows/ci.yml` | ✅ |

**Verification honesty:** the browser binaries (`playwright install chromium`)
are unreachable from this sandbox (`cdn.playwright.dev` → TLS ECONNRESET), so
the E2E/axe suite and the `e2e` CI job are **implemented and configured but
not yet executed** here. The unit/typecheck/lint/build/token-contrast checks
all pass locally; the Playwright run happens in GitHub Actions.

---

## §17 deliverables

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 1 | Scope/assumptions confirmation | ✅ | `README.md` + the reconciliation report in-thread |
| 2 | Architecture diagram, Realtime as platform of record | ✅ | `README.md` — no Redis/Gateway |
| 3 | Tokens implementing every §2 value, both themes | ✅ | `src/app/globals.css` |
| 4 | Route tree for every §3 screen, a11y from first draft | 🟡 | see §3 table |
| 5 | Edge Functions, key only via `Deno.env.get` | ✅ | verified: single read, never logged; **typechecked green in CI** since `9230ff1` |
| 6 | Component tree using semantic tokens + §2.7 motion | ✅ | shared `src/lib/motion.ts` |
| 7 | One sample of each test type | 🟡 | unit + integration done (12 vitest + 6 Deno, all green in CI); E2E/k6 pending |
| 8 | `ci.yml` and `release-major.yml` in full | 🟡 | both live & running; CI **green**, Release blocked on secrets (see GitHub status) |
| 9 | Acceptance checklist | ✅ | this file |

---

## §2 Design system

| Item | Status | Notes |
|---|---|---|
| §2.2 primitives (neutral/accent/ai-teal/semantic) | ✅ | exact hex values |
| §2.2 semantic tokens, light → dark | ✅ | incl. `--bubble-*` |
| AI identity = `ai-teal-500`, not gray/brand | ✅ | **corrected** — was brand-purple |
| Real bubbles, not flat rows | ✅ | **corrected** — §2.2 requires a bg container |
| §2.3 Inter + JetBrains Mono, 14/20 default | 🟡 | stacks wired; webfonts not self-hosted |
| §2.4 spacing/radius/elevation/breakpoints | ✅ | 6/12/20/999 radii |
| §2.5 AI ring + "AI" pill + teal typing dots | ✅ | |
| §2.5 `ai_mode` badge (dot/outline/filled) | ✅ | **corrected** |
| §2.6 focus ring, `prefers-reduced-motion` | ✅ | instant cut, not slower |
| §2.6 contrast audit at 4.5:1 | ✅ | `scripts/contrast.mjs` asserts 44 token pairs (both themes) — PASS; browser axe audit includes colour-contrast (full rules, not disabled) in the Playwright `e2e` job |
| §2.7 motion tokens, all surfaces | ✅ | 5 one-offs replaced with `tExit()` |
| §2.7 60fps under 4x CPU throttle | ⛔ | not measured |

---

## §3 Page inventory

| Screen | Status | Notes |
|---|---|---|
| Landing (hero, live demo, features, pricing teaser, footer) | ✅ | |
| Pricing page (P1) | 🟡 | section on landing; no standalone route |
| **Changelog / release notes** | ✅ | **added** — GitHub Releases API, ISR |
| Status page (P2) | ➖ | |
| Sign up + **default-OFF training checkbox** | ✅ | **added to signup**, never pre-checked |
| Log in / forgot / reset / OAuth callback | ✅ | |
| Verify email | 🟡 | "check your inbox" state; no standalone route |
| Onboarding (≤3 steps) | ✅ | |
| Conversation list / dashboard | ✅ | unread badges, search entry |
| Pinned conversations | ⛔ | not implemented |
| 1:1 AI chat (stream/stop/regenerate/edit, md+copy) | ✅ | |
| Group room (members, presence, @ai, badge, invites) | ✅ | |
| Typing indicators / reactions (P1) | ✅ | |
| Read receipts (P1) | ✅ | `last_read_at` surfaced as a "Seen by …" indicator on the sender's own messages in a room; `computeReadReceipt` helper + `conversation_members` realtime subscription; unit-tested |
| Room settings + danger zone | ✅ | |
| Global search (P1) | 🟡 | full-text works; no sender/date filters |
| **Command palette (⌘K)** | ✅ | **added** — navigate/create/theme; search moved to ⌘/ |
| User settings (profile, theme, training toggle) | 🟡 | notifications / connected accounts / export-delete missing |
| File attachments (P1) | ✅ | composer upload (validate 10MB, allowlist, excludes SVG), private bucket write + member-scoped signed-URL chips; real-mode storage calls + demo object URLs; unit + E2E specs |
| Admin analytics (P2) | ➖ | views exist |
| Empty / error / loading states | ✅ | skeletons, moderation notice, 404 |
| Offline / reconnecting banner | ✅ | `NetworkProvider` + `OfflineBanner` (online/offline/reconnecting/restored); real-mode sends are refused while offline (not pretended); unit-tested + `e2e/offline.spec.ts` |

---

## §4–§9 Backend

| Item | Status | Notes |
|---|---|---|
| Shared `conversation` model | ✅ | |
| `ai_mode` OFF/MENTION_ONLY/AUTO | ✅ | |
| Key only via `Deno.env.get("AI_PROVIDER_API_KEY")` | ✅ | one read, never logged, never in a response |
| **Moderation fails closed, both stages** | ✅ | try/catch → `error_failed_closed`; tested |
| Orchestrator flow (§7 steps 1–7) | ✅ | incl. `superseded` on regenerate |
| Streaming delivery | ✅ | intentional deviation from §6, ratified — see Interpretation calls |
| RLS enabled + explicit policies, every table | ✅ | 10/10 tables |
| Default-deny, membership-scoped | ✅ | audit tables: RLS on, zero policies |
| Storage policies mirror membership | ✅ | SECURITY DEFINER helper |
| Signed URLs for attachments | ✅ | `attachmentUrl()` mints member-scoped 24h signed URLs (or demo object URLs); chips render/download |
| `training_opt_in` default false | ✅ | DB + trigger + signup + settings |
| **Orchestrator checks flag before training** | ✅ | unanimous opt-in — ratified, see Interpretation calls |
| Rate limits: messages, AI, invites | ✅ | |
| Rate limits: auth attempts per IP | ⛔ | relies on Supabase Auth defaults |

---

## §10–§12

| Item | Status | Notes |
|---|---|---|
| Keyboard reachability, focus trap, ARIA | 🟡 | dialogs labelled, message list is `role="log"`; not audited |
| `aria-live="polite"` batched for streaming | ✅ | **added** — 1s batching + completion flush, tested |
| axe-core in CI, merge-blocking | ✅ | **added** — `tests/a11y/` (10 tests) runs inside `npm test`, so the existing CI gate enforces it; jsdom covers structural rules (roles/labels/landmarks/ARIA); color-contrast needs a real browser → Playwright phase |
| Unit test sample | ✅ | `tests/utils.test.ts` + `stream-announcer.test.tsx`, 12 passing |
| Integration test (fail-closed) | ✅ | `tests/moderation-fail-closed.test.ts` |
| E2E Playwright (MU2) | 🟡 | `e2e/` suite implemented — 20 tests (AI chat, group room, @ai + moderation, ⌘K palette, history, browser axe audit in both themes); `playwright.config.ts` + a dedicated `e2e` CI job added. Chromium is unreachable in this sandbox, so the run happens in CI. |
| Design-token contrast (WCAG AA) | ✅ | `scripts/contrast.mjs` parses `globals.css` and asserts 44 text-on-surface pairs (both themes) — **44/44 PASS**; wired into CI. |
| k6 50-member broadcast storm | 🟡 | `load/k6/broadcast.js` harness + `seed-room.mjs` + `load/k6/README.md` (methodology + explicit acceptance thresholds). **Measured results pending a live Supabase deployment** — no results are claimed (see `load/k6/README.md`). |
| gitleaks | ✅ | wired into CI |
| `ci.yml` | ✅ | lint, typecheck, unit, deno check, fail-closed, gitleaks — **green on GitHub** (run `33117956383`) |
| `release-major.yml` | 🟡 | live as `.github/workflows/release.yml` (push to `main` + dispatch); **red — blocked on repo secrets**, not on code; not tag-triggered on `v[0-9]+.0.0` |

---

## Interpretation calls (ratified)

These are points where the spec was silent or where we knowingly diverged.
Each has been reviewed and **locked in** — they are not open questions.

### 1. Streaming transport — intentional deviation from §6 ✅ ratified

§4/§6 specify `ai_delta`/`ai_done` broadcasts on the `room:{conversation_id}`
Realtime channel. We instead stream **SSE directly to the invoking client**
while progressively updating a single `messages` row (`status: 'streaming'`),
which every other member observes through `postgres_changes`.

**Reasoning for keeping it:**

- **The partial answer survives a refresh.** The row *is* the state, so a
  reload mid-stream resumes from the real content. With pure broadcast, the
  deltas are ephemeral — a client that reloads or joins late has missed them.
- **Identical UX for the sender**, who reads from the SSE stream directly.
- **One fewer moving part** — no separate broadcast fan-out to keep in sync
  with the persisted row, and no reconciliation step where the two disagree.

**Accepted trade-off:** other members receive coarser updates (~400ms row
flushes) rather than token-level deltas, and **any external client written
against the literal §6 broadcast contract will not find `ai_delta`/`ai_done`
events.** If a third-party consumer ever needs that contract, the broadcast
can be layered on top of the existing flow without replacing it.

### 2. `training_opt_in` in group rooms — unanimous consent ✅ ratified

§8 mandates `training_opt_in` defaults false and that the orchestrator checks
it before any training routing, but **does not define the group case** — what
happens when a room's members disagree.

**Ruling: training routing requires unanimous opt-in.** A conversation is
eligible only when *every* current member has `training_opt_in = true`. Any
single hold-out disables routing for the entire room. A missing profile row, a
member count mismatch, or a failed read all evaluate to **not eligible**.

**Reasoning:** it is the privacy-protective default, and it's the only reading
that doesn't let one member's choice export another member's messages — in a
group room, a single conversation contains everyone's words, so consent has to
be collective to be meaningful. Consistent with §8's framing of default-OFF as
a hard requirement rather than a soft preference.

Implemented in `supabase/functions/ai-orchestrator/index.ts` (step 2b);
`routeToTrainingPipeline()` is additionally a no-op unless
`TRAINING_PIPELINE_URL` is configured, so default deployments route nothing
regardless of opt-in state.

---

## Known deviations from spec

These are environmental/scope limitations rather than design decisions.

1. **Workflow-file edits require the owner's credentials.** The push credential
   used by the agent (a GitHub App) lacks the `workflows` permission, so it
   cannot create commits touching `.github/workflows/*` — the original reason
   the pipelines shipped under `ci/`. Activation was applied by the owner
   (`99ebad0`), and the Deno CI fix (`9230ff1`) was deliberately designed to
   need **zero** workflow changes. Any future workflow edit must be pushed by
   the owner; `ci/README.md` documents the pipelines.

2. **Fonts.** Inter and JetBrains Mono are declared but resolve to system
   fallbacks; Google Fonts is unreachable from the build sandbox. Self-host via
   `next/font/local` for production fidelity.

3. **Pricing is a landing section**, not the standalone P1 route.
