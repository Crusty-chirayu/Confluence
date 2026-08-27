"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  AtSign,
  Check,
  Database,
  Gauge,
  KeyRound,
  Layers,
  MessagesSquare,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/nav";
import { HeroDemo } from "@/components/landing/hero-demo";
import { Reveal, RevealItem, SectionHeading } from "@/components/landing/section";
import { Logo } from "@/components/logo";
import { riseIn, staggerParent, tEnter } from "@/lib/motion";
import { DEMO_MODE } from "@/lib/env";

const FEATURES = [
  {
    icon: MessagesSquare,
    title: "1:1 AI chat that streams",
    body: "A private thread with the assistant. Tokens land as they're generated, stop mid-flight, regenerate a better answer — the supersede chain keeps the history honest.",
  },
  {
    icon: AtSign,
    title: "AI that knows when to stay quiet",
    body: "Rooms choose their own posture: off, mention-only, or always-on. In mention-only the assistant waits for @ai, so it augments the conversation instead of hijacking it.",
  },
  {
    icon: Users,
    title: "Real group rooms",
    body: "Invite by link, roles for owner/admin/member, presence and typing indicators, reactions, and per-room topics that shape how the assistant answers.",
  },
  {
    icon: ShieldCheck,
    title: "Moderation that fails closed",
    body: "Every message is classified before it reaches the model and again before the answer is published. If the classifier errors, nothing ships. Verdicts are auditable.",
  },
  {
    icon: Gauge,
    title: "Rate limits you can see",
    body: "Fixed-window counters per user, per bucket, persisted in Postgres. Thirty messages a minute, ten AI invocations — tunable without a redeploy.",
  },
  {
    icon: Radio,
    title: "Realtime by default",
    body: "The assistant's reply is one row that updates as it streams, so every member of a room watches the same answer appear at the same moment.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Start a thread or a room",
    body: "A private AI chat takes one click. A room takes a name — and optionally a topic that tells the assistant what this space is for.",
  },
  {
    n: "02",
    title: "Bring people in",
    body: "Generate an invite link with an expiry and a use cap. Redemption runs server-side, so nobody can join a room by guessing a UUID.",
  },
  {
    n: "03",
    title: "Set the AI's posture",
    body: "Off for a human-only room. Mention-only when you want it on tap. Auto when the assistant is a full participant.",
  },
  {
    n: "04",
    title: "Ship the conversation",
    body: "Search every message you have access to, react, edit, regenerate. History is yours; training on it is opt-in and off by default.",
  },
];

