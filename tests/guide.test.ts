import { describe, expect, it } from "vitest";
import { GuideBrain, type BrainEvent, type BrainInput } from "@/lib/guide/brain";
import { GUIDE } from "@/lib/game/config";
import type { GuideState } from "@/lib/store/game";

/**
 * 1-D walk along a 120 m route: the guide's position is driven by the speed
 * the brain asks for, the visitor's by a scripted behaviour.
 */
function simulate(opts: {
  seconds: number;
  player: (t: number, p: number, g: number) => number; // visitor speed (m/s, may be negative)
  routeLen?: number;
  input?: Partial<BrainInput> | ((t: number) => Partial<BrainInput>);
  start?: { g: number; p: number };
}) {
  const brain = new GuideBrain();
  brain.reset("LEADING");
  const L = opts.routeLen ?? 120;
  let g = opts.start?.g ?? 0, p = opts.start?.p ?? -1;
  const dt = 1 / 30;
  const states: GuideState[] = [];
  const events: { t: number; e: BrainEvent }[] = [];
  const gaps: number[] = [];
  const gs: number[] = [];
  for (let k = 0; k < opts.seconds / dt; k++) {
    const t = k * dt;
    const vp = opts.player(t, p, g);
    p = Math.min(L, p + vp * dt);
    const extra = typeof opts.input === "function" ? opts.input(t) : opts.input ?? {};
    const out = brain.update(dt, {
      intent: "lead", dist: Math.abs(g - p), gap: g - p, playerSpeed: Math.abs(vp),
      atSpot: L - g < 0.3, playerToSpot: L - p, explainDue: false, narrating: false, chatOpen: false, hasRoute: true,
      ...extra,
    });
    g = Math.min(L, g + out.speed * dt);
    states.push(out.state);
    out.events.forEach((e) => events.push({ t, e }));
    gaps.push(g - p);
    gs.push(g);
  }
  const transitions = states.filter((s, i) => i > 0 && s !== states[i - 1]).length;
  return { states, events, gaps, gs, g, p, transitions, brain, L };
}

describe("Minh Anh leading behaviour", () => {
  it("stays a few metres ahead of a visitor who walks along, and arrives", () => {
    const r = simulate({ seconds: 50, player: () => 3.0 });
    const leading = r.gaps.filter((_, i) => i > 90 && r.gs[i] < r.L - 4); // after the start, before she reaches the end
    expect(Math.min(...leading)).toBeGreaterThan(0);
    expect(Math.max(...leading)).toBeLessThan(GUIDE.waitDist);
    expect(r.states).not.toContain("WAITING_FOR_PLAYER");
    expect(r.events.map((x) => x.e)).toContain("arrived");
  });

  it("slows down and waits when the visitor stops, without walking off", () => {
    const r = simulate({ seconds: 30, player: (t) => (t < 6 ? 3 : 0) });
    const last = r.states[r.states.length - 1];
    expect(last).toBe("WAITING_FOR_PLAYER");
    // stopped within a reasonable distance ahead of the visitor
    expect(r.gaps[r.gaps.length - 1]).toBeGreaterThan(GUIDE.leadMax);
    expect(r.gaps[r.gaps.length - 1]).toBeLessThan(GUIDE.waitDist + 1.5);
    // close enough to see: no spoken reminder needed
    expect(r.events.filter((x) => x.e === "remind")).toHaveLength(0);
  });

  it("reminds a visitor who walked far away, rarely and at most a few times", () => {
    const r = simulate({ seconds: 120, player: (t) => (t < 5 ? 3 : t < 12 ? -2 : 0) });
    const reminds = r.events.filter((x) => x.e === "remind");
    expect(reminds.length).toBeGreaterThanOrEqual(1);
    expect(reminds.length).toBeLessThanOrEqual(GUIDE.maxReminders);
    for (let i = 1; i < reminds.length; i++) expect(reminds[i].t - reminds[i - 1].t).toBeGreaterThanOrEqual(GUIDE.remindCooldown - 0.1);
  });

  it("does not flicker when the distance hovers around the waiting threshold", () => {
    // visitor stays roughly waitDist behind, jittering ±0.6 m every second
    const r = simulate({
      seconds: 40,
      start: { g: 10, p: 4 },
      player: (t, p, g) => {
        const want = g - GUIDE.waitDist + Math.sin(t * Math.PI * 2) * 0.6;
        return Math.max(-3, Math.min(3, (want - p) * 4));
      },
    });
    expect(r.transitions).toBeLessThanOrEqual(6);
  });

  it("resumes leading once the visitor catches up", () => {
    const r = simulate({ seconds: 40, player: (t) => (t < 5 ? 3 : t < 14 ? 0 : 3) });
    const s = r.states;
    const firstWait = s.indexOf("WAITING_FOR_PLAYER");
    expect(firstWait).toBeGreaterThan(0);
    expect(s.indexOf("RESUMING", firstWait)).toBeGreaterThan(firstWait);
    expect(s.lastIndexOf("LEADING")).toBeGreaterThan(s.indexOf("RESUMING", firstWait));
  });

  it("explains only when she is at the stop and the visitor is close, pausing if they wander off", () => {
    const brain = new GuideBrain();
    brain.reset("WAITING");
    const base: BrainInput = { intent: "lead", dist: 20, gap: 20, playerSpeed: 0, atSpot: true, playerToSpot: 20, explainDue: true, narrating: false, chatOpen: false, hasRoute: true };
    expect(brain.update(0.1, base).events).not.toContain("startExplain"); // visitor too far
    const start = brain.update(0.1, { ...base, dist: 3, playerToSpot: 3 });
    expect(start.events).toContain("startExplain");
    expect(start.state).toBe("EXPLAINING");
    const away = brain.update(0.1, { ...base, dist: GUIDE.pauseNarrationDist + 2, narrating: true });
    expect(away.events).toContain("pauseNarration");
    expect(brain.update(0.1, { ...base, dist: GUIDE.pauseNarrationDist + 1, narrating: true }).events).toHaveLength(0); // no repeats
    expect(brain.update(0.1, { ...base, dist: 4, narrating: true }).events).toContain("resumeNarration");
    for (let i = 0; i < 10; i++) brain.update(0.1, { ...base, dist: 4, narrating: false, explainDue: false });
    expect(brain.state).toBe("WAITING");
  });

  it("never walks without a valid route", () => {
    const brain = new GuideBrain();
    brain.reset("LEADING");
    const out = brain.update(0.1, { intent: "lead", dist: 2, gap: 2, playerSpeed: 3, atSpot: false, playerToSpot: 30, explainDue: false, narrating: false, chatOpen: false, hasRoute: false });
    expect(out.state).toBe("WAITING");
    expect(out.events).toContain("noRoute");
    expect(out.speed).toBeLessThan(0.5);
  });

  it("listens when the visitor opens the question box, then carries on", () => {
    const brain = new GuideBrain();
    brain.reset("LEADING");
    const base: BrainInput = { intent: "lead", dist: 3, gap: 3, playerSpeed: 0, atSpot: false, playerToSpot: 30, explainDue: false, narrating: false, chatOpen: true, hasRoute: true };
    expect(brain.update(0.1, base).state).toBe("LISTENING");
    for (let i = 0; i < 20; i++) brain.update(0.1, { ...base, chatOpen: false, playerSpeed: 2 });
    expect(brain.state).toBe("LEADING");
  });
});
