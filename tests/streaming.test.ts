import { beforeEach, describe, expect, it } from "vitest";
import { activateSpace, CACHE_MAX, failLoad, loadSpace, mountedSpaces, resetWorld, spaceReady, useWorld } from "@/lib/world/streaming";

const mounted = () => mountedSpaces(useWorld.getState());

describe("space streaming", () => {
  beforeEach(() => resetWorld("exterior"));

  it("starts with only the grounds mounted", () => {
    expect(mounted()).toEqual(["exterior"]);
    expect(useWorld.getState().status).toBe("ROOM_ACTIVE");
  });

  it("mounts the target while loading and resolves when it reports ready", async () => {
    const p = loadSpace("hall");
    expect(useWorld.getState().status).toBe("LOADING_TARGET_ROOM");
    expect(mounted().sort()).toEqual(["exterior", "hall"]);
    spaceReady("hall");
    await p;
    activateSpace("hall");
    expect(useWorld.getState().active).toBe("hall");
    // the grounds (cache policy "lru") are kept for a quick return
    expect(useWorld.getState().cached).toEqual(["exterior"]);
  });

  it("keeps at most CACHE_MAX spaces cached and frees the rest", async () => {
    for (const id of ["hall", "credentials", "corridor", "stair_basement", "b_corridor"] as const) {
      const p = loadSpace(id);
      spaceReady(id);
      await p;
      activateSpace(id);
      expect(mounted().length).toBeLessThanOrEqual(1 + CACHE_MAX);
    }
    // "evict" spaces (corridor, stairs) are freed as soon as they are left
    expect(useWorld.getState().cached).not.toContain("corridor");
    expect(useWorld.getState().stats.evictions).toBeGreaterThan(0);
  });

  it("returns at once to a cached space without loading it again", async () => {
    const p = loadSpace("hall");
    spaceReady("hall");
    await p;
    activateSpace("hall");
    const loads = useWorld.getState().stats.loads;
    await loadSpace("exterior"); // cached: resolves immediately
    activateSpace("exterior");
    expect(useWorld.getState().stats.loads).toBe(loads);
    expect(useWorld.getState().stats.cacheHits).toBe(1);
    expect(useWorld.getState().cached).toEqual(["hall"]);
  });

  it("reports a failed load, unmounts the target and stays in the source", async () => {
    const p = loadSpace("b_maps");
    failLoad("b_maps", new Error("boom"));
    await expect(p).rejects.toThrow("boom");
    expect(useWorld.getState().status).toBe("LOADING_FAILED");
    expect(useWorld.getState().active).toBe("exterior");
    expect(mounted()).toEqual(["exterior"]);
  });

  it("refuses a second load while one is running", async () => {
    const p = loadSpace("hall");
    await expect(loadSpace("cabinet")).rejects.toThrow();
    spaceReady("hall");
    await p;
  });
});
