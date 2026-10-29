import type { FloorId, Localized, Vec3 } from "@/types";
import { floorFromY, LEVEL, PALACE, STAIRS } from "./layout";
import { INTERACTABLES, TOUR_STOPS } from "./tour";
import { spaceAt, type SpaceId } from "./spaces";

/**
 * Every place the visitor can act on with the interact key (F), in one
 * registry: doors between spaces, stair shortcuts, exhibits and tour stops.
 *
 * A door is a portal to another space (scene): the target space is loaded,
 * then a short fade, then the visitor stands at `to` (just past the door on
 * the other side) facing `yaw`. Every portal names its way back (`back`), so
 * each connection works in both directions and coming back puts you at the
 * same door, not at the room's default spawn. Stairs inside the stair spaces
 * are real geometry walked with WASD.
 */
export type InteractionKind = "door" | "stairs" | "exhibit" | "stop" | "hint";

export interface Portal {
  /** target space */
  space: SpaceId;
  to: Vec3;
  /** facing after arrival (radians; 0 = +z, π = −z toward the palace) */
  yaw: number;
  /** id of the interaction that leads back */
  back: string;
}

export interface InteractionPoint {
  id: string;
  kind: InteractionKind;
  /** the space the point is in (only points of the active space are offered) */
  space: SpaceId;
  floor: FloorId;
  /** centre of the trigger zone */
  at: Vec3;
  /** trigger radius (m), per kind — see RADIUS */
  radius: number;
  /** text after "[F]" (or the whole hint) */
  prompt: Localized;
  /** extra condition on the visitor's position (e.g. which side of a door) */
  when?: (p: Vec3) => boolean;
  portal?: Portal;
  /** exhibit / stop id for the panel and narration */
  ref?: string;
  /**
   * a connection walked on foot (the central staircase): it links the two
   * spaces for route planning, but has no F prompt and no teleport — the
   * visitor climbs the flights and the space follows where they stand
   */
  walk?: boolean;
}

/** Trigger radius by kind (m): doors need you at the door; stair landings are small. */
export const RADIUS = { door: 2.2, landing: 1.3, hint: 2.4 } as const;

const f1 = LEVEL.f1, f2 = LEVEL.f2, bas = LEVEL.basement, roof = LEVEL.roof;
const DOOR_Z = PALACE.front.z1; // the glazed front of the ground floor (−10)
const [sb, sr] = STAIRS;
const mb = sb.x0 + 2.3, mr = sr.x0 + 2.3; // shaft centre lines

export const MAIN_DOOR = { x0: -3, x1: 3, z: DOOR_Z, y0: f1, h: 3.6 } as const;

type Link = {
  id: string;
  kind?: InteractionKind;
  space: SpaceId;
  at: Vec3;
  radius?: number;
  when?: (p: Vec3) => boolean;
  prompt: Localized;
  to: SpaceId;
  arrive: Vec3;
  yaw: number;
  back: string;
  walk?: boolean;
};

