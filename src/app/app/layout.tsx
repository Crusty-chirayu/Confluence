"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, PanelLeft } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { NewConversationModal } from "@/components/layout/new-conversation-modal";
import { JoinModal } from "@/components/layout/join-modal";
import { SearchModal } from "@/components/layout/search-modal";
import { CommandPalette } from "@/components/layout/command-palette";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { listConversations, setPinned, isDeliberateSignOut, clearDeliberateSignOut } from "@/lib/data/api";
import { DEMO_MODE } from "@/lib/env";
import { demo } from "@/lib/data/demo-store";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { ConversationSummary } from "@/lib/types";
import { backdrop, tEnter } from "@/lib/motion";
import { AppDataContext } from "./app-data";

export { AppDataContext } from "./app-data";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const { profile, loading: sessionLoading } = useSession();

  const [conversations, setConversations] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [newOpen, setNewOpen] = React.useState(false);
  const [joinOpen, setJoinOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [sidebarHidden, setSidebarHidden] = React.useState(false);

  const refresh = React.useCallback(async () => {
    try {
      setConversations(await listConversations());
    } finally {
      setLoading(false);
    }
  }, []);

  // §3 pinned conversations — the pin is stored on the caller's membership
  // row, so the refresh simply re-reads it from the server (or demo store).
  const togglePin = React.useCallback(
    async (conversationId: string, pinned: boolean) => {
      // Optimistic: the sidebar reorders immediately, then reconciles.
      setConversations((prev) =>
        prev.map((c) =>
          c.id === conversationId
            ? { ...c, pinned_at: pinned ? new Date().toISOString() : null }
            : c,
        ),
      );
      try {
        await setPinned(conversationId, pinned);
      } catch (e) {
        toast.push({
          kind: "error",
          title: pinned ? "Couldn't pin" : "Couldn't unpin",
          description: String(e),
        });
      } finally {
        await refresh();
      }
    },
    [refresh, toast],
  );

  // auth guard. During a user-initiated sign-out the callers navigate to a
  // public page deliberately; the guard skips its redirect once so it does not
  // race that navigation with a bounce to /login?next=/app.
  React.useEffect(() => {
    if (!sessionLoading && !profile) {
      if (isDeliberateSignOut()) {
        clearDeliberateSignOut();
        return;
      }
      router.replace("/login?next=/app");
    }
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
  // ⌘/ opens message full-text search. ⌘B toggles the desktop sidebar —
  // typing-safe: ignored while the focus sits in a text field so it can
  // never steal a keystroke from the composer.
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
      } else if (k === "b") {
        const t = e.target as HTMLElement | null;
        if (t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName))) {
          return;
        }
        e.preventDefault();
        setSidebarHidden((h) => !h);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (sessionLoading || !profile) {
    return (
      <div className="relative grid min-h-dvh place-items-center bg-[--bg-page] text-[--text-primary]">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={tEnter()}
          className="flex flex-col items-center gap-3.5 rounded-[--r-xl] border border-[--border-subtle] bg-[--surface] px-8 py-7 shadow-[--shadow-2]"
        >
          <Logo size={32} className="animate-pulse" />
          <p className="text-[13px] font-normal text-[--text-muted]">Checking your session…</p>
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
      onTogglePin={(id, pinned) => void togglePin(id, pinned)}
    />
  );

  return (
    <AppDataContext.Provider value={{ refreshConversations: refresh }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={tEnter()}
        className="relative flex h-dvh w-full overflow-hidden bg-[--bg-page] text-[--text-primary]"
      >
        {/* desktop sidebar: 280px persistent solid --bg-elevated with right hairline */}
        {!sidebarHidden && (
          <aside className="relative hidden w-[280px] shrink-0 border-r border-[--border-subtle] bg-[--bg-elevated] lg:block">
            {sidebar}
          </aside>
        )}
        {sidebarHidden && (
          <div className="hidden shrink-0 items-start border-r border-[--border-subtle] bg-[--bg-elevated] pt-3 pl-2 pr-2 lg:flex">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarHidden(false)}
              aria-label="Show sidebar"
              title="Show sidebar (Ctrl+B)"
              className="text-[--text-muted] hover:text-[--text-primary]"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          </div>
        )}

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
                className="absolute inset-0 bg-black/60"
              />
              <motion.aside
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={tEnter(0.26)}
                className="absolute inset-y-0 left-0 w-[min(320px,85vw)] border-r border-[--border-subtle] bg-[--bg-elevated] shadow-[--shadow-4]"
              >
                {sidebar}
              </motion.aside>
            </div>
          )}
        </AnimatePresence>

        <div className="relative flex min-w-0 flex-1 flex-col bg-[--bg-page]">
          <OfflineBanner />

          {/* mobile top bar */}
          <div className="relative z-10 flex h-14 shrink-0 items-center gap-2.5 border-b border-[--border-subtle] bg-[--bg-elevated] px-3 lg:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="text-[--text-secondary] hover:text-[--text-primary]"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Logo size={24} />
            <span className="text-[14px] font-semibold tracking-[-0.02em] text-[--text-primary]">
              Confluence
            </span>
          </div>

          <main className="min-h-0 flex-1">{children}</main>
        </div>
      </motion.div>

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