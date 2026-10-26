"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Next.js (Cache Components) keeps visited pages alive inside React <Activity>:
 * when a page is hidden its effects are cleaned up — and React Three Fiber's
 * cleanup calls forceContextLoss() on its <canvas>. When the page is shown
 * again, effects re-run on that same, now context-less canvas and the scene
 * stays blank.
 *
 * This key changes every time the page becomes visible; using it as the
 * Canvas key gives every visit a brand-new <canvas> and WebGL context.
 */
export function useVisitKey() {
  const [visit, setVisit] = useState(0);
  useLayoutEffect(() => {
    // Runs on mount and again each time Activity reveals the page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisit((v) => v + 1);
  }, []);
  return visit;
}
