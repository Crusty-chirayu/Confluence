"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { NewConversationModal } from "@/components/layout/new-conversation-modal";
import { JoinModal } from "@/components/layout/join-modal";
import { SearchModal } from "@/components/layout/search-modal";
import { CommandPalette } from "@/components/layout/command-palette";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useSession } from "@/components/session-provider";
import { listConversations } from "@/lib/data/api";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { ConversationSummary } from "@/lib/types";
import { backdrop, tEnter } from "@/lib/motion";

export const AppDataContext = React.createContext<{ refreshConversations: () => void }>({
  refreshConversations: () => {},
});

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, loading: sessionLoading } = useSession();

  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newOpen, setNewOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      setConversations(await listConversations());
    } finally {
      setLoading(false);
    }
  }, []);

  // auth guard
  React.useEffect(() => {
    if (!sessionLoading && !profile) router.replace("/login?next=/app");
  }, [sessionLoading, profile, router]);

  React.useEffect(() => {
    if (!profile) return;
    void refresh();

    if (DEMO_MODE) return demo.subscribe(() => void refresh());

    const supa = getSupabaseBrowser();
    if (!supa) return;
    const channel = supa
      .channel("sidebar-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refresh())
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversation_members" },
        () => refresh(),
      )
      .subscribe();
    return () => {
      void supa.removeChannel(channel);
    };
  }, [profile, refresh]);

  // §3: ⌘K opens the command palette (navigate / create / theme).
  // ⌘/ opens message full-text search.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (k === "/") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (sessionLoading || !profile) {
    // no predictable shape yet -> spinner, per the motion spec
    return (
      <div className="grid min-h-dvh place-items-center bg-[--bg]">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={tEnter()}
          className="flex flex-col items-center gap-3"
        >
          <Logo className="h-9 w-9 animate-pulse" />
          <p className="text-[13px] text-[--fg-muted]">Checking your session…</p>
        </motion.div>
      </div>
    );
  }

  const sidebar = (
    <Sidebar
      conversations={conversations}
      loading={loading}
      onNew={() => setNewOpen(true)}
      onJoin={() => setJoinOpen(true)}
      onSearch={() => setSearchOpen(true)}
      onPalette={() => setPaletteOpen(true)}
      onNavigate={() => setDrawerOpen(false)}
    />
  );

  return (
    <AppDataContext.Provider value={{ refreshConversations: refresh }}>
      <div className="flex h-dvh overflow-hidden bg-[--bg]">
        {/* desktop sidebar */}
        <aside className="hidden w-[17.5rem] shrink-0 border-r border-[--border] lg:block">
          {sidebar}
        </aside>

        {/* mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <div className="fixed inset-0 z-40 lg:hidden">
              <motion.div
                variants={backdrop}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={() => setDrawerOpen(false)}
                className="absolute inset-0 bg-black/45"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={tEnter(0.32)}
                className="absolute inset-y-0 left-0 w-[17.5rem] border-r border-[--border] shadow-[--e4]"
              >
                {sidebar}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* mobile top bar */}
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-[--border] px-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Logo className="h-6 w-6" />
            <span className="text-[14px] font-semibold">Confluence</span>
          </div>

          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </div>

      <NewConversationModal open={newOpen} onClose={() => setNewOpen(false)} onCreated={refresh} />
      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} onJoined={refresh} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        conversations={conversations}
        onNewConversation={() => setNewOpen(true)}
        onJoin={() => setJoinOpen(true)}
        onSearch={() => setSearchOpen(true)}
      />
    </AppDataContext.Provider>
  );
}
