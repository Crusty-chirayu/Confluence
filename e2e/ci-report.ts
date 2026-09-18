/**
 * CI diagnostics — global teardown.
 *
 * GitHub's check-run annotations are the only way to see test-level detail
 * of a CI run from outside the runner (step logs and report artifacts are
 * not reachable from here), so this teardown converts the Playwright JSON
 * report into `::error` / `::notice` annotations:
 *
 *   - every test that failed its final attempt ("unexpected") becomes an
 *     error annotation pointing at the spec file and line;
 *   - runner-level errors (collection failures, worker crashes) are
 *     annotated verbatim;
 *   - when no test failed, a notice prints the per-status breakdown so a
 *     non-zero exit code can be attributed (e.g. "interrupted" tests mean
 *     the browser or a worker died, not that an assertion failed).
 *
 * No-op outside GitHub Actions.
 */
import { existsSync, readFileSync } from "node:fs";

interface JsonTest {
  file: string;
  line: number;
  title: string;
  status: string;
}

function collectTests(suites: unknown[], out: JsonTest[]): void {
  for (const suite of suites as Array<{
    specs?: Array<{ file: string; line: number; title: string; tests?: Array<{ status: string }> }>;
    suites?: unknown[];
  }>) {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        out.push({ file: spec.file, line: spec.line, title: spec.title, status: t.status });
      }
    }
    collectTests(suite.suites ?? [], out);
  }
}

export default async function teardown(): Promise<void> {
  if (!process.env.GITHUB_ACTIONS) return;
  const reportPath = "playwright-results.json";
  if (!existsSync(reportPath)) {
    console.log(
      "::error title=E2E::playwright-results.json was not written — the run failed before reporting (config/collection error)",
    );
    return;
  }

  let report: {
    errors?: Array<{ message?: string } | string>;
    suites?: unknown[];
  };
  try {
    report = JSON.parse(readFileSync(reportPath, "utf8"));
  } catch (e) {
    console.log(`::error title=E2E::could not parse the JSON report: ${String(e)}`);
    return;
  }

  for (const err of report.errors ?? []) {
    const msg =
      typeof err === "string"
        ? err
        : (err.message ?? "runner error").split("\n").slice(0, 15).join(" ");
    console.log(`::error title=E2E runner error::${msg}`);
  }

  const tests: JsonTest[] = [];
  collectTests(report.suites ?? [], tests);

  const failed = tests.filter((t) => t.status === "unexpected");
  if (failed.length > 0) {
    for (const t of failed) {
      console.log(
        `::error file=${t.file},line=${t.line} title=E2E failed test::${t.title} (final status: ${t.status})`,
      );
    }
    return;
  }

  const counts = new Map<string, number>();
  for (const t of tests) counts.set(t.status, (counts.get(t.status) ?? 0) + 1);
  const breakdown = [...counts.entries()]
    .map(([status, n]) => `${status}=${n}`)
    .join(" ");
  console.log(
    `::notice title=E2E status breakdown::no finally-failed test — ${breakdown || "no tests reached a terminal status"} (total=${tests.length})`,
  );
}