const L: Link[] = [
  /* exterior ↔ hall (main entrance) */
  { id: "door-main-in", space: "exterior", at: [0, f1, DOOR_Z + 1.8], when: (p) => p[2] > DOOR_Z, prompt: { vi: "Vào bên trong Dinh Độc Lập", en: "Enter the Independence Palace" }, to: "hall", arrive: [0, f1, DOOR_Z - 5], yaw: Math.PI, back: "door-main-out" },
  { id: "door-main-out", space: "hall", at: [0, f1, DOOR_Z - 2], radius: 2.6, when: (p) => p[2] < DOOR_Z, prompt: { vi: "Quay lại ngoại thất", en: "Go back outside" }, to: "exterior", arrive: [0, f1, DOOR_Z + 4.4], yaw: 0, back: "door-main-in" },

  /* hall ↔ cabinet room (doorway in the x = 16 wall) */
  { id: "door-hall-cabinet", space: "hall", at: [14.2, f1, -22.5], when: (p) => p[0] < 16, prompt: { vi: "Vào Phòng họp Hội đồng Nội các", en: "Enter the Cabinet Meeting Room" }, to: "cabinet", arrive: [20.4, f1, -22.5], yaw: Math.PI / 2, back: "door-cabinet-hall" },
  { id: "door-cabinet-hall", space: "cabinet", at: [17.8, f1, -22.5], when: (p) => p[0] > 16, prompt: { vi: "Quay lại Đại sảnh", en: "Back to the main hall" }, to: "hall", arrive: [11.6, f1, -22.5], yaw: -Math.PI / 2, back: "door-hall-cabinet" },

  /* hall ↔ Phòng Đại yến (left of the hall) */
  { id: "door-hall-daiyen", space: "hall", at: [-14.2, f1, -22.5], when: (p) => p[0] > -16, prompt: { vi: "Vào Phòng Đại yến", en: "Enter the State Banquet Room" }, to: "dai_yen", arrive: [-19.6, f1, -22.5], yaw: -Math.PI / 2, back: "door-daiyen-hall" },
  { id: "door-daiyen-hall", space: "dai_yen", at: [-17.8, f1, -22.5], when: (p) => p[0] < -16, prompt: { vi: "Quay lại Đại sảnh", en: "Back to the main hall" }, to: "hall", arrive: [-11.6, f1, -22.5], yaw: Math.PI / 2, back: "door-hall-daiyen" },

  /* staircase bay ↔ Phòng Khánh tiết (two doors either side of the staircase) */
  { id: "door-hall-khanhtiet-w", space: "hall", at: [-9, f1, -42.5], radius: 1.6, when: (p) => p[2] > -44, prompt: { vi: "Vào Phòng Khánh tiết", en: "Enter the Khánh tiết Room" }, to: "khanh_tiet", arrive: [-8.4, f1, -46.6], yaw: Math.PI, back: "door-khanhtiet-hall-w" },
  { id: "door-khanhtiet-hall-w", space: "khanh_tiet", at: [-9, f1, -45.5], radius: 1.6, when: (p) => p[2] < -44, prompt: { vi: "Ra sảnh cầu thang", en: "Out to the staircase hall" }, to: "hall", arrive: [-8.6, f1, -40.4], yaw: 0, back: "door-hall-khanhtiet-w" },
  { id: "door-hall-khanhtiet-e", space: "hall", at: [9, f1, -42.5], radius: 1.6, when: (p) => p[2] > -44, prompt: { vi: "Vào Phòng Khánh tiết", en: "Enter the Khánh tiết Room" }, to: "khanh_tiet", arrive: [8.4, f1, -46.6], yaw: Math.PI, back: "door-khanhtiet-hall-e" },
  { id: "door-khanhtiet-hall-e", space: "khanh_tiet", at: [9, f1, -45.5], radius: 1.6, when: (p) => p[2] < -44, prompt: { vi: "Ra sảnh cầu thang", en: "Out to the staircase hall" }, to: "hall", arrive: [8.6, f1, -40.4], yaw: 0, back: "door-hall-khanhtiet-e" },

  /* central staircase: floor 1 ↔ floor-2 lobby (floors are separate spaces) */
  // walked: central flight → half landing → a side flight (no door, no teleport)
  { id: "stair-main-up", kind: "stairs", walk: true, space: "hall", at: [0, f1, -34.4], radius: 1.8, prompt: { vi: "Lên tầng 2 theo cầu thang trung tâm", en: "Go up to floor 2 by the central staircase" }, to: "f2_lobby", arrive: [3.8, f2, -34.6], yaw: 0, back: "stair-main-down" },
  { id: "stair-main-down", kind: "stairs", walk: true, space: "f2_lobby", at: [3.8, f2, -34.6], radius: 1.6, prompt: { vi: "Xuống tầng 1 theo cầu thang trung tâm", en: "Go down to floor 1 by the central staircase" }, to: "hall", arrive: [0, f1, -34.4], yaw: Math.PI, back: "stair-main-up" },

  /* floor-2 lobby ↔ Phòng Trình Quốc thư */
  { id: "door-lobby-credentials", space: "f2_lobby", at: [5, f2, -32.6], radius: 1.6, when: (p) => p[2] < -31, prompt: { vi: "Vào Phòng Trình Quốc thư", en: "Enter the Credentials Presentation Room" }, to: "credentials", arrive: [5, f2, -28.4], yaw: 0, back: "door-credentials-lobby" },
  { id: "door-credentials-lobby", space: "credentials", at: [5, f2, -29.6], radius: 1.6, when: (p) => p[2] > -31, prompt: { vi: "Ra sảnh tầng 2", en: "Out to the floor 2 lobby" }, to: "f2_lobby", arrive: [5, f2, -34.4], yaw: Math.PI, back: "door-lobby-credentials" },

  /* floor-2 lobby ↔ reception rooms and office (data/dinh/rooms2.ts; positions estimated) */
  { id: "door-lobby-pres", space: "f2_lobby", at: [-10, f2, -32.6], radius: 1.6, when: (p) => p[2] < -31, prompt: { vi: "Vào Phòng Tiếp khách Tổng thống", en: "Enter the President's Reception Room" }, to: "pres_reception", arrive: [-10, f2, -29.2], yaw: 0, back: "door-pres-lobby" },
  { id: "door-pres-lobby", space: "pres_reception", at: [-10, f2, -29.6], radius: 1.6, when: (p) => p[2] > -31, prompt: { vi: "Ra sảnh tầng 2", en: "Out to the floor 2 lobby" }, to: "f2_lobby", arrive: [-10, f2, -34.4], yaw: Math.PI, back: "door-lobby-pres" },
  { id: "door-pres-red", space: "pres_reception", at: [-27.4, f2, -20.5], radius: 1.8, when: (p) => p[0] > -29, prompt: { vi: "Sang phòng tiếp khách ghế gỗ bọc đỏ", en: "Into the reception room with red carved chairs" }, to: "red_reception", arrive: [-30.4, f2, -20.5], yaw: -Math.PI / 2, back: "door-red-pres" },
  { id: "door-red-pres", space: "red_reception", at: [-30.6, f2, -20.5], radius: 1.8, when: (p) => p[0] < -29, prompt: { vi: "Quay lại Phòng Tiếp khách Tổng thống", en: "Back to the President's Reception Room" }, to: "pres_reception", arrive: [-27.6, f2, -20.5], yaw: Math.PI / 2, back: "door-pres-red" },
  { id: "door-lobby-vp", space: "f2_lobby", at: [10, f2, -32.6], radius: 1.6, when: (p) => p[2] < -31, prompt: { vi: "Vào phòng tiếp khách (nhóm ảnh 13)", en: "Enter the reception room (photo group 13)" }, to: "vp_reception", arrive: [10, f2, -29.2], yaw: 0, back: "door-vp-lobby" },
  { id: "door-vp-lobby", space: "vp_reception", at: [10, f2, -29.6], radius: 1.6, when: (p) => p[2] > -31, prompt: { vi: "Ra sảnh tầng 2", en: "Out to the floor 2 lobby" }, to: "f2_lobby", arrive: [10, f2, -34.4], yaw: Math.PI, back: "door-lobby-vp" },
  { id: "door-vp-cream", space: "vp_reception", at: [27.4, f2, -28], radius: 1.6, when: (p) => p[0] < 29, prompt: { vi: "Sang phòng tiếp khách ghế bọc kem", en: "Into the reception room with cream armchairs" }, to: "cream_reception", arrive: [30.6, f2, -28], yaw: Math.PI / 2, back: "door-cream-vp" },
  { id: "door-cream-vp", space: "cream_reception", at: [30.6, f2, -28], radius: 1.6, when: (p) => p[0] > 29, prompt: { vi: "Quay lại phòng tiếp khách (nhóm ảnh 13)", en: "Back to the reception room (photo group 13)" }, to: "vp_reception", arrive: [27.4, f2, -28], yaw: -Math.PI / 2, back: "door-vp-cream" },
  { id: "door-lobby-office", space: "f2_lobby", at: [0, f2, -45.1], radius: 1.2, when: (p) => p[2] > -46, prompt: { vi: "Vào phòng làm việc", en: "Enter the office" }, to: "office2", arrive: [0, f2, -47.6], yaw: Math.PI, back: "door-office-lobby" },
  { id: "door-office-lobby", space: "office2", at: [0, f2, -47.4], radius: 1.4, when: (p) => p[2] < -46, prompt: { vi: "Ra sảnh tầng 2", en: "Out to the floor 2 lobby" }, to: "f2_lobby", arrive: [0, f2, -45.0], yaw: 0, back: "door-lobby-office" },

  /* stair corridor ↔ inner courtyard (doorway between the two stair shafts) */
  { id: "door-corridor-courtyard", space: "corridor", at: [0, f1, -62.8], radius: 1.6, when: (p) => p[2] < -61, prompt: { vi: "Ra sân trong (giếng trời)", en: "Go to the inner courtyard" }, to: "courtyard", arrive: [0, f1, -66], yaw: Math.PI, back: "door-courtyard-corridor" },
  { id: "door-courtyard-corridor", space: "courtyard", at: [0, f1, -65.2], radius: 1.6, when: (p) => p[2] < -64, prompt: { vi: "Quay lại hành lang cầu thang", en: "Back to the stair corridor" }, to: "corridor", arrive: [0, f1, -61.6], yaw: 0, back: "door-corridor-courtyard" },

  /* Khánh tiết ↔ stair corridor (door in the end wall, beside the stage) */
  { id: "door-khanhtiet-corridor", space: "khanh_tiet", at: [8.5, f1, -58.2], radius: 1.8, when: (p) => p[2] > -60, prompt: { vi: "Ra hành lang cầu thang", en: "Go to the stair corridor" }, to: "corridor", arrive: [5.5, f1, -62.2], yaw: -Math.PI / 2, back: "door-corridor-khanhtiet" },
  { id: "door-corridor-khanhtiet", space: "corridor", at: [8.5, f1, -61.2], radius: 1.4, when: (p) => p[2] < -60, prompt: { vi: "Vào Phòng Khánh tiết", en: "Enter the Khánh tiết Room" }, to: "khanh_tiet", arrive: [8.5, f1, -56.2], yaw: 0, back: "door-khanhtiet-corridor" },

  /* corridor ↔ basement stair shaft (top landing) */
  { id: "door-corridor-stairb", space: "corridor", at: [mb, f1, -62.8], radius: 1.6, when: (p) => p[2] < -61, prompt: { vi: "Xuống tầng hầm", en: "Go down to the basement" }, to: "stair_basement", arrive: [mb, f1, -65.6], yaw: Math.PI, back: "door-stairb-corridor" },
  { id: "door-stairb-corridor", kind: "stairs", space: "stair_basement", at: [mb, f1, -64.6], radius: RADIUS.landing, when: (p) => p[1] > 0, prompt: { vi: "Quay lại hành lang", en: "Back to the corridor" }, to: "corridor", arrive: [mb, f1, -61.6], yaw: 0, back: "door-corridor-stairb" },

  /* basement stair shaft (bottom landing) ↔ basement corridor */
  { id: "door-stairb-bcorridor", kind: "stairs", space: "stair_basement", at: [mb, bas, -64.6], radius: RADIUS.landing, when: (p) => p[1] < 0, prompt: { vi: "Vào hành lang tầng hầm", en: "Enter the basement corridor" }, to: "b_corridor", arrive: [mb, bas, -61.6], yaw: 0, back: "door-bcorridor-stairb" },
  { id: "door-bcorridor-stairb", space: "b_corridor", at: [mb, bas, -63], radius: 1.6, prompt: { vi: "Lên cầu thang về tầng nền", en: "Take the stairs up to the ground floor" }, to: "stair_basement", arrive: [mb, bas, -65.6], yaw: Math.PI, back: "door-stairb-bcorridor" },

  /* basement corridor ↔ its two rooms */
  { id: "door-bcorridor-comms", space: "b_corridor", at: [-10.5, bas, -61], radius: 1.5, when: (p) => p[2] < -60, prompt: { vi: "Vào khu thông tin liên lạc", en: "Enter the communications area" }, to: "b_comms", arrive: [-10.5, bas, -57.4], yaw: 0, back: "door-comms-bcorridor" },
  { id: "door-comms-bcorridor", space: "b_comms", at: [-10.5, bas, -59], radius: 1.5, when: (p) => p[2] > -60, prompt: { vi: "Quay lại hành lang tầng hầm", en: "Back to the basement corridor" }, to: "b_corridor", arrive: [-7.2, bas, -62.2], yaw: Math.PI / 2, back: "door-bcorridor-comms" },
  { id: "door-bcorridor-maps", space: "b_corridor", at: [10.5, bas, -61], radius: 1.5, when: (p) => p[2] < -60, prompt: { vi: "Vào phòng làm việc tầng hầm", en: "Enter the basement working room" }, to: "b_maps", arrive: [10.5, bas, -57.4], yaw: 0, back: "door-maps-bcorridor" },
  { id: "door-maps-bcorridor", space: "b_maps", at: [10.5, bas, -59], radius: 1.5, when: (p) => p[2] > -60, prompt: { vi: "Quay lại hành lang tầng hầm", en: "Back to the basement corridor" }, to: "b_corridor", arrive: [7.2, bas, -62.2], yaw: -Math.PI / 2, back: "door-bcorridor-maps" },

  /* corridor ↔ roof stair shaft (foot) */
  { id: "door-corridor-stairr", space: "corridor", at: [mr, f1, -62.8], radius: 1.6, when: (p) => p[2] < -61, prompt: { vi: "Đi lên cầu thang sân thượng", en: "Take the stairs to the rooftop" }, to: "stair_roof", arrive: [mr, f1, -65.6], yaw: Math.PI, back: "door-stairr-corridor" },
  { id: "door-stairr-corridor", kind: "stairs", space: "stair_roof", at: [mr, f1, -64.6], radius: RADIUS.landing, when: (p) => p[1] < f1 + 1, prompt: { vi: "Quay lại hành lang", en: "Back to the corridor" }, to: "corridor", arrive: [mr, f1, -61.6], yaw: 0, back: "door-corridor-stairr" },

  /* roof stair shaft (top landing) ↔ rooftop */
  { id: "door-stairr-roof", kind: "stairs", space: "stair_roof", at: [mr, roof, -64.6], radius: RADIUS.landing, when: (p) => p[1] > roof - 1, prompt: { vi: "Ra sân thượng", en: "Go out onto the rooftop" }, to: "roof", arrive: [mr, roof, -59.5], yaw: 0, back: "door-roof-stairr" },
  { id: "door-roof-stairr", kind: "stairs", space: "roof", at: [mr, roof, -62.4], radius: 2, when: (p) => p[2] > -64, prompt: { vi: "Xuống cầu thang", en: "Take the stairs down" }, to: "stair_roof", arrive: [mr, roof, -65.6], yaw: Math.PI, back: "door-stairr-roof" },

  /* shortcuts inside the roof shaft: the three storeys it passes are not modelled (closed doors) */
  { id: "stair-roof-up", kind: "stairs", space: "stair_roof", at: [mr, f1, -66.2], radius: 1.0, when: (p) => p[1] < f1 + 1, prompt: { vi: "Lên thẳng đầu cầu thang (bỏ qua 3 tầng lầu chưa mô hình hóa)", en: "Straight up to the top landing (skips 3 unmodelled storeys)" }, to: "stair_roof", arrive: [mr, roof, -65.6], yaw: Math.PI, back: "stair-roof-down" },
  { id: "stair-roof-down", kind: "stairs", space: "stair_roof", at: [mr, roof, -66.2], radius: 1.0, when: (p) => p[1] > roof - 1, prompt: { vi: "Xuống thẳng chân cầu thang (lối tắt)", en: "Straight down to the foot of the stairs (shortcut)" }, to: "stair_roof", arrive: [mr, f1, -65.6], yaw: Math.PI, back: "stair-roof-up" },
];

