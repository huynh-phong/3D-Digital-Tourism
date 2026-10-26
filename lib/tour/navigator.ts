"use client";

import { floorFromY } from "@/data/dinh/layout";
import { NAV } from "@/lib/game/config";
import { instruction, project, type Route, type RoutePlanner } from "@/lib/dinh/route";
import { runtime, useGame } from "@/lib/store/game";
import type { Vec3 } from "@/types";
import { DESTINATIONS, DEST_BY_KEY, type Destination } from "./destinations";

/**
 * Visitor directions: keeps the route from the visitor to the selected
 * destination up to date (replanned only when they moved or the target
 * changed, at most a few times per second), and publishes the coarse HUD
 * values (distance, next turn, arrival) to the store when they change.
 * The 3D line and marker read `navRuntime` every frame.
 */
export const navRuntime = {
  planner: null as RoutePlanner | null,
  route: null as Route | null,
  /** bumps whenever `route` is replaced (render rebuilds its geometry) */
  version: 0,
  /** arc length of the visitor's position on the route (for trimming the drawn line) */
  progress: 0,
  arrivedAt: 0,
  lastFrom: [0, -999, 0] as Vec3,
  lastPlan: -1,
  lastKey: null as string | null,
  lastHintCheck: -1,
};

export function setPlanner(p: RoutePlanner | null) {
  navRuntime.planner = p;
  navRuntime.route = null;
  navRuntime.version++;
  navRuntime.lastKey = null;
}

/** Select (or clear) a destination. `lead` asks Minh Anh to walk ahead to it. */
export function setDestination(key: string | null, lead?: boolean) {
  const g = useGame.getState();
  if (!key) {
    useGame.setState({ destination: null, navStatus: "idle", navHint: null, guideLeading: g.mode === "guided" ? g.guideLeading : false });
    return;
  }
  useGame.setState({
    destination: key,
    navStatus: "active",
    navHint: null,
    guideLeading: lead ?? (g.mode === "guided"),
  });
  navRuntime.lastKey = null; // force a replan
}

export const currentDestination = (): Destination | undefined => {
  const k = useGame.getState().destination;
  return k ? DEST_BY_KEY.get(k) : undefined;
};

const sameFloor = (a: Vec3, b: Vec3) => floorFromY(a[1]) === floorFromY(b[1]);
const flat = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[2] - b[2]);

/** Called every frame from the scene. */
export function tickNavigator(now: number) {
  const g = useGame.getState();
  const planner = navRuntime.planner;
  const dest = g.destination ? DEST_BY_KEY.get(g.destination) : undefined;
  if (!planner || !dest || g.phase !== "playing") {
    if (navRuntime.route && !dest) {
      navRuntime.route = null;
      navRuntime.version++;
    }
    return;
  }
  const P = runtime.player;

  // Arrival
  if (g.navStatus === "active" && sameFloor(P, dest.point) && flat(P, dest.point) < dest.radius) {
    useGame.setState({ navStatus: "arrived", navDistance: 0 });
    navRuntime.arrivedAt = now;
    navRuntime.route = null;
    navRuntime.version++;
    return;
  }
  if (g.navStatus === "arrived") {
    // walked away again → directions resume
    if (!sameFloor(P, dest.point) || flat(P, dest.point) > dest.radius + 4) {
      useGame.setState({ navStatus: "active" });
      navRuntime.lastKey = null;
    }
    return;
  }

  // Replan when the target changed, or the visitor moved enough (rate-limited)
  const moved = Math.hypot(P[0] - navRuntime.lastFrom[0], (P[1] - navRuntime.lastFrom[1]) * 2, P[2] - navRuntime.lastFrom[2]);
  const keyChanged = navRuntime.lastKey !== dest.key;
  if (keyChanged || (moved > NAV.replanMove && now - navRuntime.lastPlan > NAV.replanInterval)) {
    navRuntime.lastKey = dest.key;
    navRuntime.lastPlan = now;
    navRuntime.lastFrom = [...P];
    const r = planner.plan(P, dest.point);
    navRuntime.route = r;
    navRuntime.version++;
    if (!r) {
      // No walkable connection: say so and suggest the nearest place that is reachable.
      if (g.navStatus !== "noPath" || now - navRuntime.lastHintCheck > 2) {
        navRuntime.lastHintCheck = now;
        const hint = DESTINATIONS.filter((d) => d.key !== dest.key)
          .sort((a, b) => flat(a.point, P) - flat(b.point, P))
          .slice(0, 6)
          .find((d) => planner.plan(P, d.point));
        useGame.setState({ navStatus: "noPath", navHint: hint?.key ?? null });
      }
      return;
    }
    if (g.navStatus !== "active" || g.navExact !== r.exact) useGame.setState({ navStatus: "active", navExact: r.exact, navHint: null });
  }

  const r = navRuntime.route;
  if (!r) return;
  const s = project(r, P).s;
  navRuntime.progress = s;
  const dist = Math.max(0, Math.round(r.length - s));
  const turn = instruction(r, s, runtime.cameraYaw);
  if (dist !== g.navDistance || turn !== g.navTurn) useGame.setState({ navDistance: dist, navTurn: turn });
}
