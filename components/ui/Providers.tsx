"use client";

import { useEffect, type ReactNode } from "react";
import { useProgress } from "@/lib/store/game";
import { useSettings } from "@/lib/store/settings";

/** Rehydrates persisted stores after mount and mirrors settings onto <html>. */
export function Providers({ children }: { children: ReactNode }) {
  const theme = useSettings((s) => s.theme);
  const lang = useSettings((s) => s.lang);
  const reducedMotion = useSettings((s) => s.reducedMotion);

  useEffect(() => {
    void useSettings.persist.rehydrate();
    void useProgress.persist.rehydrate();
  }, []);

  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = theme === "dark" || (theme === "system" && mq.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      document.documentElement.dataset.reducedMotion = String(reducedMotion ?? mq.matches);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [reducedMotion]);

  return <>{children}</>;
}

export function useReducedMotion(): boolean {
  const pref = useSettings((s) => s.reducedMotion);
  if (pref !== null) return pref;
  if (typeof window === "undefined") return false;
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useResolvedTheme(): "light" | "dark" {
  const theme = useSettings((s) => s.theme);
  if (theme !== "system") return theme;
  if (typeof window === "undefined") return "light";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
