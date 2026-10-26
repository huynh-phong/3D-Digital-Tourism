import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { LEVEL, ROOMS, type RoomId } from "@/data/dinh/layout";
import type { FloorId, Localized, Vec3 } from "@/types";

/**
 * Everything the visitor can ask directions to: tour stops, exhibits /
 * viewpoints and rooms. `point` is where to stand (feet), `guideSpot` where
 * Minh Anh waits when she leads there.
 */
export type DestKind = "stop" | "interactable" | "room";

export interface Destination {
  key: string; // `${kind}:${id}`
  kind: DestKind;
  id: string;
  title: Localized;
  floor: FloorId;
  point: Vec3;
  guideSpot: Vec3;
  /** counts as arrived within this distance */
  radius: number;
}

/** Standing points inside each walkable room (room centres can be furniture). */
const ROOM_POINTS: Partial<Record<RoomId, Vec3>> = {
  hall: [0, LEVEL.f1, -20],
  cabinet: [22, LEVEL.f1, -16.5],
  credentials: [0, LEVEL.f1, -41],
  corridor: [0, LEVEL.f1, -62],
  b_corridor: [0, LEVEL.basement, -62],
  b_comms: [-9, LEVEL.basement, -51],
  b_maps: [8, LEVEL.basement, -45],
  roof: [0, LEVEL.roof, -40],
};

const beside = (p: Vec3, dx: number, dz: number): Vec3 => [p[0] + dx, p[1], p[2] + dz];

export const DESTINATIONS: Destination[] = [
  ...TOUR_STOPS.map((s) => ({
    key: `stop:${s.id}`, kind: "stop" as const, id: s.id, title: s.title, floor: s.floor,
    point: s.position, guideSpot: s.guideSpot, radius: Math.min(4, s.radius),
  })),
  ...INTERACTABLES.map((i) => ({
    key: `interactable:${i.id}`, kind: "interactable" as const, id: i.id, title: i.title, floor: i.floor,
    point: i.position, guideSpot: beside(i.position, 1.8, 1.2), radius: Math.max(3, Math.min(5, i.radius * 0.7)),
  })),
  ...ROOMS.filter((r) => ROOM_POINTS[r.id]).map((r) => ({
    key: `room:${r.id}`, kind: "room" as const, id: r.id, title: r.name, floor: r.floor,
    point: ROOM_POINTS[r.id]!, guideSpot: beside(ROOM_POINTS[r.id]!, 1.6, -1.2), radius: 4,
  })),
];

export const DEST_BY_KEY = new Map(DESTINATIONS.map((d) => [d.key, d]));
export const destKey = (kind: DestKind, id: string) => `${kind}:${id}`;
