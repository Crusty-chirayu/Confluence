# Security, performance & accessibility audit (MU G)

A **verifiable** audit. Every claim below is either measured in this repo or
explicitly marked as **not measured here** with the reason. No number is
asserted without a source.

> **Re-run 2026-08-28 on `main` `c2cb9eb` + the final-completion branch
> (`arena/01a04990-group-chatbot`).** Numbers below are from that run. The
> security section gained six findings that were **not** in the original audit
> and are now fixed; see "Security — this pass".
>
> **Re-run 2026-09-18 for the V3 Attachment Understanding pass.** Deno became
> runnable in this environment, so the Edge Function gates that were previously
> reported as "not run" have been executed; they found a production-breaking
> defect in PDF extraction. Current numbers and findings are in
> "V3 Attachment Understanding — verified 2026-09-18" and in the updated
> `Errors` table. Anything still dated 2026-08-28 is from that earlier run. 

## Summary

| Area | Status | Evidence |
| --- | --- | --- |
| Secrets in the tree | ✅ clean | `SECURITY.md` + gitleaks default-ruleset scan (0 hits) |
| Authorization / RLS holes found **this pass** | ✅ 6 fixed | membership bypass, self role escalation, assistant impersonation, profile enumeration, unscoped reactions, open redirect — see below |
| Markdown XSS | ✅ safe | `react-markdown` without `rehypeRaw`; escaped; `rel="noopener noreferrer"` |
| Authorization / RLS | ✅ | policies present; audit tables locked to `service_role` |
| Moderation fails closed | ✅ | `tests/moderation-fail-closed.test.ts`; spec §9/§11 |
| Training consent | ✅ | unanimous opt-in gate |
| WCAG AA text/UI contrast | ✅ measured | `scripts/contrast.mjs` — **54/54 pairs pass**, exit 0 |
| Component a11y (axe) | ✅ measured | `tests/a11y/components.axe.test.tsx` — **13 tests, 0 violations** |
| Keyboard / focus behaviour | ✅ measured | `tests/keyboard-focus.test.tsx` — **15 tests** (focus in/trap/restore, combobox wiring, live regions) |
| App a11y (browser axe) | ⛔ **not run here** | `e2e/accessibility.spec.ts` exists and the CI `e2e` job runs it, but **no Chromium is obtainable in this sandbox** — and that CI job is currently **failing**, see `Errors` |
| PDF extraction (V3) | ✅ measured 2026-09-18 | `tests/pdf-extraction.test.ts` — **4 tests** against the real `pdfjs-dist@4.8.69`. Broken until this pass: `workerSrc = false` failed every PDF |
| `deno check` on all four Edge Functions | ✅ run 2026-09-18 | passes including under `--frozen`, Deno's default when `CI=true` |
| V3 retrieval SQL / RLS execution | ⛔ **not run** | no PostgreSQL or Supabase CLI in the sandbox; static review only |
| Frame budget under 4× CPU throttle | 🟡 harness only | `e2e/perf.spec.ts` — written, never executed |
| Client bundle size | ⚠️ measured (initial) | see below — first-load JS is a starting point, **Lighthouse not run** |
| Lighthouse / real-browser perf | ⛔ not measured here | needs a live deploy + browser; no fake numbers |
| Live backend load (k6) | ⛔ not measured | needs deployed Supabase; harness + thresholds in `load/k6/` |
| Fonts | ✅ measured | Inter + JetBrains Mono self-hosted and emitted under `/_next/static/media` by `next/font/local` (with derived `size-adjust` fallback metrics) |

## Accessibility — measured

- **Contrast (WCAG 1.4.3 / 1.4.11):** `node scripts/contrast.mjs` resolves the
  §6 semantic tokens in `:root` (light) and `.dark`, then validates every
  foreground/background pair. **PASS — 44 pairs checked** in both themes. Text
  pairs must be ≥4.5:1, non-text UI/graphics ≥3:1. Example verified pair:
  `warning on bg-app = 11.24:1` (dark), `danger on bg-app = 5.99:1`,
  `success on bg-app = 8.96:1`.
