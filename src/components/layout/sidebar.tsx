"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Command,
  Hash,
  LogOut,
  MessagesSquare,
  Pin,
  Plus,
  Search,
  Settings,
  UserPlus,
} from "lucide-react";
import { Avatar, AiAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ConversationRowMenu } from "@/components/layout/conversation-row-menu";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-provider";
import { ConversationListSkeleton } from "@/components/ui/skeleton";
import { useSession } from "@/components/session-provider";
import { useToast } from "@/components/ui/toast";
import { AppDataContext } from "@/app/app/layout";
import { deleteConversation, signOut, updateConversation } from "@/lib/data/api";
import type { ConversationSummary } from "@/lib/types";
import {
  cn,
  conversationTitle,
  partitionPinned,
  plainPreview,
  relativeTime,
  truncate,
} from "@/lib/utils";
import { popIn, SPRING } from "@/lib/motion";

export function Sidebar({
  conversations,
  loading,
  onNew,
  onJoin,
  onSearch,
  onPalette,
  onNavigate,
  onTogglePin,
}: {
  conversations: ConversationSummary[];
  loading: boolean;
  onNew: () => void;
  onJoin: () => void;
  onSearch: () => void;
  onPalette: () => void;
  onNavigate?: () => void;
  onTogglePin?: (conversationId: string, pinned: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { profile } = useSession();

  const { pinned, rest } = partitionPinned(conversations);
  const direct = rest.filter((c) => c.type === "direct_ai");
  const rooms = rest.filter((c) => c.type === "group");

  const handleSignOut = async () => {
    await signOut();
    router.push("/");
  };

  return (
    // The sidebar is a translucent plane, not a flat panel: a soft tint
    // over whatever sits behind it (the app shell's ambient field on
    // desktop, the `.glass-strong` drawer surface on mobile) rather than
    // an opaque rectangle, so it reads as one material layered into the
    // shell in both contexts.
    <div className="relative flex h-full flex-col bg-[--bg-elevated] text-[--text-primary]">
      {/* workspace / brand header: 56px */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 px-3 border-b border-[--border-subtle]">
        <Link href="/app" onClick={onNavigate} className="flex items-center gap-2.5 px-1 rounded-[--r-md] outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring]">
          <Logo size={24} />
          <span className="text-[14px] font-semibold tracking-[-0.02em] text-[--text-primary]">
            Confluence
          </span>
        </Link>
        <ThemeToggle />
      </div>

      {/* primary & secondary actions */}
      <div className="space-y-1.5 px-3 py-3 border-b border-[--border-subtle]">
        <Button
          onClick={onNew}
          className="press-fluid w-full justify-start gap-2 bg-[--accent-subtle] text-[--accent-text] border border-[--accent]/20 hover:bg-[--accent]/20 hover:text-[--text-primary] shadow-[--shadow-1] transition-all duration-[--dur-fast]"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
        <div className="flex gap-1.5">
          <Button
            variant="secondary"
            size="sm"
            className="press-fluid flex-1 justify-start border-[--border-subtle] bg-[--surface] hover:bg-[--surface-hover] text-[--text-secondary]"
            onClick={onPalette}
          >
            <Command className="h-3.5 w-3.5 text-[--text-muted]" />
            Commands
            <kbd className="ml-auto hidden rounded border border-[--border] bg-[--surface-input] px-1.5 py-0.5 font-mono text-[10px] text-[--text-muted] sm:inline">
              ⌘K
            </kbd>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="press-fluid border-[--border-subtle] bg-[--surface] hover:bg-[--surface-hover] text-[--text-secondary]"
            onClick={onSearch}
            aria-label="Search messages"
          >
            <Search className="h-3.5 w-3.5 text-[--text-muted]" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="press-fluid border-[--border-subtle] bg-[--surface] hover:bg-[--surface-hover] text-[--text-secondary]"
            onClick={onJoin}
            aria-label="Join with invite code"
          >
            <UserPlus className="h-3.5 w-3.5 text-[--text-muted]" />
          </Button>
        </div>
      </div>

      {/* conversation lists */}
      <div className="min-h-0 flex-1 scroll-smooth overflow-y-auto px-2 py-3">
        {loading ? (
          <ConversationListSkeleton />
        ) : conversations.length === 0 ? (
          <div className="px-3 py-10 text-center">
            <MessagesSquare className="mx-auto mb-3 h-7 w-7 text-[--text-muted]" />
            <p className="text-[13px] font-medium text-[--text-primary]">No conversations yet</p>
            <p className="mt-1 text-[12px] leading-relaxed text-[--text-muted]">
              Start a private AI chat or create a room.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {pinned.length > 0 && (
              <Group label="Pinned">
                {pinned.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
            {direct.length > 0 && (
              <Group label="Direct AI chats">
                {direct.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
            {rooms.length > 0 && (
              <Group label="Rooms">
                {rooms.map((c) => (
                  <ConversationRow
                    key={c.id}
                    c={c}
                    active={pathname === `/app/c/${c.id}`}
                    onNavigate={onNavigate}
                    onTogglePin={onTogglePin}
                  />
                ))}
              </Group>
            )}
          </div>
        )}
      </div>

      {/* footer: user profile & creator signature */}
      <div className="shrink-0 border-t border-[--border-subtle] px-2 py-1.5 flex flex-col gap-0.5">
        <div className="flex w-full items-center gap-2 rounded-[--r-md] px-2 py-1.5 transition-colors duration-[--dur-fast] hover:bg-[--surface-hover]">
          <Avatar name={profile?.display_name ?? "You"} url={profile?.avatar_url} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-[--text-primary]">
              {profile?.display_name ?? "You"}
            </p>
          </div>
          <Button
            asChild
            href="/app/settings"
            variant="ghost"
            size="iconSm"
            aria-label="Settings"
            className="press-fluid text-[--text-muted] hover:text-[--text-primary]"
            onClick={onNavigate}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="iconSm"
            className="press-fluid text-[--text-muted] hover:text-[--text-primary]"
            onClick={handleSignOut}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center justify-between px-2 pt-0.5 pb-1 text-[11px] text-[--text-muted]">
          <span className="flex items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100">
            <Logo size={12} className="opacity-80" />
            <span>Built by Chirayu</span>
          </span>
          <span className="font-mono text-[10px] text-[--text-muted]/60">v2.1</span>
        </div>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div data-testid="conversation-group" data-group={label}>
      <p className="px-2.5 pb-1 pt-1 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[--text-muted]">
        {label}
      </p>
      <ul aria-label={label} className="space-y-0.5">
        {children}
      </ul>
    </div>
  );
}

function ConversationRow({
  c,
  active,
  onNavigate,
  onTogglePin,
}: {
  c: ConversationSummary;
  active: boolean;
  onNavigate?: () => void;
  onTogglePin?: (conversationId: string, pinned: boolean) => void;
}) {
  const title = conversationTitle(c);
  const pinned = Boolean(c.pinned_at);
  const toast = useToast();
  const router = useRouter();
  const { refreshConversations } = React.useContext(AppDataContext);
  const isRoom = c.type === "group";
  const preview = c.last_message
    ? `${c.last_message.sender_type === "ai" ? "AI: " : ""}${truncate(plainPreview(c.last_message.content), 40)}`
    : "No messages yet";

  const renameConversation = async (name: string) => {
    try {
      await updateConversation(c.id, { name });
      refreshConversations();
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't rename", description: String(e) });
    }
  };

  const removeConversation = async () => {
    try {
      await deleteConversation(c.id);
      refreshConversations();
      if (active) router.push("/app");
    } catch (e) {
      toast.push({ kind: "error", title: "Couldn't delete", description: String(e) });
    }
  };

  return (
    <motion.li
      layout
      transition={SPRING}
      className={cn(
        "group relative isolate flex items-center overflow-hidden rounded-[--r-md] pr-1 transition-all duration-[--dur-fast]",
        active
          ? "bg-[--surface-active] text-[--text-primary]"
          : "hover:bg-[--surface-hover] text-[--text-secondary]",
      )}
    >
      {/* 2px left accent bar on active row */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-[--accent]"
        />
      )}

      <Link
        href={`/app/c/${c.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2.5 rounded-[--r-md] px-2.5 py-2 outline-none focus-visible:ring-2 focus-visible:ring-[--focus-ring] focus-visible:ring-inset"
      >
        {c.type === "direct_ai" ? (
          <AiAvatar size="sm" />
        ) : (
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[--r-sm] bg-[--surface] border border-[--border-subtle] text-[--text-muted]">
            <Hash className="h-3.5 w-3.5" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-1.5">
            <p
              className={cn(
                "truncate text-[13px]",
                c.unread > 0 ? "font-semibold text-[--text-primary]" : "font-medium text-[--text-primary]",
              )}
            >
              {title}
            </p>
            {c.last_message && (
              <span className="shrink-0 text-[10.5px] tabular-nums text-[--text-muted]">
                {relativeTime(c.last_message.created_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <p className="min-w-0 flex-1 truncate text-[11.5px] text-[--text-muted]">{preview}</p>
            <AnimatePresence>
              {c.unread > 0 && (
                <motion.span
                  variants={popIn}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  className="grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-[--accent] px-1 text-[10px] font-bold text-white"
                >
                  {c.unread > 9 ? "9+" : c.unread}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Link>

      {onTogglePin && (
        <button
          type="button"
          data-testid={pinned ? "unpin-button" : "pin-button"}
          aria-pressed={pinned}
          aria-label={pinned ? `Unpin ${title}` : `Pin ${title}`}
          title={pinned ? "Unpin" : "Pin to top"}
          onClick={() => onTogglePin(c.id, !pinned)}
          className={cn(
            "press-fluid grid h-6 w-6 shrink-0 place-items-center rounded-[--r-sm] text-[--text-muted] transition-opacity duration-[--dur-micro]",
            "hover:bg-[--surface-active] hover:text-[--text-primary]",
            pinned
              ? "text-[--accent-text] opacity-100"
              : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <Pin
            className={cn("h-3.5 w-3.5", pinned && "fill-current")}
            strokeWidth={pinned ? 2.5 : 2}
          />
        </button>
      )}

      <ConversationRowMenu
        title={title}
        pinned={pinned}
        actions={{
          onTogglePin: onTogglePin ? () => onTogglePin(c.id, !pinned) : () => {},
          onRename: isRoom ? renameConversation : undefined,
          onDelete: removeConversation,
        }}
      />
    </motion.li>
  );
}

/**
 * AI participation mode badge (Section 14 & 26):
 *   OFF           → AiModeOffIcon + neutral text
 *   MENTION_ONLY  → AiModeMentionIcon + violet text
 *   AUTO          → AiModeAlwaysIcon + violet filled
 */
export function AiModeBadge({ mode }: { mode: string }) {
  if (mode === "off") {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[--text-muted]">
        <span className="h-1.5 w-1.5 rounded-full bg-[--text-disabled]" aria-hidden="true" />
        AI off
      </span>
    );
  }

  const isAuto = mode === "auto";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[--r-sm] px-1.5 py-0.5 text-[11px] font-medium border",
        isAuto
          ? "border-[--ai]/30 bg-[--ai-subtle] text-[--ai]"
          : "border-[--border-subtle] bg-[--surface] text-[--ai]",
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[--ai]" aria-hidden="true" />
      {isAuto ? "AI auto" : "@ai only"}
    </span>
  );
}