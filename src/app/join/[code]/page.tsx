"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2, Hash, Loader2, XCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/session-provider";
import { consumeInvite } from "@/lib/data/api";
import { tEnter } from "@/lib/motion";

const MESSAGES: Record<string, string> = {
  invite_not_found: "That invite code doesn't exist.",
  invite_expired: "That invite has expired. Ask for a fresh link.",
  invite_exhausted: "That invite has already been used the maximum number of times.",
};

export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const { profile, loading } = useSession();
  const [state, setState] = React.useState<"working" | "ok" | "error">("working");
  const [message, setMessage] = React.useState("");
  const [roomName, setRoomName] = React.useState("");
  const ran = React.useRef(false);

  React.useEffect(() => {
    if (loading) return;
    if (!profile) {
      router.replace(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
      return;
    }
    if (ran.current) return;
    ran.current = true;

    void (async () => {
      try {
        const { conversation } = await consumeInvite(code);
        setRoomName(conversation.name ?? "the room");
        setState("ok");
        setTimeout(() => router.push(`/app/c/${conversation.id}`), 900);
      } catch (e) {
        setMessage(MESSAGES[String((e as Error).message)] ?? "Couldn't redeem that invite.");
        setState("error");
      }
    })();
  }, [code, profile, loading, router]);

  return (
    <AuthShell
      title={
        state === "working" ? "Joining…" : state === "ok" ? "You're in" : "Invite didn't work"
      }
      subtitle={state === "working" ? "Checking your invite code." : undefined}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={tEnter()}
        className="py-6 text-center"
      >
        {state === "working" && (
          <>
            <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-[--accent]" />
            <code className="font-mono text-[12.5px] text-[--fg-muted]">{code}</code>
          </>
        )}

        {state === "ok" && (
          <>
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[--success-subtle] text-[--success]">
              <CheckCircle2 className="h-6 w-6" />
            </span>
            <p className="flex items-center justify-center gap-1.5 text-[14px]">
              Welcome to
              <span className="inline-flex items-center gap-1 font-semibold">
                <Hash className="h-3.5 w-3.5" />
                {roomName}
              </span>
            </p>
            <p className="mt-1.5 text-[12.5px] text-[--fg-subtle]">Taking you there…</p>
          </>
        )}

        {state === "error" && (
          <>
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[--danger-subtle] text-[--danger]">
              <XCircle className="h-6 w-6" />
            </span>
            <p className="text-[14px] leading-relaxed text-[--fg-muted]">{message}</p>
            <Link href="/app">
              <Button className="mt-5">Go to your conversations</Button>
            </Link>
          </>
        )}
      </motion.div>
    </AuthShell>
  );
}
