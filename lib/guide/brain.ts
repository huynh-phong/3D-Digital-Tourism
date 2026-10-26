import { GUIDE } from "@/lib/game/config";
import type { GuideState } from "@/lib/store/game";

/**
 * Minh Anh's decision making, separated from rendering so it can be tested.
 *
 * LEADING        walk ahead along the route, pacing to stay 2–4 m in front
 * CHECKING_DISTANCE  the visitor dropped back (> waitDist for waitAfter s): slow to a stop
 * WAITING_FOR_PLAYER stopped, facing the visitor, idle "waiting" animation
 * REMINDING      a short spoken reminder (only when far, rate-limited, max N in a row)
 * RESUMING       visitor caught up (< resumeDist for resumeAfter s): turn back and go on
 * EXPLAINING     at the stop, narrating; pauses the narration when the visitor walks away
 * LISTENING      the visitor opened the question box nearby
 * WAITING        idle (tour not started, stop finished, no valid route)
 * FOLLOWING      free exploration: stays near the visitor
 *
 * Every transition that depends on a distance uses separate enter/leave
 * thresholds plus a dwell time, so a distance hovering around one value can
 * never make her flicker between states.
 */
export interface BrainInput {
  /** what the tour wants: lead to a spot, follow the visitor, or stay */
  intent: "lead" | "follow" | "idle";
  /** visitor ↔ guide straight-line distance (Infinity on another floor) */
  dist: number;
  /** how far she is ahead of the visitor along her route (negative: visitor is ahead); null if unknown */
  gap: number | null;
  playerSpeed: number;
  /** she reached her spot at the destination */
  atSpot: boolean;
  /** visitor ↔ destination distance (Infinity on another floor) */
  playerToSpot: number;
  /** a stop narration is due at this destination (guided tour, not yet heard) */
  explainDue: boolean;
  narrating: boolean;
  chatOpen: boolean;
  /** a route to her goal exists */
  hasRoute: boolean;
}

export type BrainEvent = "remind" | "resume" | "arrived" | "startExplain" | "pauseNarration" | "resumeNarration" | "noRoute";

export interface BrainOutput {
  state: GuideState;
  /** desired walking speed along her route, m/s (0 = stand) */
  speed: number;
  events: BrainEvent[];
}

export class GuideBrain {
  state: GuideState = "WAITING";
  private t = 0; // time in the current state
  private farFor = 0; // time the visitor has been beyond waitDist
  private nearFor = 0; // time the visitor has been within resumeDist
  private veryFarFor = 0;
  private lastRemind = -Infinity;
  private reminders = 0;
  private waitedFor = 0;
  private clock = 0;
  private speed = 0;
  private narrationPaused = false;
  private beforeListen: GuideState = "WAITING";

  /** Forget timers (new destination, teleport). */
  reset(state: GuideState = "WAITING") {
    this.go(state);
    this.farFor = this.nearFor = this.veryFarFor = 0;
    this.reminders = 0;
    this.narrationPaused = false;
    this.speed = 0;
  }

  private go(s: GuideState) {
    if (s !== this.state) {
      this.state = s;
      this.t = 0;
    }
  }

