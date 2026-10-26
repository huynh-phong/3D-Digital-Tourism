"use client";

import { INTERACTABLES, STOP_BY_ID, TOUR_STOPS } from "@/data/dinh/tour";
import { floorFromY, LEVEL, ROOMS, STAIRS } from "@/data/dinh/layout";
import { narrator, useNarrator } from "@/lib/audio/narrator";
import { nextStopAfter } from "@/lib/knowledge/retrieve";
import { runtime, useGame, useProgress, type TourMode } from "@/lib/store/game";
import { useSettings } from "@/lib/store/settings";
import { guideSignals } from "@/lib/guide/signals";
import type { Vec3 } from "@/types";
import { DEST_BY_KEY, destKey } from "./destinations";
import { setDestination } from "./navigator";

/**
 * Tour flow. One destination drives everything: the route line, the glowing
 * marker and — when she leads — Minh Anh (see components/guide/GuideNPC).
 * In the guided tour the destination is the next stop; in free exploration
 * it is whatever the visitor picked, and Minh Anh leads only when asked.
 */

/** Stair shortcuts (fade-teleport) at each end of the two shafts. */
const sb = STAIRS[0], sr = STAIRS[1];
const mid = (x0: number) => x0 + 2.3;
export const STAIR_POINTS: { id: "stair-roof" | "stair-basement"; dir: "up" | "down"; at: Vec3; to: Vec3; yaw: number }[] = [
  { id: "stair-roof", dir: "up", at: [mid(sr.x0), LEVEL.f1, -62.6], to: [mid(sr.x0), LEVEL.roof, -61], yaw: 0 },
  { id: "stair-roof", dir: "down", at: [mid(sr.x0), LEVEL.roof, -62.2], to: [mid(sr.x0), LEVEL.f1, -61.6], yaw: 0 },
  { id: "stair-basement", dir: "down", at: [mid(sb.x0), LEVEL.f1, -62.6], to: [mid(sb.x0), LEVEL.basement, -61.6], yaw: 0 },
  { id: "stair-basement", dir: "up", at: [mid(sb.x0), LEVEL.basement, -62.6], to: [mid(sb.x0), LEVEL.f1, -61.6], yaw: 0 },
];

/** Stops already narrated automatically in this visit (avoid repeating). */
const narrated = new Set<string>();
export function resetNarrated() {
  narrated.clear();
}
export const isNarrated = (id: string) => narrated.has(id);

const same = (a: Vec3, b: Vec3) => floorFromY(a[1]) === floorFromY(b[1]);
const d2 = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Called ~6×/s from the scene: current room / stop / nearby interaction for the HUD. */
export function tickProximity() {
  const g = useGame.getState();
  if (g.phase !== "playing") return;
  const P = runtime.player;

  const floor = floorFromY(P[1]);
  const room = ROOMS.find((r) => r.floor === floor && P[0] >= r.rect.x0 && P[0] <= r.rect.x1 && P[2] >= r.rect.z0 && P[2] <= r.rect.z1)?.id ?? null;
  if (floor !== g.floor || room !== g.room) useGame.setState({ floor, room });

  const stop = TOUR_STOPS.find((s) => same(s.position, P) && d2(s.position, P) < s.radius);
  const currentStopId = stop?.id ?? null;

  let nearby: typeof g.nearby = null;
  let best = Infinity;
  for (const i of INTERACTABLES) {
    const d = d2(i.position, P);
    if (same(i.position, P) && d < i.radius && d < best) { best = d; nearby = { kind: "interactable", id: i.id }; }
  }
  for (let k = 0; k < STAIR_POINTS.length; k++) {
    const s = STAIR_POINTS[k];
    const d = d2(s.at, P);
    if (Math.abs(s.at[1] - P[1]) < 1.2 && d < 2.2 && d < best) { best = d; nearby = { kind: "stairs", id: String(k) }; }
  }
  if (!nearby && stop) nearby = { kind: "stop", id: stop.id };

  if (currentStopId !== g.currentStopId || JSON.stringify(nearby) !== JSON.stringify(g.nearby)) {
    useGame.setState({ currentStopId, nearby });
  }
}

