"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CloudOff, Loader2, Wifi } from "lucide-react";
import { useNetworkStatus } from "@/components/network-provider";
import { tEnter, tExit } from "@/lib/motion";

/**
 * Offline / reconnecting / restored banner (§27).
 *
 * Rendered globally under the app shell. It is announced to assistive tech via
 * `aria-live="polite"` so a loss of connectivity is surfaced to everyone, and
 * it collapses to an instant cut under `prefers-reduced-motion` (handled by the
 * global override). When the connection returns it shows the "Back online"
 * confirmation for a moment, then disappears.
 */
export function OfflineBanner() {
  const { status } = useNetworkStatus();

  const [restored, setRestored] = React.useState(false);
  const wasOffline = React.useRef(false);

  React.useEffect(() => {
    if (status === "offline") {
      wasOffline.current = true;
      setRestored(false);
    } else if (status === "online" && wasOffline.current) {
      wasOffline.current = false;
      setRestored(true);
      const t = setTimeout(() => setRestored(false), 2600);
      return () => clearTimeout(t);
    }
  }, [status]);

  const showBanner = status !== "online";

  return (
    <div aria-live="polite" aria-atomic="false">
      <AnimatePresence>
        {showBanner && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: tExit() }}
            transition={tEnter(0.2)}
            className="sticky top-0 z-40 border-b border-[--warning]/30 bg-[--warning]/10 text-[--warning]"
          >
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-[12.5px] font-medium tracking-[-0.005em]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[--warning]/20">
                {status === "offline" ? (
                  <CloudOff className="h-3 w-3 shrink-0" />
                ) : (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                )}
              </span>
              {status === "offline" ? (
                <span>
                  You&apos;re offline. Reconnect to send messages.
                </span>
              ) : (
                <span>Reconnecting…</span>
              )}
            </div>
          </motion.div>
        )}

        {/* transient "back online" confirmation */}
        {!showBanner && restored && (
          <motion.div
            role="status"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: tExit() }}
            transition={tEnter(0.2)}
            className="sticky top-0 z-40 border-b border-[--success]/25 bg-[--success-subtle]/70 backdrop-blur-md supports-[backdrop-filter]:bg-[--success-subtle]/55"
          >
            <div className="flex items-center justify-center gap-2 px-4 py-1.5 text-[12.5px] font-medium tracking-[-0.005em] text-[--success]">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[--success]/12">
                <Wifi className="h-3 w-3 shrink-0" />
              </span>
              <span>Back online</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}