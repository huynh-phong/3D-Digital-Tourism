"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Lang } from "@/types";

export type ThemePref = "light" | "dark" | "system";
export type Quality = "low" | "medium" | "high";
export type VoiceMode = "cloud" | "none";

export type Action =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "run"
  | "interact"
  | "camera"
  | "jump"
  | "map"
  | "help"
  | "guide"
  | "chat"
  | "lock";

export const DEFAULT_KEYS: Record<Action, string> = {
  forward: "KeyW",
  back: "KeyS",
  left: "KeyA",
  right: "KeyD",
  run: "ShiftLeft",
  interact: "KeyE",
  camera: "KeyV",
  jump: "Space",
  map: "KeyM",
  help: "KeyH",
  guide: "KeyG",
  chat: "Enter",
  lock: "KeyL",
};

/** Esc is reserved for pause (browsers also use it to release pointer lock). */
export const RESERVED_KEYS = new Set(["Escape"]);

export interface SettingsState {
  lang: Lang;
  theme: ThemePref;
  quality: Quality;
  voiceEnabled: boolean;
  voiceMode: VoiceMode;
  volume: number; // 0..1
  rate: number; // 0.75..1.5
  subtitles: boolean;
  autoNarrate: boolean;
  sensitivity: number; // 0.25..2
  invertY: boolean;
  reducedMotion: boolean | null; // null = follow OS
  keys: Record<Action, string>;
  showHelp: boolean;
  set: (patch: Partial<Omit<SettingsState, "set" | "bindKey" | "resetKeys">>) => void;
  /** Returns false when the key is reserved or used by another action. */
  bindKey: (action: Action, code: string) => boolean;
  resetKeys: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      lang: "vi",
      theme: "system",
      quality: "medium",
      voiceEnabled: true,
      voiceMode: "cloud",
      volume: 0.9,
      rate: 1,
      subtitles: true,
      autoNarrate: true,
      sensitivity: 1,
      invertY: false,
      reducedMotion: null,
      keys: { ...DEFAULT_KEYS },
      showHelp: true,
      set: (patch) => set(patch),
      bindKey: (action, code) => {
        if (RESERVED_KEYS.has(code)) return false;
        const keys = get().keys;
        const clash = (Object.keys(keys) as Action[]).find((a) => a !== action && keys[a] === code);
        if (clash) return false;
        set({ keys: { ...keys, [action]: code } });
        return true;
      },
      resetKeys: () => set({ keys: { ...DEFAULT_KEYS } }),
    }),
    {
      name: "sg3d-settings",
      version: 1,
      // Rehydrated in <Providers> after mount so SSR markup matches the first client render.
      skipHydration: true,
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          // Private mode / blocked storage: fall back to memory.
          const mem = new Map<string, string>();
          return {
            getItem: (k: string) => mem.get(k) ?? null,
            setItem: (k: string, v: string) => void mem.set(k, v),
            removeItem: (k: string) => void mem.delete(k),
          };
        }
      }),
      // Older saves may miss newly added key bindings.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SettingsState>;
        // the browser-voice mode no longer exists: Minh Anh always speaks with the ElevenLabs voice
        const voiceMode: VoiceMode = (p.voiceMode as string) === "none" ? "none" : "cloud";
        return { ...current, ...p, voiceMode, keys: { ...DEFAULT_KEYS, ...(p.keys ?? {}) } };
      },
      // Persist data only, not the action functions.
      partialize: (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => typeof v !== "function")) as Partial<SettingsState>,
    },
  ),
);

export function keyLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const map: Record<string, string> = {
    Space: "Space",
    ShiftLeft: "Shift",
    ShiftRight: "Shift R",
    ControlLeft: "Ctrl",
    AltLeft: "Alt",
    Enter: "Enter",
    Tab: "Tab",
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Escape: "Esc",
  };
  return map[code] ?? code;
}
