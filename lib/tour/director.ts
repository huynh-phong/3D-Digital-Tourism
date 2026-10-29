"use client";

import { STOP_BY_ID, TOUR_STOPS } from "@/data/dinh/tour";
import { floorFromY, ROOMS } from "@/data/dinh/layout";
import type { Portal } from "@/data/dinh/interactions";
import { INTERACTIONS } from "@/data/dinh/interactions";
import { SPACE_BY_ID, spaceAt } from "@/data/dinh/spaces";
import { interactionById, pickInteraction, portals } from "@/lib/interaction/system";
import { activateSpace, failLoad, loadSpace, setRoomStatus, useWorld } from "@/lib/world/streaming";
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
  // the room name comes from the active space (rooms and spaces share ids where both exist)
  const active = useWorld.getState().active;
  const room = SPACE_BY_ID.get(active)!.room ?? ROOMS.find((r) => r.floor === floor && P[0] >= r.rect.x0 && P[0] <= r.rect.x1 && P[2] >= r.rect.z0 && P[2] <= r.rect.z1)?.id ?? null;
  if (floor !== g.floor || room !== g.room) useGame.setState({ floor, room });

  const stop = TOUR_STOPS.find((s) => same(s.position, P) && d2(s.position, P) < s.radius);
  const currentStopId = stop?.id ?? null;

  // the one interaction point to act on (none while a portal transition runs)
  const pick = g.fade ? null : pickInteraction(P, runtime.playerYaw, INTERACTIONS.filter((i) => i.space === active && !i.walk));
  const nearby = pick ? { id: pick.id } : null;

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

/** Interact key (F): act on the selected point only. */
export function interact() {
  const g = useGame.getState();
  if (portals.busy || g.fade) return; // a transition is running: ignore
  if (g.panel) {
    useGame.setState({ panel: null });
    return;
  }
  const point = g.nearby ? interactionById(g.nearby.id) : null;
  if (!point) return;
  if (point.portal) {
    enterPortal(point.portal);
  } else if (point.kind === "exhibit" && point.ref) {
    useGame.setState({ panel: { kind: "interactable", id: point.ref } });
  } else if (point.kind === "stop" && point.ref) {
    narrated.add(point.ref);
    useProgress.getState().complete(point.ref);
    useGame.setState({ panel: { kind: "stop", id: point.ref } });
    playStop(point.ref, "main");
  }
}

/**
 * Spaces joined by a walked connection (the central staircase): when the
 * visitor's own position is in the other space, that space is loaded and made
 * active where they stand — no fade, no teleport. Both spaces own the
 * stairwell's colliders (sharedRegions), so the flight stays solid meanwhile.
 */
let walking = false;
export function tickPassages() {
  if (walking || portals.busy || useGame.getState().fade || useGame.getState().phase !== "playing") return;
  const active = useWorld.getState().active;
  const P = runtime.player;
  if (!INTERACTIONS.some((i) => i.walk && i.space === active)) return;
  const here = spaceAt(P);
  if (here === active || !INTERACTIONS.some((i) => i.walk && i.space === active && i.portal?.space === here)) return;
  walking = true;
  loadSpace(here)
    .then(() => {
      activateSpace(here);
      guideSignals.snapBehindPlayer = true;
      setRoomStatus("ROOM_ACTIVE");
    })
    .catch((err: Error) => failLoad(here, err))
    .finally(() => {
      walking = false;
    });
}

/** Last door that failed to load its space (for "try again"). */
let lastFailed: Portal | null = null;
export const retryLastPortal = () => lastFailed && enterPortal(lastFailed);

/**
 * Through a door: load the target space behind a fade, switch to it (the
 * space left goes to the cache or is freed), move the visitor, bring Minh Anh.
 */
export function enterPortal(portal: Portal) {
  void portals.run(portal, {
    setFade: (fade) => useGame.setState(fade ? { fade, nearby: null, panel: null } : { fade }),
    load: (space) => loadSpace(space),
    activate: (space) => {
      setRoomStatus("TRANSITIONING");
      activateSpace(space);
      lastFailed = null;
    },
    failed: (space, err) => {
      failLoad(space, err);
      lastFailed = portal;
      console.warn(`[spaces] could not load ${space}:`, err.message);
    },
    teleport: (to, yaw) => useGame.getState().requestTeleport(to, yaw),
    position: () => runtime.player,
    arrived: () => {
      guideSignals.snapBehindPlayer = true;
      runtime.input = { x: 0, y: 0, run: false, jump: false };
      setRoomStatus("ROOM_ACTIVE");
    },
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  });
}

export function callGuide() {
  guideSignals.call = true;
}