  update(dt: number, i: BrainInput): BrainOutput {
    const ev: BrainEvent[] = [];
    this.clock += dt;
    this.t += dt;
    const g = GUIDE;
    const gap = i.gap ?? i.dist;

    // Listening interrupts anything but the narration itself.
    if (i.chatOpen && i.dist < 10 && this.state !== "EXPLAINING" && this.state !== "LISTENING") {
      this.beforeListen = this.state === "REMINDING" ? "WAITING_FOR_PLAYER" : this.state;
      this.go("LISTENING");
    }
    if (this.state === "LISTENING" && (!i.chatOpen || i.dist >= 12)) this.go(this.beforeListen === "LEADING" ? "RESUMING" : this.beforeListen);

    // Intent changes
    if (i.intent === "follow" && !["FOLLOWING", "LISTENING", "EXPLAINING"].includes(this.state)) this.go("FOLLOWING");
    if (i.intent === "idle" && !["WAITING", "LISTENING", "EXPLAINING"].includes(this.state)) this.go("WAITING");
    if (i.intent === "lead" && (this.state === "FOLLOWING" || (this.state === "WAITING" && !i.atSpot && i.hasRoute))) this.go("LEADING");
    if (i.intent === "lead" && !i.hasRoute && ["LEADING", "CHECKING_DISTANCE", "RESUMING"].includes(this.state)) {
      this.go("WAITING");
      ev.push("noRoute");
    }

    // Distance bookkeeping with dwell times
    // (she eases off as the gap nears waitDist, so "near the limit" must count too)
    this.farFor = gap > g.waitDist - 0.4 ? this.farFor + dt : 0;
    this.nearFor = i.dist < g.resumeDist ? this.nearFor + dt : 0;
    this.veryFarFor = i.dist > g.remindDist ? this.veryFarFor + dt : 0;

    let target = 0;
    switch (this.state) {
      case "LEADING": {
        if (i.atSpot) {
          this.go("WAITING");
          ev.push("arrived");
          break;
        }
        if (this.farFor > g.waitAfter) {
          this.go("CHECKING_DISTANCE");
          break;
        }
        // pace: hurry when the visitor is close behind (or ahead), match them in the band, ease off beyond it
        const v = Math.max(1.2, i.playerSpeed);
        if (gap < g.leadMin) target = Math.min(g.hurry, Math.max(g.walk, i.playerSpeed + 1.2));
        else if (gap <= g.leadMax) target = Math.min(g.hurry, v);
        else target = Math.max(0, v * (g.waitDist - gap) / (g.waitDist - g.leadMax));
        break;
      }
      case "CHECKING_DISTANCE": {
        target = 0; // decelerate to a stop where she is (always on the walkable route)
        if (gap < g.leadMax) this.go("LEADING");
        else if (this.speed < 0.05) {
          this.go("WAITING_FOR_PLAYER");
          this.waitedFor = 0;
        }
        break;
      }
      case "WAITING_FOR_PLAYER": {
        this.waitedFor += dt;
        if (this.nearFor > g.resumeAfter || gap < g.leadMin) {
          if (this.waitedFor > 4) ev.push("resume");
          this.reminders = 0;
          this.go("RESUMING");
        } else if (
          this.veryFarFor > g.remindAfter &&
          this.clock - this.lastRemind > g.remindCooldown &&
          this.reminders < g.maxReminders &&
          !i.narrating
        ) {
          this.lastRemind = this.clock;
          this.reminders++;
          ev.push("remind");
          this.go("REMINDING");
        }
        break;
      }
      case "REMINDING":
        this.waitedFor += dt;
        if (this.t > 3.5 || this.nearFor > g.resumeAfter) this.go("WAITING_FOR_PLAYER");
        break;
      case "RESUMING":
        // a beat to turn toward the route, then walk on
        target = this.t > 0.6 ? g.walk * 0.6 : 0;
        if (this.t > 1.0) this.go(i.intent === "lead" ? "LEADING" : "WAITING");
        break;
      case "WAITING":
        // at the destination: explain once the visitor is close enough to listen
        if (i.intent === "lead" && i.atSpot && i.explainDue && !i.narrating && i.playerToSpot < g.listenDist) {
          this.go("EXPLAINING");
          this.narrationPaused = false;
          ev.push("startExplain");
        }
        break;
      case "EXPLAINING":
        if (!this.narrationPaused && i.dist > g.pauseNarrationDist) {
          this.narrationPaused = true;
          ev.push("pauseNarration");
        } else if (this.narrationPaused && i.dist < g.pauseNarrationDist - 4) {
          this.narrationPaused = false;
          ev.push("resumeNarration");
        }
        // narration finished (not merely paused by us) → wait for "continue"
        if (!i.narrating && !this.narrationPaused && this.t > 0.5) this.go("WAITING");
        break;
      case "FOLLOWING":
      case "LISTENING":
        break;
    }

    // smooth speed changes (≈ walking acceleration)
    const acc = target > this.speed ? 3 : 4.5;
    this.speed += Math.max(-acc * dt, Math.min(acc * dt, target - this.speed));
    if (target === 0 && this.speed < 0.05) this.speed = 0;
    return { state: this.state, speed: this.speed, events: ev };
  }

  get isNarrationPaused() {
    return this.narrationPaused;
  }
}
