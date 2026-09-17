"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { popIn } from "@/lib/motion";
import { cn } from "@/lib/utils";

/**
 * Per-conversation row menu ("More options for <room>").
 *
 * Accessible `menu`/`menuitem` semantics: the trigger announces the row it
 * targets, items are reachable with Tab/Enter like any other control, and
 * Escape closes the menu without stealing focus from the page. The rename
 * dialog labels its textbox "Rename <room>" so assistive tech (and the E2E
 * suite) address it unambiguously.
 */

export interface RowMenuActions {
  /** Persist a new name for the conversation. */
  onRename: (name: string) => Promise<void>;
  /** Flip the pinned flag (the layout handler owns optimism + refresh). */
  onTogglePin: () => void;
  /** Permanently delete the conversation. */
  onDelete: () => Promise<void>;
}

export function ConversationRowMenu({
  title,
  pinned,
  actions,
}: {
  title: string;
  pinned: boolean;
  actions: RowMenuActions;
}) {
  const [open, setOpen] = React.useState(false);
  const [menuPos, setMenuPos] = React.useState<{ top: number; left: number } | null>(null);
  const [renaming, setRenaming] = React.useState(false);
  const [confirming, setConfirming] = React.useState(false);
  const [name, setName] = React.useState(title);
  const [busy, setBusy] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();

  // Close on outside pointerdown / Escape and return focus to the trigger so
  // keyboard users never lose their place in the list.
  React.useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element)) return;
      if (!e.target.closest(`[data-row-menu="${menuId}"]`)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, menuId]);

  const toggle = () => {
    if (!open) {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (rect) {
        setMenuPos({
          top: rect.bottom + 6,
          left: Math.min(rect.left, (window.innerWidth ?? 0) - 208),
        });
      }
    }
    setOpen((o) => !o);
  };

  const items = [
    {
      id: "pin",
      label: pinned ? "Unpin" : "Pin to top",
      icon: pinned ? PinOff : Pin,
      run: () => {
        setOpen(false);
        actions.onTogglePin();
      },
    },
    {
      id: "rename",
      label: "Rename",
      icon: Pencil,
      run: () => {
        setOpen(false);
        setName(title);
        setRenaming(true);
      },
    },
    {
      id: "delete",
      label: "Delete room",
      icon: Trash2,
      run: () => {
        setOpen(false);
        setConfirming(true);
      },
    },
  ];

  const submitRename = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === title || busy) return;
    setBusy(true);
    try {
      await actions.onRename(next);
      setRenaming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-row-menu={menuId}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`More options for ${title}`}
        onClick={toggle}
        className={cn(
          "press-fluid grid h-6 w-6 shrink-0 place-items-center rounded-[--r-sm] text-[--fg-subtle] transition-opacity duration-[--d-micro]",
          "hover:bg-[--bg-active] hover:text-[--fg]",
          // Revealed on hover / keyboard focus like the pin control, but
          // stays visible while the menu is open.
          open
            ? "opacity-100"
            : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
        )}
      >
        <MoreHorizontal className="h-3.5 w-3.5" />
      </button>

      {open &&
        menuPos &&
        createPortal(
          <AnimatePresence>
            <motion.div
              id={menuId}
              role="menu"
              aria-label={`More options for ${title}`}
              data-row-menu={menuId}
              initial="hidden"
              animate="show"
              exit="exit"
              variants={popIn}
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[60] min-w-48 rounded-[--r-md] border border-[--border] bg-[--surface-raised] py-1 shadow-[--e3]"
            >
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  onClick={item.run}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] transition-colors duration-[--d-micro] hover:bg-[--bg-hover]",
                    item.id === "delete" ? "text-[--danger]" : "text-[--fg]",
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </button>
              ))}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}

      <Modal
        open={renaming}
        onClose={() => setRenaming(false)}
        title={`Rename ${title}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <Button onClick={submitRename} loading={busy}>
              Save
            </Button>
          </>
        }
      >
        <form onSubmit={submitRename}>
          <label htmlFor="rename-conversation-input" className="sr-only">
            Rename {title}
          </label>
          <Input
            id="rename-conversation-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            maxLength={80}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => actions.onDelete()}
        title="Delete conversation?"
        description={`"${title}" and all of its messages will be permanently removed.`}
        confirmLabel="Delete"
      />
    </>
  );
}