export const INTERACTIONS: InteractionPoint[] = [
  ...L.map((l): InteractionPoint => ({
    id: l.id,
    kind: l.kind ?? "door",
    space: l.space,
    floor: floorFromY(l.at[1]),
    at: l.at,
    radius: l.radius ?? RADIUS.door,
    when: l.when,
    prompt: l.prompt,
    portal: { space: l.to, to: l.arrive, yaw: l.yaw, back: l.back },
    walk: l.walk,
  })),

  /* the central staircase is walked: hints at its foot and head */
  { id: "hint-main-stair-up", kind: "hint", space: "hall", floor: "f1", at: [0, f1, -33.6], radius: RADIUS.hint, prompt: { vi: "Cầu thang trung tâm — cứ đi lên, rẽ trái hoặc phải ở chiếu nghỉ để tới tầng 2", en: "Central staircase — walk up and turn left or right at the landing to reach floor 2" } },
  { id: "hint-main-stair-down", kind: "hint", space: "f2_lobby", floor: "f2", at: [0, f2, -34.4], radius: RADIUS.hint, prompt: { vi: "Hai vế cầu thang trung tâm dẫn xuống đại sảnh", en: "Both side flights of the central staircase lead down to the hall" } },

  /* passive hints at the walkable flights */
  { id: "hint-basement-down", kind: "hint", space: "stair_basement", floor: "f1", at: [mb + 1.2, f1, -66.6], radius: RADIUS.hint, when: (p) => p[1] > 0, prompt: { vi: "Cầu thang xuống tầng hầm — cứ đi tiếp để xuống", en: "Stairs to the basement — keep walking to go down" } },
  { id: "hint-roof-up", kind: "hint", space: "stair_roof", floor: "f1", at: [mr - 1.2, f1, -66.6], radius: RADIUS.hint, when: (p) => p[1] < f1 + 1, prompt: { vi: "Cầu thang lên sân thượng — cứ đi tiếp để lên", en: "Stairs to the rooftop — keep walking to go up" } },

  /* exhibits and tour stops (from the tour data), in the space where they stand */
  ...INTERACTABLES.map((i): InteractionPoint => ({
    id: `exhibit:${i.id}`,
    kind: "exhibit",
    space: spaceAt(i.position),
    floor: i.floor,
    at: i.position,
    radius: i.radius,
    prompt: { vi: `Xem hiện vật: ${i.title.vi}`, en: `View exhibit: ${i.title.en}` },
    ref: i.id,
  })),
  ...TOUR_STOPS.map((s): InteractionPoint => ({
    id: `stop:${s.id}`,
    kind: "stop",
    space: spaceAt(s.position),
    floor: s.floor,
    at: s.position,
    radius: s.radius,
    prompt: { vi: `Nghe thuyết minh: ${s.title.vi}`, en: `Hear about: ${s.title.en}` },
    ref: s.id,
  })),
];

export const INTERACTION_BY_ID = new Map(INTERACTIONS.map((i) => [i.id, i]));

/** Door portals between spaces (shortcuts inside one space excluded): the connection graph. */
export const SPACE_LINKS = INTERACTIONS.filter((i) => i.portal && i.portal.space !== i.space);

/** Spaces in order from `from` to `to` through doors (BFS), or null if unconnected. */
export function spacePath(from: SpaceId, to: SpaceId): InteractionPoint[] | null {
  if (from === to) return [];
  const prev = new Map<SpaceId, InteractionPoint>();
  const queue: SpaceId[] = [from];
  const seen = new Set<SpaceId>([from]);
  while (queue.length) {
    const s = queue.shift()!;
    for (const link of SPACE_LINKS) {
      if (link.space !== s || seen.has(link.portal!.space)) continue;
      seen.add(link.portal!.space);
      prev.set(link.portal!.space, link);
      if (link.portal!.space === to) {
        const path: InteractionPoint[] = [];
        for (let c: SpaceId = to; c !== from; c = prev.get(c)!.space) path.unshift(prev.get(c)!);
        return path;
      }
      queue.push(link.portal!.space);
    }
  }
  return null;
}
