"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useSettings, type Action } from "@/lib/store/settings";

const isTyping = (e: KeyboardEvent) => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};

/**
 * Keyboard state for continuous actions (move/run/jump) plus edge-triggered
 * callbacks for one-shot actions. Bindings come from the settings store.
 */
export function useKeyboard(onPress: (action: Action | "pause") => void) {
  const held = useRef(new Set<Action>());
  const press = useRef(onPress);
  useLayoutEffect(() => {
    press.current = onPress;
  });

  useEffect(() => {
    const lookup = () => {
      const keys = useSettings.getState().keys;
      const m = new Map<string, Action>();
      (Object.keys(keys) as Action[]).forEach((a) => m.set(keys[a], a));
      // Arrow keys always move as well.
      m.set("ArrowUp", "forward");
      m.set("ArrowDown", "back");
      m.set("ArrowLeft", "left");
      m.set("ArrowRight", "right");
      if (keys.run === "ShiftLeft") m.set("ShiftRight", "run");
      return m;
    };
    let map = lookup();
    const unsub = useSettings.subscribe(() => (map = lookup()));

    const down = (e: KeyboardEvent) => {
      if (e.code === "Escape") {
        press.current("pause");
        return;
      }
      if (isTyping(e)) return;
      const a = map.get(e.code);
      if (!a) return;
      if (a === "jump" || e.code.startsWith("Arrow")) e.preventDefault();
      if (!held.current.has(a) && !e.repeat) press.current(a);
      held.current.add(a);
    };
    const up = (e: KeyboardEvent) => {
      const a = map.get(e.code);
      if (a) held.current.delete(a);
    };
    const blur = () => held.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      unsub();
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  return held;
}
