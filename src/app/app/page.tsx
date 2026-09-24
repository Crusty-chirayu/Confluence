"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Hash, MessagesSquare, Search, UserPlus } from "lucide-react";

import { Logo } from "@/components/logo";
import { AiMarkIcon } from "@/components/icons";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { createConversation } from "@/lib/data/api";
import { DEMO_MODE } from "@/lib/env";
import { riseIn, staggerParent, tEnter } from "@/lib/motion";

const PROMPTS = [
  "Explain this error message and how to actually fix it",
  "Turn these rough notes into a clear one-page brief",
  "Play devil's advocate on the plan I'm about to describe",
  "Draft three subject lines and tell me which you'd pick",
];

export default function AppHomePage() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useSession();
  const [busy, setBusy] = React.useState(false);

  const startChat = async (seed?: string) => {
    setBusy(true);
    try {
      const id = await createConversation({ type: "direct_ai", ai_mode: "auto" });
      router.push(seed ? `/app/c/${id}?prefill=${encodeURIComponent(seed)}` : `/app/c/${id}`);
    } catch (e) {
      setBusy(false);
      toast.push({ kind: "error", title: "Couldn't start a chat", description: String(e) });
    }
  };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (profile?.display_name ?? "there").split(/\s+/)[0];

  return (
    <div className="h-full overflow-y-auto bg-[--bg-page] text-[--text-primary]">
      <motion.div
        variants={staggerParent(0.05)}
        initial="hidden"
        animate="show"
        className="mx-auto flex min-h-full max-w-2xl flex-col justify-center px-6 py-14"
      >
        <motion.div variants={riseIn} className="mb-8 text-center">
          <Logo className="mx-auto mb-5 h-11 w-11" />
          <h1 className="text-2xl font-semibold tracking-tight text-[--text-primary] sm:text-3xl">
            {greeting}, {firstName}
          </h1>
          <p className="mt-2.5 text-pretty text-[14.5px] leading-relaxed text-[--text-secondary]">
            Start a private thread with the assistant, or open a room and bring your team in.
          </p>
        </motion.div>

        <motion.div variants={riseIn} className="mb-8 grid gap-2.5 sm:grid-cols-2">
          <button
            onClick={() => startChat()}
            disabled={busy}
            className="group flex items-start gap-3 rounded-[--r-lg] border border-[--border-subtle] bg-[--surface] p-4 text-left shadow-[--shadow-1] transition-all duration-[--dur-fast] hover:-translate-y-0.5 hover:border-[--border] hover:shadow-[--shadow-2] disabled:opacity-60"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[--r-md] bg-[--accent-subtle] text-[--accent-text]">
              <MessagesSquare className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-[14px] font-semibold text-[--text-primary]">
                New AI chat
                <ArrowRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-[--text-secondary]">
                Private, streaming, just you and the assistant.
              </span>
            </span>
          </button>

          <div className="flex items-start gap-3 rounded-[--r-lg] border border-[--border-subtle] bg-[--surface] p-4 shadow-[--shadow-1]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[--r-md] bg-[--surface-hover] text-[--text-secondary]">
              <Hash className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="text-[14px] font-semibold text-[--text-primary]">Group rooms</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-[--text-secondary]">
                Use <strong className="font-medium text-[--text-primary]">New conversation</strong> in the
                sidebar, or join with an invite code.
              </span>
            </span>
          </div>
        </motion.div>

        <motion.div variants={riseIn}>
          <p className="mb-2.5 flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
            <AiMarkIcon className="h-3.5 w-3.5 text-[--ai]" />
            What are you working on?
          </p>
          <div className="space-y-1.5">
            {PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => startChat(p)}
                disabled={busy}
                className="group flex w-full items-center gap-2.5 rounded-[--r-md] border border-[--border-subtle] bg-[--surface] px-3.5 py-2.5 text-left text-[13.5px] transition-colors duration-[--dur-fast] hover:border-[--border] hover:bg-[--surface-hover] disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate text-[--text-secondary] group-hover:text-[--text-primary]">
                  {p}
                </span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[--text-muted] opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          variants={riseIn}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[12px] text-[--text-muted]"
        >
          <span className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" />
            <kbd className="rounded-[--r-xs] border border-[--border] bg-[--surface] px-1.5 py-0.5 font-mono text-[10px] text-[--text-muted]">
              ⌘K
            </kbd>
            to search everything
          </span>
          <span className="flex items-center gap-1.5">
            <UserPlus className="h-3.5 w-3.5" />
            Join a room with an invite code
          </span>
        </motion.div>

        {DEMO_MODE && (
          <motion.div
            variants={riseIn}
            transition={tEnter()}
            className="mt-8 rounded-[--r-md] border border-[--border] bg-[--accent-subtle] px-4 py-3 text-center text-[12.5px] leading-relaxed text-[--accent-text]"
          >
            <strong className="font-semibold">Demo mode.</strong> Data lives in your browser and the
            assistant is simulated locally. Add your Supabase keys to{" "}
            <code className="font-mono">.env.local</code> for the real thing.
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
