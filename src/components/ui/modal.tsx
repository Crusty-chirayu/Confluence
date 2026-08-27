"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { backdrop, modalPanel } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
          <motion.div
            variants={backdrop}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={onClose}
            className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            variants={modalPanel}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(
              "relative w-full max-w-lg rounded-t-[--r-xl] border border-[--border] bg-[--surface-raised]",
              "shadow-[--e4] sm:rounded-[--r-xl]",
              className,
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[--border] px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[15px] font-semibold text-[--fg]">{title}</h2>
                {description && (
                  <p className="mt-0.5 text-[13px] text-[--fg-muted]">{description}</p>
                )}
              </div>
              <Button variant="ghost" size="iconSm" onClick={onClose} aria-label="Close">
                <X className="h-4 w-4" />
              </Button>
            </div>
            {children && <div className="px-5 py-4">{children}</div>}
            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-[--border] px-5 py-3.5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/**
 * Destructive confirm. Guards accidental double-clicks with a debounce
 * that has a VISUAL TELL (shake), never a silent one.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}) {
  const [shake, setShake] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const openedAt = React.useRef(0);

  React.useEffect(() => {
    if (open) {
      openedAt.current = Date.now();
      setBusy(false);
    }
  }, [open]);

  const handle = async () => {
    // too fast = almost certainly a double-click carried over
    if (Date.now() - openedAt.current < 450) {
      setShake(true);
      setTimeout(() => setShake(false), 420);
      return;
    }
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      className="max-w-md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "danger" : "primary"}
            onClick={handle}
            loading={busy}
            className={shake ? "shake" : undefined}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
