export type P2 = [number, number];

export interface RoadData {
  k: string; // OSM highway class
  w: number; // estimated carriageway width (m)
  n?: string;
  b?: 1; // bridge
  o?: 1 | -1; // oneway: along (1) / against (-1) the geometry
  l?: number; // OSM layer
  a?: 1; // closed pedestrian area (plaza), not a path
  p: P2[];
}

export interface CityData {
  attribution: string;
  roads: RoadData[];
  buildings: { h: number; s?: 1; n?: string; p: P2[] }[];
  water: { p: P2[]; n?: string }[];
  green: { p: P2[]; n?: string }[];
  /** OSM land use of the spaces between footprints (landuse / leisure / tourism / amenity value) */
  landuse?: { k: string; n?: string; p: P2[] }[];
  bridges: { p: P2[] }[];
  /** river / canal centrelines (may be absent in older data files) */
  waterways?: { k: string; n?: string; p: P2[] }[];
}