- **Component axe (WCAG AA, full ruleset):** `tests/a11y/components.axe.test.tsx`
  runs axe over the key components/screens — auth shell, message items,
  composer, modal, command palette, sidebar (incl. pinned rows), stream
  announcer, theme control. **13 tests pass — 0 violations.**
- **Keyboard / focus:** `tests/keyboard-focus.test.tsx`, **15 tests**. This
  pass found that `Modal` never moved focus at all — `aria-modal="true"` told
  assistive tech the page behind was inert while Tab happily walked into it.
  Focus is now moved in, wrapped at both edges, and restored to the trigger.
  The @mention popup gained combobox/listbox semantics and the moderation
  warning gained a live region; neither was visible to AT before.
- **Browser axe:** `e2e/accessibility.spec.ts` audits the public pages and the
  signed-in app surfaces in both themes with the full ruleset.
  **Status: implemented, never executed** — no Chromium in the sandbox and no
  `e2e` job in CI (documented in `Errors`).
- **Live-region correctness:** `StreamAnnouncer` batches streamed tokens into
  `aria-live="polite"` announcements (covered by unit tests) rather than
  announcing every token.
- **Reduced motion:** the global CSS disables non-essential motion under
  `prefers-reduced-motion`, and the offline banner collapses to an instant cut.

## Security — this pass (2026-08-28)

The previous audit recorded "Authorization / RLS ✅". Re-reading the policies
rather than trusting that line turned up six issues, all now fixed and all
reachable by an ordinary authenticated client:

| # | Issue | Impact | Fix |
|---|---|---|---|
| 1 | `conversation_members` INSERT permitted `user_id = auth.uid()` | **any user could join any conversation** by UUID — membership is the only authorization primitive, so this voided every other policy | INSERT is admin-only; rows come from `create_conversation()` / `invite-consume` |
| 2 | `conversation_members` UPDATE had no `WITH CHECK`, so Postgres reused its USING expression | **any member could set their own `role` to `owner`** | self-update policy pins `role` to its pre-update value; role changes need the admin policy |
| 3 | `messages` UPDATE had no `WITH CHECK` | an author could set `sender_type = 'ai'` — assistant impersonation inside a room | `with check (sender_id = auth.uid() and sender_type = 'human')` |
| 4 | `profiles` SELECT open to `auth.role() = 'authenticated'` | the whole user base was enumerable | narrowed to self + co-members |
| 5 | `reactions` INSERT checked only `user_id` | reactions (and therefore message existence) readable across conversations | requires `is_conversation_member()` on the message's conversation |
| 6 | `?next=` echoed into `router.push()` / `NextResponse.redirect()` | **open redirect** off `/login` — a convincing phishing hop | `safeInternalPath()` + 6 unit tests |

Also fixed: `messages_per_min` (30) and `invites_per_hour` (20) were documented
but **never enforced anywhere** — they are now `BEFORE INSERT` triggers, so they
hold on every write path, not just the Edge Function paths. `moderation-check`
had no limit at all and now has one (60/min). Edge Functions no longer return
provider or Postgres error text to callers.

**Not fixable in code (BLUE):** per-IP auth-attempt limiting (Supabase Auth /
edge configuration) and the `ALLOWED_ORIGINS=*` CORS default (an environment
secret). Both are documented in `SECURITY.md`.

## Security — verified

See `SECURITY.md` for the full posture. Key verified points:
- The AI provider key (`OPENROUTER_API_KEY`) is read **only** server-side in
  Edge Functions (`Deno.env.get(...)`); the browser sees only the public anon
  key. The orchestrator speaks OpenRouter's OpenAI-compatible Chat Completions
  API through the pure, unit-tested `_shared/provider.ts` translation layer.
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

**Not measured here:** Lighthouse scores, real field/CLS/INP, time-to-first-byte,
and frame timings under CPU throttling. These require a live deployment or a
real browser — they are intentionally not fabricated. A harness for the last one
exists (`e2e/perf.spec.ts`) and will produce its first numbers on the first CI
run of the `e2e` job.

## V3 Attachment Understanding — verified 2026-09-18

Findings from re-verifying V3 against the code rather than the design documents.
Full acceptance mapping is in [`ACCEPTANCE.md`](./ACCEPTANCE.md).

