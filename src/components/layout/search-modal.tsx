"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Hash, Loader2, Search } from "lucide-react";
import { AiMarkIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { searchMessages } from "@/lib/data/api";
import type { SearchHit } from "@/lib/types";
import { cn, plainPreview, relativeTime, truncate } from "@/lib/utils";
import { tEnter } from "@/lib/motion";

/** Highlight the matched terms inside the preview. */
function Highlighted({ text, query }: { text: string; query: string }) {
  const terms = query
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (terms.length === 0) return <>{text}</>;
  const re = new RegExp(`(${terms.join("|")})`, "ig");
  return (
    <>
      {text.split(re).map((part, i) =>
        re.test(part) ? (
          <mark key={i} className="rounded bg-[--accent-subtle] px-0.5 text-[--accent-text]">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [cursor, setCursor] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      setQuery("");
      setHits([]);
      setCursor(0);
    }
  }, [open]);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        setHits(await searchMessages(q));
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
        setCursor(0);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  const goto = React.useCallback(
    (hit: SearchHit) => {
      onClose();
      router.push(`/app/c/${hit.conversation_id}?m=${hit.message_id}`);
    },
    [onClose, router],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(hits.length - 1, c + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    } else if (e.key === "Enter" && hits[cursor]) {
      e.preventDefault();
      goto(hits[cursor]);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Search messages"
      className="max-w-2xl overflow-hidden border border-[--border] bg-[--surface-modal] shadow-[--shadow-4]"
    >
      <div className="relative">
        <div className="relative rounded-[--r-lg] border border-[--border] bg-[--surface-input] transition-colors duration-[--dur-fast] focus-within:border-[--accent]/60 focus-within:ring-2 focus-within:ring-[--accent-subtle]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[--text-muted]" />
          {loading && (
            <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[--text-muted]" />
          )}
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search across every conversation you're in…"
            autoFocus
            className="border-0 bg-transparent pl-10 pr-10 text-[14px] text-[--text-primary] shadow-none focus-visible:ring-0 placeholder:text-[--text-muted]"
          />
        </div>
      </div>

      <div className="relative mt-4 max-h-[min(28rem,55vh)] overflow-y-auto">
        <AnimatePresence mode="wait" initial={false}>
          {query.trim().length < 2 ? (
            <motion.p
              key="hint"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tEnter(0.15)}
              className="py-10 text-center text-[13px] text-[--text-muted]"
            >
              Type at least two characters. Results respect room membership — you only ever see what
              you have access to.
            </motion.p>
          ) : hits.length === 0 && !loading ? (
            <motion.p
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tEnter(0.15)}
              className="py-10 text-center text-[13px] text-[--text-muted]"
            >
              No messages match <span className="font-medium text-[--text-primary]">{query}</span>.
            </motion.p>
          ) : (
            <motion.ul
              key="hits"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={tEnter(0.15)}
              className="space-y-1"
            >
              {hits.map((h, i) => (
                <li key={h.message_id}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => goto(h)}
                    className={cn(
                      "flex w-full gap-3 rounded-[--r-md] border border-transparent px-3 py-2.5 text-left transition-all duration-[--dur-fast]",
                      i === cursor
                        ? "border-[--border-subtle] bg-[--surface-hover]"
                        : "hover:bg-[--surface-hover]",
                    )}
                  >
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-[--r-sm] border border-[--border-subtle] bg-[--surface] text-[--text-muted]">
                      {h.sender_type === "ai" ? (
                        <AiMarkIcon size={14} className="text-[--ai]" />
                      ) : (
                        <Hash className="h-3.5 w-3.5" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-[12.5px] font-semibold text-[--text-primary]">
                          {h.conversation_name ??
                            (h.conversation_type === "direct_ai" ? "Direct AI chat" : "Room")}
                        </span>
                        <span className="shrink-0 text-[11px] text-[--fg-subtle]">
                          {relativeTime(h.created_at)}
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-[--fg-muted]">
                        <Highlighted text={truncate(plainPreview(h.content), 150)} query={query} />
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}