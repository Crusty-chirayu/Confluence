"use client";

import Link from "next/link";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthShell } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { DEMO_MODE } from "@/lib/env";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { tEnter } from "@/lib/motion";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = z.string().email().safeParse(email);
    if (!parsed.success) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    setLoading(true);

    if (!DEMO_MODE) {
      await getSupabaseBrowser()!.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    }
    setLoading(false);
    setSent(true);
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle={sent ? undefined : "We'll email you a link to set a new one."}
      footer={
        <Link href="/login" className="font-medium text-[--accent-text] hover:underline">
          Back to sign in
        </Link>
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {sent ? (
          <motion.div
            key="sent"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={tEnter()}
            className="py-4 text-center"
          >
            <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[--success-subtle] text-[--success]">
              <MailCheck className="h-6 w-6" />
            </span>
            <p className="text-[14px] leading-relaxed text-[--fg-muted]">
              If an account exists for{" "}
              <span className="font-medium text-[--fg]">{email}</span>, a reset link is on its way.
            </p>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            onSubmit={submit}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={tEnter()}
            className="space-y-4"
            noValidate
          >
            <Field label="Email" error={error} id="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Button type="submit" className="w-full" loading={loading}>
              Send reset link
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthShell>
  );
}
