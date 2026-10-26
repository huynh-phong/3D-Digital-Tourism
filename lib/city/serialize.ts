import * as THREE from "three";
import type { CityBuild } from "./buildCity";

/** Geometry-free payload for postMessage (typed arrays are transferred, not copied). */
type Attrs = Record<string, Float32Array>;
export interface CityPayload extends Omit<CityBuild, "buckets" | "ground" | "mask"> {
  buckets: Record<string, Attrs>;
  ground: Record<keyof CityBuild["ground"], Attrs>;
}

function attrs(g: THREE.BufferGeometry, transfer: ArrayBuffer[]): Attrs {
  const out: Attrs = {};
  for (const [name, a] of Object.entries(g.attributes)) {
    const arr = a.array as Float32Array;
    out[name] = arr;
    transfer.push(arr.buffer as ArrayBuffer);
  }
  return out;
}

const SIZES: Record<string, number> = { position: 3, normal: 3, color: 3, uv: 2 };

function geometry(a: Attrs) {
  const g = new THREE.BufferGeometry();
  for (const [name, arr] of Object.entries(a)) g.setAttribute(name, new THREE.BufferAttribute(arr, SIZES[name] ?? 3));
  g.computeBoundingSphere();
  return g;
}

export function pack(c: CityBuild): { payload: CityPayload; transfer: ArrayBuffer[] } {
  const transfer: ArrayBuffer[] = [];
  const buckets = Object.fromEntries(Object.entries(c.buckets).map(([k, g]) => [k, attrs(g, transfer)]));
  const ground = Object.fromEntries(Object.entries(c.ground).map(([k, g]) => [k, attrs(g, transfer)])) as CityPayload["ground"];
  const { mask: _mask, ...rest } = c;
  void _mask;
  return { payload: { ...rest, buckets, ground }, transfer };
}

export function unpack(p: CityPayload): CityBuild {
  return {
    ...p,
    buckets: Object.fromEntries(Object.entries(p.buckets).map(([k, a]) => [k, geometry(a)])),
    ground: Object.fromEntries(Object.entries(p.ground).map(([k, a]) => [k, geometry(a)])) as CityBuild["ground"],
  };
}
