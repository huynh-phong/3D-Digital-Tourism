"use client";

import { create } from "zustand";
import { SPACE_BY_ID, type SpaceId } from "@/data/dinh/spaces";

/**
 * Space streaming: which spaces of the palace are mounted, and in what role.
 *
 * - active: rendered, colliders, lights, interactions, navigation.
 * - loading: mounted (behind the fade) until its shaders are compiled.
 * - cached: mounted but hidden, no colliders, animations paused — so coming
 *   straight back is instant. At most CACHE_MAX spaces, least recently used
 *   first out, and only spaces whose policy is "lru".
 *
 * Everything else is unmounted: its geometries are disposed by the components
 * that created them. Shared materials/textures belong to the scene.
 */
export type RoomStatus = "ROOM_ACTIVE" | "LOADING_TARGET_ROOM" | "TRANSITIONING" | "TARGET_ROOM_ACTIVE" | "LOADING_FAILED";

export const CACHE_MAX = 1;
// 15 s: a room whose materials are first used there compiles all its shader programs while loading (slow on software GL)
export const LOAD_TIMEOUT = 15000;

interface WorldState {
  active: SpaceId;
  loading: SpaceId | null;
  /** most recently left first */
  cached: SpaceId[];
  status: RoomStatus;
  failed: SpaceId | null;
  /** counters for QA (mount/unmount churn, transitions) */
  stats: { transitions: number; loads: number; evictions: number; cacheHits: number };
  /** dev QA only: mount and show every space at once (the pre-split cost, for comparison) */
  debugAll: boolean;
}

const initial = (): Omit<WorldState, "stats"> & { stats: WorldState["stats"] } => ({
  active: "exterior",
  loading: null,
  cached: [],
  status: "ROOM_ACTIVE",
  failed: null,
  stats: { transitions: 0, loads: 0, evictions: 0, cacheHits: 0 },
  debugAll: false,
});

export const useWorld = create<WorldState>()(() => initial());

/** Spaces that must be mounted now. */
export function mountedSpaces(s: Pick<WorldState, "active" | "loading" | "cached"> & { debugAll?: boolean }): SpaceId[] {
  if (s.debugAll) return [...SPACE_BY_ID.keys()];
  return [...new Set([s.active, ...(s.loading ? [s.loading] : []), ...s.cached])];
}

let pending: { id: SpaceId; resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;

/**
 * Make `id` ready: a cached space is ready at once; otherwise it is mounted in
 * "loading" mode and resolves when its scene reports ready (or fails after
 * LOAD_TIMEOUT). Only one load at a time.
 */
export function loadSpace(id: SpaceId): Promise<void> {
  const w = useWorld.getState();
  if (!SPACE_BY_ID.has(id)) return Promise.reject(new Error(`unknown space ${id}`));
  if (id === w.active || w.cached.includes(id)) {
    if (id !== w.active) useWorld.setState({ stats: { ...w.stats, cacheHits: w.stats.cacheHits + 1 } });
    return Promise.resolve();
  }
  if (pending) return Promise.reject(new Error("a space is already loading"));
  useWorld.setState({ loading: id, status: "LOADING_TARGET_ROOM", failed: null, stats: { ...w.stats, loads: w.stats.loads + 1 } });
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => failLoad(id, new Error("timeout")), LOAD_TIMEOUT);
    pending = { id, resolve, reject, timer };
  });
}

/** Called by the scene when a loading space has compiled. */
export function spaceReady(id: SpaceId) {
  if (!pending || pending.id !== id) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  p.resolve();
}

/** The target could not be prepared: drop it, stay where we are. */
export function failLoad(id: SpaceId, err: Error) {
  if (!pending || pending.id !== id) return;
  clearTimeout(pending.timer);
  const p = pending;
  pending = null;
  useWorld.setState({ loading: null, status: "LOADING_FAILED", failed: id });
  p.reject(err);
}

/**
 * Switch to `id` (already loaded or cached). The space left goes to the
 * cache if its policy allows; the oldest cached spaces beyond CACHE_MAX are
 * evicted (unmounted → disposed).
 */
export function activateSpace(id: SpaceId) {
  const w = useWorld.getState();
  if (id === w.active) {
    useWorld.setState({ loading: null, status: "TARGET_ROOM_ACTIVE" });
    return;
  }
  const left = w.active;
  let cached = w.cached.filter((c) => c !== id);
  if (SPACE_BY_ID.get(left)!.cachePolicy === "lru") cached = [left, ...cached];
  const evicted = cached.slice(CACHE_MAX);
  cached = cached.slice(0, CACHE_MAX);
  useWorld.setState({
    active: id,
    loading: null,
    cached,
    status: "TARGET_ROOM_ACTIVE",
    stats: { ...w.stats, transitions: w.stats.transitions + 1, evictions: w.stats.evictions + evicted.length + (SPACE_BY_ID.get(left)!.cachePolicy === "lru" ? 0 : 1) },
  });
}

export function setRoomStatus(status: RoomStatus) {
  useWorld.setState({ status });
}

/** Fresh world (scene restart). */
export function resetWorld(start: SpaceId = "exterior") {
  if (pending) {
    clearTimeout(pending.timer);
    pending = null;
  }
  useWorld.setState({ ...initial(), active: start });
}
