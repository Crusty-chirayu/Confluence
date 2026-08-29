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
            className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-[--warning]/30 bg-[--warning-subtle] px-4 py-1.5 text-[12.5px] font-medium text-[--warning]"
          >
            {status === "offline" ? (
              <>
                <CloudOff className="h-3.5 w-3.5 shrink-0" />
                You&apos;re offline. Messages may not reach the server — they&apos;ll
                be kept locally and you can retry once you reconnect.
              </>
            ) : (
              <>
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                Reconnecting…
              </>
            )}
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
            className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-[--success]/30 bg-[--success-subtle] px-4 py-1.5 text-[12.5px] font-medium text-[--success]"
          >
            <Wifi className="h-3.5 w-3.5 shrink-0" />
            Back online
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
