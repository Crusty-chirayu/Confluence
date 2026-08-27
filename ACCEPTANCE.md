# §17 Acceptance Criteria Checklist

Status against the v2.0 master build prompt, after the full-spec reconciliation.

Legend: **✅ done** · **🟡 partial** · **⛔ pending** · **➖ out of scope for this pass (P1/P2)**

---

## §17 deliverables

| # | Deliverable | Status | Notes |
|---|---|---|---|
| 1 | Scope/assumptions confirmation | ✅ | `README.md` + the reconciliation report in-thread |
| 2 | Architecture diagram, Realtime as platform of record | ✅ | `README.md` — no Redis/Gateway |
| 3 | Tokens implementing every §2 value, both themes | ✅ | `src/app/globals.css` |
| 4 | Route tree for every §3 screen, a11y from first draft | 🟡 | see §3 table |
| 5 | Edge Functions, key only via `Deno.env.get` | ✅ | verified: single read, never logged |
| 6 | Component tree using semantic tokens + §2.7 motion | ✅ | shared `src/lib/motion.ts` |
| 7 | One sample of each test type | 🟡 | unit + integration done (12 passing); E2E/k6 pending |
| 8 | `ci.yml` and `release-major.yml` in full | 🟡 | both written; see CI note |
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
| §2.6 contrast audit at 4.5:1 | ⛔ | needs axe-core run |
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
| Read receipts (P1) | ⛔ | `last_read_at` stored, not surfaced |
| Room settings + danger zone | ✅ | |
| Global search (P1) | 🟡 | full-text works; no sender/date filters |
| **Command palette (⌘K)** | ✅ | **added** — navigate/create/theme; search moved to ⌘/ |
| User settings (profile, theme, training toggle) | 🟡 | notifications / connected accounts / export-delete missing |
| File attachments (P1) | ⛔ | schema + bucket + policies ready; no UI |
| Admin analytics (P2) | ➖ | views exist |
| Empty / error / loading states | ✅ | skeletons, moderation notice, 404 |
| Offline / reconnecting banner | ⛔ | |

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
| Signed URLs for attachments | 🟡 | bucket private; no upload UI yet |
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
| axe-core in CI, merge-blocking | ⛔ | |
| Unit test sample | ✅ | `tests/utils.test.ts` + `stream-announcer.test.tsx`, 12 passing |
| Integration test (fail-closed) | ✅ | `tests/moderation-fail-closed.test.ts` |
| E2E Playwright, 3 journeys | ⛔ | browser download blocked in this sandbox |
| k6 50-member broadcast storm | ⛔ | |
| gitleaks | ✅ | wired into CI |
| `ci.yml` | ✅ | lint, typecheck, unit, deno check, fail-closed, gitleaks |
| `release-major.yml` | 🟡 | present as `ci/release.yml`; not yet tag-triggered on `v[0-9]+.0.0` |

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

1. **CI workflow location.** Both pipelines live in `ci/` rather than
   `.github/workflows/` because the GitHub App pushing this branch lacks the
   `workflows` permission. One `git mv` activates them — see `ci/README.md`.

2. **Fonts.** Inter and JetBrains Mono are declared but resolve to system
   fallbacks; Google Fonts is unreachable from the build sandbox. Self-host via
   `next/font/local` for production fidelity.

3. **Pricing is a landing section**, not the standalone P1 route.
