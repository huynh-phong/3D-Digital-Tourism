/**
 * Tunables for movement, animation and the guide, in one place. All values are
 * starting points meant to be adjusted by play-testing.
 */

export const MOVE = {
  /** walking speed, m/s */
  walk: 3.0,
  /** running speed (Shift), m/s */
  run: 5.5,
  /** acceleration toward the target velocity, m/s² */
  accel: 16,
  /** deceleration when keys are released, m/s² (stops within ~0.2 s from a walk) */
  decel: 22,
  /** how fast the body turns to face the movement direction, rad/s */
  turnRate: 10,
  gravity: 22,
  jumpVelocity: 5.2,
};

export const GAIT = {
  /** leg length (hip height) of the 1.72 m reference body, m */
  legLength: 0.92,
  /** metres per full gait cycle (two steps) as a function of speed: base + perSpeed·v */
  cycleBase: 0.75,
  cyclePerSpeed: 0.35,
  /** speed band (m/s) over which the walk pose blends into the run pose */
  runBlendFrom: 3.4,
  runBlendTo: 4.8,
};

export const GUIDE = {
  walk: 2.4,
  /** top speed when catching up or hurrying ahead to her spot */
  hurry: 4.6,
  /** desired lead distance along the route, m */
  leadMin: 2,
  leadMax: 4,
  /** beyond this gap (m) for `slowAfter` seconds she slows and stops at a safe spot */
  waitDist: 6,
  waitAfter: 1.2,
  /** still further (m) for `remindAfter` seconds while waiting → a spoken reminder */
  remindDist: 8,
  remindAfter: 3,
  /** minimum time between two reminders, s; at most `maxReminders` in a row */
  remindCooldown: 22,
  maxReminders: 3,
  /** the visitor counts as caught up within this distance (m) for `resumeAfter` s */
  resumeDist: 3.6,
  resumeAfter: 0.5,
  /** she starts explaining only when the visitor is within this distance of her spot */
  listenDist: 7,
  /** narration pauses when the visitor walks this far away, resumes when back */
  pauseNarrationDist: 13,
  /** free-mode follow offset */
  followDist: 2.2,
};

export const NAV = {
  /** recompute the route when the visitor moved this far (m) since the last plan */
  replanMove: 0.8,
  /** but never more often than this (s) */
  replanInterval: 0.25,
  /** distance (m) counted as "arrived" at a destination */
  arriveDist: 2.6,
};
