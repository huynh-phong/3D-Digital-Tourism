"use client";

import { create } from "zustand";

/**
 * Pointer lock (mouse-look) state.
 *
 * - Locking only ever happens from a direct user action (click on the scene,
 *   the "control camera" button or the lock key); we never re-grab the mouse
 *   by ourselves, e.g. after Esc.
 * - Esc (browser) or the lock key releases it; the game keeps running and the
 *   cursor is free for the UI.
 * - Refusals (`pointerlockerror`, rejected promise, touch devices) are
 *   reported so the HUD can explain that drag-to-look still works.
 */
interface PointerState {
  locked: boolean;
  /** set when the browser refused the lock (cleared on the next success) */
  error: boolean;
  /** time of the last lock/unlock — mouse deltas right after a change are discarded */
  changedAt: number;
}

export const usePointerLock = create<PointerState>()(() => ({ locked: false, error: false, changedAt: 0 }));

let target: HTMLElement | null = null;

/** Wire document listeners once per page; returns a cleanup. */
export function installPointerLockListeners() {
  const onChange = () => {
    const locked = !!document.pointerLockElement && document.pointerLockElement === target;
    usePointerLock.setState({ locked, changedAt: performance.now(), ...(locked ? { error: false } : {}) });
  };
  const onError = () => usePointerLock.setState({ locked: false, error: true, changedAt: performance.now() });
  document.addEventListener("pointerlockchange", onChange);
  document.addEventListener("pointerlockerror", onError);
  return () => {
    document.removeEventListener("pointerlockchange", onChange);
    document.removeEventListener("pointerlockerror", onError);
  };
}

export function pointerLockSupported() {
  return typeof document !== "undefined" && "requestPointerLock" in Element.prototype && !matchMedia("(pointer: coarse)").matches;
}

/** Request the lock. Must be called from a user gesture (click / key press). */
export function lockPointer(el: HTMLElement | null) {
  if (!el || !pointerLockSupported() || document.pointerLockElement === el) return;
  target = el;
  const fail = () => usePointerLock.setState({ locked: false, error: true, changedAt: performance.now() });
  try {
    // Raw (unaccelerated) mouse movement where supported, plain lock otherwise.
    const req = el.requestPointerLock as (o?: { unadjustedMovement?: boolean }) => Promise<void> | undefined;
    const r = req.call(el, { unadjustedMovement: true });
    r?.catch?.(() => {
      try {
        const r2 = req.call(el);
        r2?.catch?.(fail);
      } catch {
        fail();
      }
    });
  } catch {
    fail();
  }
}

export function releasePointer() {
  if (typeof document !== "undefined" && document.pointerLockElement) document.exitPointerLock();
}

export function togglePointer(el: HTMLElement | null) {
  if (usePointerLock.getState().locked) releasePointer();
  else lockPointer(el);
}
