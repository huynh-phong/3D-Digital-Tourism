"use client";

/** Pointer-lock helpers: distinguish our own releases from the user pressing Esc. */
let expectUnlock = false;

export function releasePointer() {
  if (typeof document !== "undefined" && document.pointerLockElement) {
    expectUnlock = true;
    document.exitPointerLock();
  }
}

export function consumeExpectedUnlock(): boolean {
  const v = expectUnlock;
  expectUnlock = false;
  return v;
}

export function lockPointer(el: HTMLElement | null) {
  if (!el || typeof document === "undefined" || document.pointerLockElement === el) return;
  if (matchMedia("(pointer: coarse)").matches) return;
  try {
    const r = el.requestPointerLock() as unknown as Promise<void> | undefined;
    r?.catch?.(() => {});
  } catch {
    /* not available — drag-to-look still works */
  }
}
