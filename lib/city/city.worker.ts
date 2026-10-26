/// <reference lib="webworker" />
import { buildCity, type Exclusion } from "./buildCity";
import { pack } from "./serialize";
import type { CityData, P2 } from "./types";

/** Builds the city off the main thread so the UI stays responsive. */
self.onmessage = (e: MessageEvent<{ data: CityData; exclusions: Exclusion[]; zones: P2[][]; quality: "low" | "medium" | "high" }>) => {
  const { data, exclusions, zones, quality } = e.data;
  const { payload, transfer } = pack(buildCity(data, exclusions, zones, quality));
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(payload, transfer);
};