const SECURITY = [
  {
    icon: KeyRound,
    title: "The provider key never reaches a browser",
    body: "All model calls run inside an Edge Function. The client gets a stream, never a credential.",
  },
  {
    icon: Database,
    title: "Row Level Security on every table",
    body: "Membership is the boundary. Audit tables have RLS enabled with zero policies — unreachable from the anon and authenticated roles entirely.",
  },
  {
    icon: Layers,
    title: "Private attachments, scoped by room",
    body: "Files live in a private bucket keyed by conversation. Storage policies call the same membership check the tables do.",
  },
  {
    icon: ShieldCheck,
    title: "Opt-in training, off by default",
    body: "Your conversations aren't training data unless you say so, and you can revoke it in Settings at any time.",
  },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "For trying the whole thing out.",
    features: ["Unlimited 1:1 AI chats", "3 group rooms", "30-day history", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Team",
    price: "$12",
    cadence: "per user / month",
    blurb: "For groups that actually ship together.",
    features: [
      "Unlimited rooms & members",
      "Full history + global search",
      "File attachments",
      "Admin analytics",
      "Priority model access",
    ],
    cta: "Start 14-day trial",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "annual",
    blurb: "For when procurement gets involved.",
    features: ["SSO / SAML", "Audit log export", "Data residency", "Custom moderation policy", "99.9% SLA"],
    cta: "Talk to us",
    highlight: false,
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  // subtle parallax on the hero demo
  const demoY = useTransform(scrollYProgress, [0, 1], [0, 64]);
  const demoOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0.35]);

  return (
    <div className="min-h-dvh bg-[--bg]">
      <LandingNav />

      {/* ---------------- HERO ---------------- */}
      <section ref={heroRef} className="relative overflow-hidden px-5 pb-20 pt-32 sm:pt-40">
        {/* aurora backdrop */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
          <div
            className="aurora absolute left-1/2 top-[-18rem] h-[36rem] w-[52rem] -translate-x-1/2 rounded-full opacity-[0.16] blur-[100px]"
            style={{ background: "radial-gradient(circle, var(--accent), transparent 62%)" }}
          />
          <div
            className="aurora absolute right-[-12rem] top-[6rem] h-[30rem] w-[30rem] rounded-full opacity-[0.13] blur-[100px]"
            style={{
              background: "radial-gradient(circle, var(--ai-accent), transparent 62%)",
              animationDelay: "-6s",
            }}
          />
        </div>

        <motion.div
          variants={staggerParent(0.06)}
          initial="hidden"
          animate="show"
          className="mx-auto max-w-3xl text-center"
        >
          <motion.div variants={riseIn}>
            <span className="inline-flex items-center gap-2 rounded-full border border-[--accent-border] bg-[--accent-subtle] px-3.5 py-1.5 text-[12.5px] font-medium text-[--accent]">
              <Sparkles className="h-3.5 w-3.5" />
              v2.0 — group rooms with opt-in AI
            </span>
          </motion.div>

          <motion.h1
            variants={riseIn}
            className="mt-6 text-balance text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl"
          >
            AI chat, alone{" "}
            <span className="bg-gradient-to-r from-[--ai-accent] to-[--accent] bg-clip-text text-transparent">
              or together
            </span>
          </motion.h1>

          <motion.p
            variants={riseIn}
            className="mx-auto mt-5 max-w-xl text-pretty text-[16.5px] leading-relaxed text-[--fg-muted]"
          >
            A private thread with the assistant when you&apos;re heads-down. A room where it joins your
            team only when invited. One conversation model, streaming end to end, moderated at both
            edges.
          </motion.p>

          <motion.div
            variants={riseIn}
            className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row"
          >
            <Link href="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto">
                Start chatting free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/app" className="w-full sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                {DEMO_MODE ? "Explore the demo" : "Open the app"}
              </Button>
            </Link>
          </motion.div>

          <motion.p variants={riseIn} className="mt-4 text-[12.5px] text-[--fg-subtle]">
            No credit card. Your history is yours — training is opt-in.
          </motion.p>
        </motion.div>

        <motion.div
          style={{ y: demoY, opacity: demoOpacity }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...tEnter(0.48), delay: 0.24 }}
          className="mx-auto mt-16 max-w-3xl"
        >
          <HeroDemo />
        </motion.div>
      </section>

      {/* ---------------- FEATURES ---------------- */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal id="features" className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="What you get"
            title="Two products that happen to share a spine"
            subtitle="A 1:1 assistant and a group chat platform, built on one conversation model — so a private thread and a twelve-person room behave identically where it counts."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <RevealItem key={f.title}>
                <motion.div
                  whileHover={{ y: -3 }}
                  transition={tEnter(0.2)}
                  className="group h-full rounded-[--r-lg] border border-[--border] bg-[--surface] p-6 shadow-[--e1] transition-colors duration-[--d-standard] hover:border-[--border-strong] hover:shadow-[--e2]"
                >
                  <span className="mb-4 inline-grid h-10 w-10 place-items-center rounded-[--r-md] bg-[--accent-subtle] text-[--accent]">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-[15px] font-semibold tracking-tight">{f.title}</h3>
                  <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
                    {f.body}
                  </p>
                </motion.div>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- HOW ---------------- */}
      <section className="border-y border-[--border] bg-[--bg-subtle] px-5 py-24 sm:py-32">
        <Reveal id="how" className="mx-auto max-w-5xl">
          <SectionHeading
            eyebrow="How it works"
            title="Four steps, no setup ceremony"
          />
          <div className="mt-14 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {STEPS.map((s) => (
              <RevealItem key={s.n}>
                <div className="flex gap-5">
                  <span className="font-mono text-[13px] font-semibold tabular-nums text-[--accent]">
                    {s.n}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[15px] font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-2 text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
                      {s.body}
                    </p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- SECURITY ---------------- */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal id="security" className="mx-auto max-w-6xl">
          <SectionHeading
            eyebrow="Security"
            title="The boring parts, done properly"
            subtitle="Membership is the only authorization primitive, and it's enforced in the database rather than in application code that someone will eventually forget to call."
          />
          <div className="mt-14 grid gap-4 sm:grid-cols-2">
            {SECURITY.map((s) => (
              <RevealItem key={s.title}>
                <div className="flex h-full gap-4 rounded-[--r-lg] border border-[--border] bg-[--surface] p-6">
                  <span className="mt-0.5 inline-grid h-9 w-9 shrink-0 place-items-center rounded-[--r-md] bg-[--success-subtle] text-[--success]">
                    <s.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[14.5px] font-semibold tracking-tight">{s.title}</h3>
                    <p className="mt-1.5 text-pretty text-[13.5px] leading-relaxed text-[--fg-muted]">
                      {s.body}
                    </p>
                  </div>
                </div>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- PRICING ---------------- */}
      <section className="border-t border-[--border] bg-[--bg-subtle] px-5 py-24 sm:py-32">
        <Reveal id="pricing" className="mx-auto max-w-5xl">
          <SectionHeading eyebrow="Pricing" title="Priced per person, not per token" />
          <div className="mt-14 grid gap-5 lg:grid-cols-3">
            {PRICING.map((p) => (
              <RevealItem key={p.name}>
                <div
                  className={`relative flex h-full flex-col rounded-[--r-lg] border p-6 ${
                    p.highlight
                      ? "border-[--accent] bg-[--surface] shadow-[--e3]"
                      : "border-[--border] bg-[--surface]"
                  }`}
                >
                  {p.highlight && (
                    <span className="absolute -top-2.5 left-6 rounded-full bg-[--accent] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[--accent-fg]">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-[15px] font-semibold">{p.name}</h3>
                  <p className="mt-1 text-[13px] text-[--fg-muted]">{p.blurb}</p>
                  <p className="mt-5 flex items-baseline gap-1.5">
                    <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                    <span className="text-[12.5px] text-[--fg-subtle]">{p.cadence}</span>
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2.5 text-[13.5px] text-[--fg-muted]">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-[--success]" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="mt-7">
                    <Button variant={p.highlight ? "primary" : "secondary"} className="w-full">
                      {p.cta}
                    </Button>
                  </Link>
                </div>
              </RevealItem>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------------- CTA ---------------- */}
      <section className="px-5 py-24 sm:py-32">
        <Reveal className="mx-auto max-w-3xl text-center">
          <RevealItem>
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Bring the assistant into the room
            </h2>
          </RevealItem>
          <RevealItem>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-[15px] leading-relaxed text-[--fg-muted]">
              Free to start, and the demo runs without an account.
            </p>
          </RevealItem>
          <RevealItem>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Create your account
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/app" className="w-full sm:w-auto">
                <Button size="lg" variant="secondary" className="w-full sm:w-auto">
                  Open the app
                </Button>
              </Link>
            </div>
          </RevealItem>
        </Reveal>
      </section>

      {/* ---------------- FOOTER ---------------- */}
      <footer className="border-t border-[--border] px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo className="h-6 w-6" />
            <span className="text-[13.5px] font-semibold">Confluence</span>
            <span className="text-[12.5px] text-[--fg-subtle]">v2.0</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[13px] text-[--fg-muted]">
            <a href="#features" className="hover:text-[--fg]">Features</a>
            <a href="#security" className="hover:text-[--fg]">Security</a>
            <a href="#pricing" className="hover:text-[--fg]">Pricing</a>
            <Link href="/login" className="hover:text-[--fg]">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
