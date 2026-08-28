# Security, performance & accessibility audit (MU G)

A **verifiable** audit of the current `main` (`d9cacc1`). Every claim below is
either measured in this repo or explicitly marked as **not measured here** with
the reason. No number is asserted without a source.

## Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Secrets in the tree | ✅ clean | `SECURITY.md` + gitleaks default-ruleset scan (0 hits) |
| Markdown XSS | ✅ safe | `react-markdown` without `rehypeRaw`; escaped; `rel="noopener noreferrer"` |
| Authorization / RLS | ✅ | policies present; audit tables locked to `service_role` |
| Moderation fails closed | ✅ | `tests/moderation-fail-closed.test.ts`; spec §9/§11 |
| Training consent | ✅ | unanimous opt-in gate |
| WCAG AA text/UI contrast | ✅ measured | `scripts/contrast.mjs` — **44/44 pairs pass**, exit 0 |
| Component a11y (axe) | ✅ measured | `tests/a11y/components.axe.test.tsx` — **10 tests, 0 violations** |
| App a11y (browser axe) | ✅ | `e2e/accessibility.spec.ts` (runs in CI once Playwright job enabled) |
| Client bundle size | ⚠️ measured (initial) | see below — first-load JS is a starting point, **Lighthouse not run** |
| Lighthouse / real-browser perf | ⛔ not measured here | needs a live deploy + browser; no fake numbers |
| Live backend load (k6) | ⛔ not measured | needs deployed Supabase; harness + thresholds in `load/k6/` |

## Accessibility — measured

- **Contrast (WCAG 1.4.3 / 1.4.11):** `node scripts/contrast.mjs` resolves the
  §6 semantic tokens in `:root` (light) and `.dark`, then validates every
  foreground/background pair. **PASS — 44 pairs checked** in both themes. Text
  pairs must be ≥4.5:1, non-text UI/graphics ≥3:1. Example verified pair:
  `warning on bg-app = 11.24:1` (dark), `danger on bg-app = 5.99:1`,
  `success on bg-app = 8.96:1`.
- **Component axe (WCAG AA, full ruleset):** `tests/a11y/components.axe.test.tsx`
  runs axe on the key components/screens (login/auth shell, etc.).
  **10 tests pass — 0 violations.**
- **Browser axe:** `e2e/accessibility.spec.ts` audits the real dashboard and
  chat in both themes with the full ruleset. **Status: implemented; executed in
  the GitHub Actions `e2e` job** (browser binaries are unreachable from this
  sandbox — documented in `Errors`).
- **Live-region correctness:** `StreamAnnouncer` batches streamed tokens into
  `aria-live="polite"` announcements (covered by unit tests) rather than
  announcing every token.
- **Reduced motion:** the global CSS disables non-essential motion under
  `prefers-reduced-motion`, and the offline banner collapses to an instant cut.

## Security — verified

See `SECURITY.md` for the full posture. Key verified points:
- The AI provider key is read **only** server-side in Edge Functions
  (`Deno.env.get(...)`); the browser sees only the public anon key.
- `SUPABASE_SERVICE_ROLE_KEY` is used **only** inside Edge Functions (bypasses
  RLS by design); never shipped to the client.
- RLS is enabled on every user-accessible table; membership enforced by
  `is_conversation_member()` / `is_conversation_admin()`.
- Markdown is rendered without `rehypeRaw` (raw HTML escaped, never executed);
  the only `dangerouslySetInnerHTML` is an inline, trusted theme script.
- Moderation fails closed (pre + post), and training routing requires unanimous
  opt-in.
- **Secret scan:** the only gitleaks finding was a synthetic identifier in a
  test fixture, which is intentionally there; a gitleaks default-ruleset port
  over all changed files reports **0 hits**.

## Performance — measured initial only

The `npm run build` produces:
- `.next/static` total: **1.69 MB** across 31 JS/CSS files (compressed delivery
  is lower; these are uncompressed on-disk sizes).
- **Largest chunk: ~276 kB** (the app shell, dominated by React + the Supabase
  client + the streaming/markdown stack); several ~150–250 kB chunks.

Flags for follow-up (not blockers, but real optimization opportunities):
- The Supabase JS client and the markdown/streaming runtime are the main
  contributors to the largest chunk. Consider route-level code-splitting for
  `react-markdown` (render only in the chat route) and lazy-loading heavier
  libraries off the first route.
- The app is split across the analytics and landing bundles already; the chat
  route is server-rendered on demand (`ƒ`), which is appropriate for a signed-in
  workspace.

**Not measured here:** Lighthouse scores, real field/CLS/INP, and time-to-first-
byte on a deployed host. These require a live deployment and a real browser —
they are intentionally not fabricated.

## Owner / config follow-ups (not code defects)

These are blocked on owner-held credentials or a `workflows`-permission push
(see `SECURITY.md`):
1. **Push `.github/workflows/ci.yml`** (Playwright `e2e` job + token-contrast
   step) and **bump** `actions/checkout@v4→v5` and `gitleaks/gitleaks-action@v2→v3`
   (the Node-20→24 merge causes intermittent gitleaks action crashes). One-time
   patch: `ci/patches/ci-playwright-and-contrast.patch`.
2. **Release secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID` (see `ci/README.md`).
3. **AI provider key**: `supabase secrets set AI_PROVIDER_API_KEY=sk-...`
   (server-side).
4. **Run the load test** against a live deploy and record numbers in
   `load/k6/README.md` (do not treat the thresholds as results).
