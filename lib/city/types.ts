export type P2 = [number, number];

export interface CityData {
  attribution: string;
  roads: { k: string; w: number; n?: string; b?: 1; p: P2[] }[];
  buildings: { h: number; s?: 1; n?: string; p: P2[] }[];
  water: { p: P2[]; n?: string }[];
  green: { p: P2[]; n?: string }[];
  bridges: { p: P2[] }[];
}
