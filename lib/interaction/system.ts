import { floorFromY } from "@/data/dinh/layout";
import { INTERACTION_BY_ID, INTERACTIONS, type InteractionPoint, type Portal } from "@/data/dinh/interactions";
import type { SpaceId } from "@/data/dinh/spaces";
import type { Vec3 } from "@/types";

/**
 * Interaction system shared by the whole palace: which point (if any) the
 * visitor can act on right now, and the portal transition between spaces:
 * fade out → load the target space (behind the fade) → activate it → move the
 * visitor → wait until they are really there → fade in. If the target cannot
 * be loaded, the visitor stays in the source space, which was never torn down.
 */

/**
 * The point to act on: same floor, inside its radius, passing its condition.
 * Among several, the best score wins — distance, discounted when the visitor
 * faces the point, so "the one I'm looking at" beats "the one beside me".
 * Hints never win over actionable points.
 */
export function pickInteraction(p: Vec3, yaw: number, points: InteractionPoint[] = INTERACTIONS): InteractionPoint | null {
  const floor = floorFromY(p[1]);
  let best: InteractionPoint | null = null;
  let bestScore = Infinity;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  for (const i of points) {
    if (i.floor !== floor || Math.abs(i.at[1] - p[1]) > 2.5) continue;
    const dx = i.at[0] - p[0], dz = i.at[2] - p[2];
    const d = Math.hypot(dx, dz);
    if (d > i.radius || (i.when && !i.when(p))) continue;
    // facing: 1 straight ahead … −1 behind; only matters beyond arm's length
    const facing = d > 0.6 ? (dx * fx + dz * fz) / d : 1;
    let score = (d / i.radius) * (1.35 - 0.35 * facing);
    if (i.kind === "hint") score += 10;
    else if (i.kind === "stop") score += 0.5; // a stop zone is large: exhibits and doors inside it come first
    if (score < bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export const interactionById = (id: string) => INTERACTION_BY_ID.get(id) ?? null;

/** Transition timings (ms). */
export const FADE_OUT = 260, FADE_IN = 320, MAX_WAIT = 900;

export interface TransitionHooks {
  /** fade overlay state for the HUD */
  setFade: (state: "out" | "in" | null) => void;
  /** prepare the target space (mount + compile); rejects if it cannot be loaded */
  load: (space: SpaceId) => Promise<void>;
  /** make the target space the active one (colliders, lights, interactions) */
  activate: (space: SpaceId) => void;
  /** the target failed to load: report it (the visitor stays put) */
  failed: (space: SpaceId, err: Error) => void;
  /** move the visitor (physics teleport) */
  teleport: (to: Vec3, yaw: number) => void;
  /** where the visitor is now (to know the destination is reached) */
  position: () => Vec3;
  /** after arrival: bring Minh Anh along, refresh HUD */
  arrived: (portal: Portal) => void;
  wait: (ms: number) => Promise<void>;
}

/**
 * One portal at a time: requests while a transition runs are dropped (holding
 * or hammering F never queues a second jump).
 */
export class PortalRunner {
  busy = false;
  async run(portal: Portal, hooks: TransitionHooks): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      hooks.setFade("out");
      await hooks.wait(FADE_OUT);
      try {
        await hooks.load(portal.space);
      } catch (e) {
        hooks.failed(portal.space, e as Error);
        hooks.setFade("in");
        await hooks.wait(FADE_IN);
        return false;
      }
      hooks.activate(portal.space);
      // let the physics world register the new colliders before moving the visitor
      await hooks.wait(80);
      hooks.teleport(portal.to, portal.yaw);
      // the scene is "ready" once physics has placed the visitor at the target
      for (let t = 0; t < MAX_WAIT; t += 50) {
        await hooks.wait(50);
        const p = hooks.position();
        if (Math.hypot(p[0] - portal.to[0], p[2] - portal.to[2]) < 0.8 && Math.abs(p[1] - portal.to[1]) < 1.2) break;
      }
      hooks.arrived(portal);
      hooks.setFade("in");
      await hooks.wait(FADE_IN);
      return true;
    } finally {
      hooks.setFade(null);
      this.busy = false;
    }
  }
}

export const portals = new PortalRunner();
