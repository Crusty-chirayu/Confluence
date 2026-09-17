"use client";

import * as React from "react";
import { FileText } from "lucide-react";
import { parseCitations, type VerifiedCitation } from "@/lib/citations";
import { cn } from "@/lib/utils";

/**
 * Verified citation list under an AI message.
 *
 * Renders ONLY what the server verified: `Message.citations` is derived
 * server-side from the chunks actually retrieved for the prompt (see
 * `supabase/functions/_shared/citations.ts`) and is re-validated here at
 * the render boundary — malformed entries are dropped, not guessed.
 * Model prose alone can never mint a citation chip.
 */
export function CitationList({ citations }: { citations: unknown }) {
  const verified = React.useMemo(() => parseCitations(citations), [citations]);
  if (verified.length === 0) return null;
  return (
    <ul
      className="mt-1.5 flex flex-wrap gap-1"
      aria-label="Sources"
      data-testid="citation-list"
    >
      {verified.map((c) => (
        <CitationChip key={`${c.attachment_id}:${c.label}:${c.chunk_index ?? "x"}`} citation={c} />
      ))}
    </ul>
  );
}

function CitationChip({ citation }: { citation: VerifiedCitation }) {
  const filename = truncateMiddle(citation.filename, 34);
  return (
    <li>
      <span
        title={`${citation.filename}${citation.page !== null ? ` — page ${citation.page}` : ""} (${citation.label})`}
        className={cn(
          "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[--border]/70 bg-[--surface]/70",
          "px-2 py-0.5 text-[11px] text-[--fg-muted] backdrop-blur-sm",
        )}
      >
        <FileText className="h-3 w-3 shrink-0" aria-hidden />
        <span className="max-w-[24ch] truncate font-medium">{filename}</span>
        {citation.page !== null && (
          <span className="shrink-0 tabular-nums text-[--fg-subtle]">p. {citation.page}</span>
        )}
      </span>
    </li>
  );
}

/** Keep long document names readable from both ends. */
function truncateMiddle(name: string, max: number): string {
  if (name.length <= max) return name;
  const keep = max - 1;
  const head = Math.ceil(keep / 2);
  const tail = Math.floor(keep / 2);
  return `${name.slice(0, head)}…${name.slice(-tail)}`;
}
