"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Monitor, Moon, Sun } from "lucide-react";
import type { ThemePref } from "@/lib/types";
import { cn } from "@/lib/utils";
import { SPRING, tEnter } from "@/lib/motion";

const KEY = "aichat.theme";

interface Ctx {
  pref: ThemePref;
  resolved: "light" | "dark";
  setPref: (p: ThemePref) => void;
}
const ThemeCtx = React.createContext<Ctx>({
  pref: "system",
  resolved: "light",
  setPref: () => {},
});
export const useTheme = () => React.useContext(ThemeCtx);

/** Inlined in <head> to prevent a flash of the wrong theme. */
export const themeScript = `(function(){try{var p=localStorage.getItem("${KEY}")||"system";var m=window.matchMedia("(prefers-color-scheme: dark)").matches;var d=p==="dark"||(p==="system"&&m);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = React.useState<ThemePref>("system");
  const [resolved, setResolved] = React.useState<"light" | "dark">("light");

  const apply = React.useCallback((p: ThemePref) => {
    const sysDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = p === "dark" || (p === "system" && sysDark);
    document.documentElement.classList.toggle("dark", dark);
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    setResolved(dark ? "dark" : "light");
  }, []);

  React.useEffect(() => {
    const stored = (localStorage.getItem(KEY) as ThemePref) ?? "system";
    setPrefState(stored);
    apply(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if ((localStorage.getItem(KEY) as ThemePref) === "system") apply("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [apply]);

  const setPref = React.useCallback(
    (p: ThemePref) => {
      localStorage.setItem(KEY, p);
      setPrefState(p);
      apply(p);
    },
    [apply],
  );

  return <ThemeCtx.Provider value={{ pref, resolved, setPref }}>{children}</ThemeCtx.Provider>;
}

/** Icon morphs sun<->moon with rotate+fade, never an instant swap. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPref } = useTheme();
  const dark = resolved === "dark";

  return (
    <motion.button
      onClick={() => setPref(dark ? "light" : "dark")}
      whileTap={{ scale: 0.94 }}
      whileHover={{ scale: 1.04 }}
      transition={SPRING}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      className={cn(
        "relative grid h-9 w-9 place-items-center rounded-[--r-md] border border-transparent text-[--fg-muted]",
        "transition-all duration-[--d-micro] hover:border-[--border]/70 hover:bg-[--bg-hover]/80 hover:text-[--fg] hover:backdrop-blur-sm",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/50",
        className,
      )}
    >
      <motion.span
        className="absolute"
        animate={{ opacity: dark ? 0 : 1, rotate: dark ? -90 : 0, scale: dark ? 0.6 : 1 }}
        transition={tEnter()}
      >
        <Sun className="h-[18px] w-[18px]" />
      </motion.span>
      <motion.span
        className="absolute"
        animate={{ opacity: dark ? 1 : 0, rotate: dark ? 0 : 90, scale: dark ? 1 : 0.6 }}
        transition={tEnter()}
      >
        <Moon className="h-[18px] w-[18px]" />
      </motion.span>
    </motion.button>
  );
}

/** Three-way selector used in Settings. */
export function ThemeSegmented() {
  const { pref, setPref } = useTheme();
  const opts: Array<{ value: ThemePref; label: string; icon: React.ElementType }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];
  return (
    <div className="inline-flex rounded-[--r-md] border border-[--border]/70 bg-[--bg-subtle]/50 p-1 backdrop-blur-sm">
      {opts.map((o) => {
        const active = pref === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setPref(o.value)}
            className={cn(
              "relative flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors duration-[--d-micro]",
              active ? "text-[--fg]" : "text-[--fg-muted] hover:text-[--fg]",
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-seg"
                className="absolute inset-0 rounded-[6px] border border-[--border]/60 bg-[--surface] shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,var(--e1)]"
                transition={SPRING}
              />
            )}
            <o.icon className="relative h-3.5 w-3.5" />
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}