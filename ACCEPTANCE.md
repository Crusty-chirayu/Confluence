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
| 7 | One sample of each test type | 🟡 | unit + integration done; E2E/k6 pending |
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
| Streaming delivery | 🟡 | **deviation**: SSE + row updates, not `ai_delta` broadcast (see below) |
| RLS enabled + explicit policies, every table | ✅ | 10/10 tables |
| Default-deny, membership-scoped | ✅ | audit tables: RLS on, zero policies |
| Storage policies mirror membership | ✅ | SECURITY DEFINER helper |
| Signed URLs for attachments | 🟡 | bucket private; no upload UI yet |
| `training_opt_in` default false | ✅ | DB + trigger + signup + settings |
| **Orchestrator checks flag before training** | ✅ | **added** — unanimous opt-in required |
| Rate limits: messages, AI, invites | ✅ | |
| Rate limits: auth attempts per IP | ⛔ | relies on Supabase Auth defaults |

---

## §10–§12

| Item | Status | Notes |
|---|---|---|
| Keyboard reachability, focus trap, ARIA | 🟡 | dialogs labelled; not audited |
| `aria-live="polite"` batched for streaming | ⛔ | **not implemented** |
| axe-core in CI, merge-blocking | ⛔ | |
| Unit test sample | ✅ | `tests/utils.test.ts`, 7 passing |
| Integration test (fail-closed) | ✅ | `tests/moderation-fail-closed.test.ts` |
| E2E Playwright, 3 journeys | ⛔ | browser download blocked in this sandbox |
| k6 50-member broadcast storm | ⛔ | |
| gitleaks | ✅ | wired into CI |
| `ci.yml` | ✅ | lint, typecheck, unit, deno check, fail-closed, gitleaks |
| `release-major.yml` | 🟡 | present as `ci/release.yml`; not yet tag-triggered on `v[0-9]+.0.0` |

---

## Known deviations from spec

1. **Streaming transport.** §4/§6 specify `ai_delta`/`ai_done` broadcast on the
   `room:{id}` Realtime channel. I stream **SSE directly to the caller** while
   progressively updating one `messages` row, which other members observe via
   `postgres_changes`. Same UX, one fewer moving part, and the partial answer
   survives a refresh — but it is **not** the specified transport, and it means
   non-invoking members see slightly coarser updates (~400ms flushes) than the
   token-level `ai_delta` the spec implies. Worth aligning if the broadcast
   contract matters to other clients.

2. **CI workflow location.** Both pipelines live in `ci/` rather than
   `.github/workflows/` because the GitHub App pushing this branch lacks the
   `workflows` permission. One `git mv` activates them — see `ci/README.md`.

3. **Fonts.** Inter and JetBrains Mono are declared but resolve to system
   fallbacks; Google Fonts is unreachable from the build sandbox. Self-host via
   `next/font/local` for production fidelity.

4. **Pricing is a landing section**, not the standalone P1 route.