| # | Finding | Severity | Status |
|---|---|---|---|
| 1 | `GlobalWorkerOptions.workerSrc = false` in the PDF branch of `_shared/extract.ts`. pdf.js validates that setter and throws `Invalid workerSrc type`, so **every PDF upload failed extraction** and landed in the `failed` state | **High** — a headline supported format never worked | ✅ fixed; covered by `tests/pdf-extraction.test.ts` |
| 2 | The defect was invisible to every gate. Vitest aliases `npm:pdfjs-dist@4.8.69` to a stub, so the real initialization path never ran; and `attachment-processor` was absent from the `deno check` loop, so the one checker that could have seen it never looked | **High** — process gap, not just a bug | ✅ fixed; test added and the held CI patch extends the loop to all four functions |
| 3 | `types/pdfjs-deno.d.ts` was looser than the package it stands in for (`workerSrc: unknown`, `items` without the marked-content variant), so `tsc --noEmit` accepted what `deno check` rejected | Medium | ✅ fixed; shapes now mirror `pdfjs-dist@4.8.69` |
| 4 | Committed `deno.lock` predated the `pdfjs-dist` import and carried a stale peer resolution for `next`. Deno implies `--frozen` under `CI=true`, so the `edge-functions` job cannot self-heal a lockfile | Medium | ✅ regenerated and committed; all four functions pass `deno check --frozen` |

Retrieval was checked specifically for overclaiming, since that is the easiest
thing to get wrong here. It is **not** a fallback dressed up as semantic search:
`retrieve_attachment_chunks` runs a pgvector cosine leg and a PostgreSQL
full-text leg, joins them by chunk id and fuses them with reciprocal rank, and
each returned row reports `hybrid`, `vector` or `fts` for the method that
actually found it. Without `OPENAI_API_KEY` no embeddings are written, the
vector leg is skipped, and retrieval is lexical — degraded, and labelled as
such. The SQL has **not** been executed against a database (see `Errors`), so
this is a code-level verification, not a measured one.

Citations are likewise derived rather than trusted: `buildVerifiedCitations`
resolves what the model wrote against the chunks actually placed in the prompt
and drops anything unresolvable, and page numbers come from the extractor's own
`page_number`. A chunk can legitimately cite a page number greater than
`metadata.pageCount`, because `pageCount` counts pages *with content* and blank
pages are skipped — which is why labels must never be inferred from a chunk's
position. `tests/pdf-extraction.test.ts` asserts exactly that against a real
three-page PDF whose second page is blank.

## Owner / config follow-ups (not code defects)

