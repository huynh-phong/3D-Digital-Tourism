"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FloorId, Vec3 } from "@/types";
import type { RoomId } from "@/data/dinh/layout";
import type { Turn } from "@/lib/dinh/route";

export type Phase = "loading" | "intro" | "choose" | "playing" | "paused";
export type TourMode = "guided" | "free";
export type CamMode = "first" | "third";
/** Minh Anh's behaviour (see lib/guide/brain.ts). */
export type GuideState =
  | "WAITING" // idle: before the tour, at a finished stop, or no route
  | "LEADING" // walking ahead along the route
  | "CHECKING_DISTANCE" // visitor fell behind: slowing down to a stop
  | "WAITING_FOR_PLAYER" // stopped, facing the visitor
  | "REMINDING" // short spoken reminder while waiting
  | "EXPLAINING" // narrating at the stop
  | "LISTENING" // the visitor is asking a question
  | "RESUMING" // visitor caught up: turning back to the route
  | "FOLLOWING"; // free exploration: stays near the visitor
export type NavStatus = "idle" | "active" | "arrived" | "noPath";
/** HUD notices about the guide */
export type GuideNotice = "waiting" | "narrationPaused" | "noRoute" | "shortcut" | null;
export type Panel =
  | { kind: "stop"; id: string }
  | { kind: "interactable"; id: string }
  | { kind: "stairs"; id: "stair-roof" | "stair-basement"; dir: "up" | "down" }
  | { kind: "complete" }
  | null;

/**
 * Per-frame data lives in this plain object (mutated in useFrame) so React
 * doesn't re-render 60×/s. UI reads the coarse state from the zustand store.
 */
export const runtime = {
  player: [0, 0, 140] as Vec3,
  playerYaw: Math.PI,
  playerSpeed: 0,
  guide: [3, 0, 138] as Vec3,
  cameraYaw: Math.PI,
  input: { x: 0, y: 0, run: false, jump: false }, // touch joystick
  lookDelta: { x: 0, y: 0 },
};

interface GameState {
  phase: Phase;
  mode: TourMode;
  camMode: CamMode;
  floor: FloorId;
  room: RoomId | null;
  nearby: { kind: "stop" | "interactable" | "stairs"; id: string } | null;
  currentStopId: string | null; // stop the player is standing at
  targetStopId: string | null; // stop Minh Anh is leading to
  panel: Panel;
  mapOpen: boolean;
  chatOpen: boolean;
  guideState: GuideState;
  guideFar: boolean;
  /** Minh Anh leads to the current destination (always in the guided tour, on request in free mode) */
  guideLeading: boolean;
  guideNotice: GuideNotice;
  /** distance between visitor and guide when she waits (rounded, m) */
  guideGap: number;
  /** selected destination key (lib/tour/destinations) */
  destination: string | null;
  navStatus: NavStatus;
  navDistance: number;
  navTurn: Turn;
  navExact: boolean;
  /** when no route exists: a destination that is reachable, if any */
  navHint: string | null;
  teleport: { pos: Vec3; yaw: number; nonce: number } | null;
  sceneKey: number;
  set: (patch: Partial<GameState>) => void;
  requestTeleport: (pos: Vec3, yaw: number) => void;
  restart: () => void;
}

export const useGame = create<GameState>()((set) => ({
  phase: "loading",
  mode: "guided",
  camMode: "third",
  floor: "grounds",
  room: null,
  nearby: null,
  currentStopId: null,
  targetStopId: null,
  panel: null,
  mapOpen: false,
  chatOpen: false,
  guideState: "WAITING",
  guideFar: false,
  guideLeading: false,
  guideNotice: null,
  guideGap: 0,
  destination: null,
  navStatus: "idle",
  navDistance: 0,
  navTurn: "straight",
  navExact: true,
  navHint: null,
  teleport: null,
  sceneKey: 0,
  set: (patch) => set(patch),
  requestTeleport: (pos, yaw) => set({ teleport: { pos, yaw, nonce: Math.random() } }),
  restart: () =>
    set((s) => ({
      sceneKey: s.sceneKey + 1,
      phase: "loading",
      panel: null,
      mapOpen: false,
      chatOpen: false,
      targetStopId: null,
      currentStopId: null,
      nearby: null,
      guideState: "WAITING",
      guideFar: false,
      guideLeading: false,
      guideNotice: null,
      destination: null,
      navStatus: "idle",
      navHint: null,
    })),
}));

/** Tour progress survives reloads (per browser). */
interface ProgressState {
  completed: string[];
  complete: (id: string) => void;
  reset: () => void;
}

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      completed: [],
      complete: (id) => set((s) => (s.completed.includes(id) ? s : { completed: [...s.completed, id] })),
      reset: () => set({ completed: [] }),
    }),
    { name: "sg3d-progress", storage: createJSONStorage(() => localStorage), skipHydration: true },
  ),
);