/** Minh Anh reached the stop with the visitor beside her: mark complete, then narrate (or just open the card). */
export function arriveAt(stopId: string, narrate: boolean) {
  narrated.add(stopId);
  useProgress.getState().complete(stopId);
  if (narrate) playStop(stopId, "main");
  else useGame.setState({ panel: { kind: "stop", id: stopId } });
}

export function playStop(stopId: string, layer: "quick" | "main" | "deep") {
  const stop = STOP_BY_ID.get(stopId);
  if (!stop) return;
  const lang = useSettings.getState().lang;
  const text = layer === "main" ? `${stop.narration.quick[lang]} ${stop.narration.main[lang]}` : stop.narration[layer][lang];
  narrator?.play(text, lang, `${stopId}:${layer}`, stop.title[lang]);
}

/** When the tour is finished and the last narration ends, show the completion card. */
export function watchNarrationEnd() {
  return useNarrator.subscribe((s, prev) => {
    if (prev.status !== "idle" && s.status === "idle") {
      const g = useGame.getState();
      const done = useProgress.getState().completed;
      if (g.mode === "guided" && TOUR_STOPS.every((t) => done.includes(t.id)) && !g.panel) {
        useGame.setState({ panel: { kind: "complete" } });
      }
    }
  });
}

/** "Continue" in guided mode: lead to the next unfinished stop. */
export function continueTour() {
  const next = nextStopAfter(useProgress.getState().completed);
  narrator?.stop();
  if (!next) {
    useGame.setState({ targetStopId: null, panel: { kind: "complete" }, guideLeading: false });
    setDestination(null);
    return;
  }
  useGame.setState({ targetStopId: next, panel: null });
  setDestination(destKey("stop", next), true);
}

/** "Directions" to a tour stop (stop list, floor map). Minh Anh leads in the guided tour. */
export function goToStop(stopId: string) {
  narrator?.stop();
  const g = useGame.getState();
  if (g.mode === "guided") {
    useGame.setState({ targetStopId: stopId });
    setDestination(destKey("stop", stopId), true);
  } else {
    setDestination(destKey("stop", stopId), false);
  }
}

/** Directions to any destination key (stop, exhibit, room). */
export function navigateTo(key: string) {
  const d = DEST_BY_KEY.get(key);
  if (!d) return;
  if (d.kind === "stop") return goToStop(d.id);
  const g = useGame.getState();
  // A detour during the guided tour: Minh Anh takes you there, then the tour can resume.
  if (g.mode === "guided") narrator?.stop();
  setDestination(key, g.mode === "guided");
}

export function askGuideToLead() {
  const k = useGame.getState().destination;
  if (k) setDestination(k, true);
}

export function cancelNavigation() {
  setDestination(null);
  useGame.setState({ guideLeading: false });
}

export function setMode(mode: TourMode) {
  narrator?.stop();
  if (mode === "guided") {
    const next = nextStopAfter(useProgress.getState().completed) ?? TOUR_STOPS[0].id;
    useGame.setState({ mode, targetStopId: next });
    setDestination(destKey("stop", next), true);
  } else {
    useGame.setState({ mode, targetStopId: null, guideLeading: false });
    setDestination(null);
  }
}

/** E key. */
export function interact() {
  const g = useGame.getState();
  if (g.panel) {
    useGame.setState({ panel: null });
    return;
  }
  const n = g.nearby;
  if (!n) return;
  if (n.kind === "stairs") {
    const s = STAIR_POINTS[Number(n.id)];
    useGame.setState({ panel: { kind: "stairs", id: s.id, dir: s.dir } });
  } else if (n.kind === "interactable") {
    useGame.setState({ panel: { kind: "interactable", id: n.id } });
  } else {
    narrated.add(n.id);
    useProgress.getState().complete(n.id);
    useGame.setState({ panel: { kind: "stop", id: n.id } });
    playStop(n.id, "main");
  }
}

export function takeStairs(id: "stair-roof" | "stair-basement", dir: "up" | "down") {
  const s = STAIR_POINTS.find((p) => p.id === id && p.dir === dir);
  if (!s) return;
  useGame.getState().requestTeleport(s.to, s.yaw);
  guideSignals.snapBehindPlayer = true;
  useGame.setState({ panel: null });
}

export function callGuide() {
  guideSignals.call = true;
}
