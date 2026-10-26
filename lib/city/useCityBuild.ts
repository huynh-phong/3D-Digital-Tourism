"use client";

import { useEffect, useState } from "react";
import type { CityBuild, Exclusion } from "./buildCity";
import { unpack, type CityPayload } from "./serialize";
import type { CityData, P2 } from "./types";

/**
 * Builds the city in a Web Worker (main-thread fallback). The result is kept
 * in a module-level cache, so leaving for the palace and coming back to the map
 * is instant and never builds twice. Cached geometry is shared, not disposed on
 * unmount; it is only freed when replaced by a build at another quality level.
 */
const cache = new Map<string, CityBuild>();
const pending = new Map<string, Promise<CityBuild>>();

function disposeBuild(c: CityBuild) {
  Object.values(c.buckets).forEach((g) => g.dispose());
  Object.values(c.ground).forEach((g) => g.dispose());
}

function build(data: CityData, exclusions: Exclusion[], zones: P2[][], quality: "low" | "medium" | "high"): Promise<CityBuild> {
  return new Promise((resolve) => {
    const fallback = () =>
      void import("./buildCity").then(({ buildCity }) => resolve(buildCity(data, exclusions, zones, quality)));
    try {
      const worker = new Worker(new URL("./city.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<CityPayload>) => {
        resolve(unpack(e.data));
        worker.terminate();
      };
      worker.onerror = (e) => {
        console.warn("[city] worker failed, building on the main thread", e.message);
        worker.terminate();
        fallback();
      };
      worker.postMessage({ data, exclusions, zones, quality });
    } catch {
      fallback();
    }
  });
}

export function useCityBuild(data: CityData, exclusions: Exclusion[], zones: P2[][], quality: "low" | "medium" | "high") {
  const [city, setCity] = useState<CityBuild | null>(() => cache.get(quality) ?? null);

  useEffect(() => {
    let alive = true;
    const hit = cache.get(quality);
    if (hit) {
      // state already initialised from the cache, or quality just changed back
      queueMicrotask(() => alive && setCity(hit));
      return () => void (alive = false);
    }
    let p = pending.get(quality);
    if (!p) {
      p = build(data, exclusions, zones, quality).then((c) => {
        // only one build per quality is ever kept
        for (const [q, old] of cache) if (q !== quality) { disposeBuild(old); cache.delete(q); }
        cache.set(quality, c);
        pending.delete(quality);
        return c;
      });
      pending.set(quality, p);
    }
    p.then((c) => alive && setCity(c));
    return () => void (alive = false);
  }, [data, exclusions, zones, quality]);

  return city;
}

/** City data is fetched once per session. */
let cityData: Promise<CityData> | null = null;
export function loadCityData(): Promise<CityData> {
  if (!cityData) {
    cityData = fetch("/data/city.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        cityData = null; // allow a retry
        throw e;
      });
  }
  return cityData;
}

/** Set when the map hands over to the palace tour; read once when the map comes back. */
export const mapView = { returningFromTour: false };
