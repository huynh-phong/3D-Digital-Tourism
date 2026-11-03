"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
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

/**
 * Loading progress of the map (0..1) for the loading bar: downloading the city
 * data is the first 40 %, building it in the worker the rest.
 */
const DOWNLOAD = 0.4;
const progress = { value: 0, listeners: new Set<() => void>() };
function setProgress(v: number) {
  // never goes backwards (a retry restarts from the reset below)
  if (v <= progress.value && v !== 0) return;
  progress.value = Math.min(1, v);
  progress.listeners.forEach((l) => l());
}
export function useLoadProgress() {
  return useSyncExternalStore(
    (l) => (progress.listeners.add(l), () => void progress.listeners.delete(l)),
    () => progress.value,
    () => 0,
  );
}
const pending = new Map<string, Promise<CityBuild>>();

function disposeBuild(c: CityBuild) {
  Object.values(c.buckets).forEach((g) => g.dispose());
  Object.values(c.ground).forEach((g) => g.dispose());
}

function build(data: CityData, exclusions: Exclusion[], zones: P2[][], quality: "low" | "medium" | "high"): Promise<CityBuild> {
  return new Promise((resolve) => {
    const fallback = () =>
      void import("./buildCity").then(({ buildCity }) => {
        const c = buildCity(data, exclusions, zones, quality);
        setProgress(1);
        resolve(c);
      });
    try {
      const worker = new Worker(new URL("./city.worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (e: MessageEvent<CityPayload | { progress: number }>) => {
        if ("progress" in e.data) return setProgress(DOWNLOAD + (1 - DOWNLOAD) * 0.95 * e.data.progress);
        setProgress(1);
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
      setProgress(1);
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
    setProgress(0);
    cityData = fetch("/data/city.json")
      .then((r) => (r.ok ? readWithProgress(r) : Promise.reject(new Error(String(r.status)))))
      .catch((e) => {
        cityData = null; // allow a retry
        throw e;
      });
  }
  return cityData;
}

/** Reads a JSON response, reporting the downloaded share as the first part of the progress. */
async function readWithProgress(r: Response): Promise<CityData> {
  const reader = r.body?.getReader();
  if (!reader) return r.json();
  // content-length is the compressed size when the server gzips: then use the known raw size
  const len = Number(r.headers.get("content-length")) || 0;
  const total = r.headers.get("content-encoding") || !len ? 1_060_000 : len;
  const chunks: Uint8Array[] = [];
  let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    got += value.length;
    setProgress(DOWNLOAD * Math.min(0.99, got / total));
  }
  const all = new Uint8Array(got);
  let o = 0;
  for (const c of chunks) { all.set(c, o); o += c.length; }
  setProgress(DOWNLOAD);
  return JSON.parse(new TextDecoder().decode(all)) as CityData;
}

/** Set when the map hands over to the palace tour; read once when the map comes back. */
export const mapView = { returningFromTour: false };