These are blocked on owner-held credentials or a `workflows`-permission push
(see `SECURITY.md`):
1. ~~**Push `.github/workflows/ci.yml`** (Playwright `e2e` job + token-contrast
   step) and **bump** `actions/checkout@v4→v5` and `gitleaks/gitleaks-action@v2→v3`~~
   — **landed**; `ci/patches/ci-playwright-and-contrast.patch` no longer applies
   because its post-image is the committed file (see `ci/README.md`). The
   gitleaks job **failed on every `pull_request` run while passing on the `push`
   run of the identical tree** (verified 2026-08-28 on head `8032f07`, and on
   PR #11 before it) — a Node-20-on-24 action defect, not a secret finding; see
   `SECURITY.md` item 2 for the full evidence. **Still pending:** the
   `attachment-processor` workflow changes held at
   `ci/patches/ci-attachment-processor-workflows.patch`, which need a credential
   with the `workflows` permission.
2. **Release secrets**: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`,
   `SUPABASE_DB_PASSWORD`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`,
   `VERCEL_PROJECT_ID` (see `ci/README.md`). **This is blocking, not cosmetic —
   the `Release` workflow has never completed successfully.** Every run fails in
   10–16 s at the *first* Supabase step, `Link project`, before `Push
   migrations` is reached (runs 35365483554, 35358311900, 35253803794,
   35233911123, 35231085679 and further back — verified 2026-09-18). The
   credentials are the likely cause, but the secrets API returns `403 Resource
   not accessible by integration` for this credential, so that could not be
   confirmed. **Consequence: no V3 migration has ever been applied to a project
   and no Edge Function — including `attachment-processor` — has ever been
   deployed by the pipeline.** V3 is merged and verified as code; it is not
   live. The frontend still ships, because Vercel deploys through its own
   GitHub integration independently of this workflow.
3. **AI provider key**: `supabase secrets set OPENROUTER_API_KEY=sk-or-...`
   (server-side).
4. **Run the load test** against a live deploy and record numbers in
   `load/k6/README.md` (do not treat the thresholds as results). Note the
   `messages_per_min` trigger is now enforced in the database, so run the storm
   paced (the harness defaults to 2.2 s between sends).
5. **Set `ALLOWED_ORIGINS`** on the Edge Functions (defaults to `*`).
6. **Enable per-IP auth rate limiting / CAPTCHA** in Supabase Auth.

## Errors — what could NOT be run, and why

Recorded so nothing here is mistaken for a passing gate.

| Gate | Status | Blocker |
|---|---|---|
| `npx playwright test` (36 tests, 14 files) | **NOT RUN — ENVIRONMENT LIMITATION** | No Chromium binary and none is obtainable: `cdn.playwright.dev`, `storage.googleapis.com` and `playwright.azureedge.net` all fail TLS from this sandbox (re-verified 2026-09-18). |
| CI `Playwright E2E + browser axe audit` job | ❌ **FAILING — PRE-EXISTING** | Chromium installs and the suite runs, then "Run Playwright suite" exits 1. **Reproduced on `357ca0d`, the commit this pass branched from, before any of its changes** (run 35358311915), and on every CI run since (35363095410, 35365457103, 35365483549). Not caused by this work, and not fixed here. Which tests fail is unknown: the log hosts (`results-receiver.actions.githubusercontent.com`, `productionresultssa12.blob.core.windows.net`) are unreachable from this sandbox and the job annotations carry only "Process completed with exit code 1". |
| `npx playwright test --list` | ✅ run | **36 tests / 14 files** collected; config valid |
| Browser axe (`e2e/accessibility.spec.ts`) | **NOT RUN — ENVIRONMENT LIMITATION** | same as above |
| Frame budget under 4× CPU throttle (`e2e/perf.spec.ts`) | **NOT RUN — ENVIRONMENT LIMITATION** | same as above |
| `deno check` on the Edge Functions | ✅ **run 2026-09-18** | all four functions pass, including under `--frozen`. Deno is not preinstalled and its GitHub release assets fail TLS here, so 2.9.6 was installed from npm's platform package `@deno/linux-x64-glibc` |
| `deno test tests/pdf-extraction.test.ts` | ✅ **run 2026-09-18** | **4/4 pass** against the real `pdfjs-dist@4.8.69` (`npm run test:pdf`) |
| `deno test tests/moderation-fail-closed.test.ts` | **NOT RUN — ENVIRONMENT LIMITATION** | it imports `jsr:@std/assert@1` and `jsr.io` is unreachable from this sandbox. Runs in the `edge-functions` CI job |
| Live k6 load test | **NOT RUN** | needs a deployed Supabase project (deliberately out of scope for the code checkpoint) |
| `supabase db push` / RLS policy verification / `retrieve_attachment_chunks` | **NOT RUN — ENVIRONMENT LIMITATION** | no PostgreSQL and no Supabase CLI in the sandbox (only `sqlite3`); the SQL was reviewed statically and is idempotent, but has never been executed |
| Deployed Edge Function invocation over HTTP | **NOT RUN — ENVIRONMENT LIMITATION** | same; the pipeline is verified module by module instead |
| Lighthouse / real-browser performance | **NOT RUN** | needs a deployed host + a browser |

Everything else was run on the committed tree and is reported above
(2026-09-18): `tsc --noEmit` ✅ · `npm run lint` 0 errors, 19 pre-existing
warnings ✅ · `npm test` **255/255 across 21 files** ✅ ·
`node scripts/contrast.mjs` **54/54** ✅ · `npm run build` ✅ ·
`deno check` on all four Edge Functions ✅ · `npm run test:pdf` **4/4** ✅.
The 2026-08-28 run reported **83** unit tests; the suite has grown since.
