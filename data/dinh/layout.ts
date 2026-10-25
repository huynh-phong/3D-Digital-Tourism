import type { ConfidenceStatus, FloorId, Localized } from "@/types";

/**
 * Spatial model of the Dinh Độc Lập scene, in metres.
 *
 * Frame: +y up, ground = 0. The main gate on Nam Kỳ Khởi Nghĩa is at +z.
 * Looking from the gate toward the palace, +x is toward Nguyễn Thị Minh Khai
 * (the palace's own left) and -x toward Nguyễn Du (the palace's right).
 *
 * Every number is tagged as verified (from an official source) or estimated
 * (a design estimate so the simulation is walkable). Replace estimates when
 * measured drawings become available — the scene is generated from this file.
 */
export interface Measure {
  value: number;
  status: ConfidenceStatus;
  note: string;
}
const v = (value: number, note: string): Measure => ({ value, status: "verified", note });
const e = (value: number, note: string): Measure => ({ value, status: "estimated", note });

export const MEASURES = {
  groundsWidth: v(400, "120.000 m² (300 m × 400 m) — dinhdoclap.gov.vn/kien-truc. Which side is 400 m is estimated from the official visitor map's aspect."),
  groundsDepth: v(300, "See groundsWidth."),
  lawnDiameter: v(102, "Thảm cỏ oval đường kính 102 m — dinhdoclap.gov.vn/kien-truc. Modelled as a circle."),
  buildingFootprint: v(4500, "Khu nhà chính hình chữ T, diện tích mặt bằng 4.500 m² — dinhdoclap.gov.vn/kien-truc."),
  buildingHeight: v(26, "Cao 26 m — dinhdoclap.gov.vn/kien-truc."),
  frontBlockWidth: e(90, "Split of the 4,500 m² T-plan into front block 90×26 m and rear wing 42×52 m is a design estimate."),
  frontBlockDepth: e(26, "Estimated."),
  rearWingWidth: e(42, "Estimated."),
  rearWingDepth: e(52, "Estimated."),
  storeyHeight: e(5, "3 tầng lầu + tầng nền + sân thượng (verified count) distributed over 26 m; equal 5 m storeys are an estimate."),
  plinthHeight: e(1.5, "Estimated raise of the ground floor above the forecourt."),
  lawnCenterZ: e(70, "Distance gate → lawn → palace estimated from the official visitor map (schematic)."),
  palaceFrontZ: e(-10, "Estimated."),
  gateWidth: e(14, "Estimated."),
  octagonHouseDiameter: v(4, "Nhà bát giác đường kính 4 m — dinhdoclap.gov.vn/kien-truc."),
} as const;

export const PLINTH = MEASURES.plinthHeight.value;
export const STOREY = MEASURES.storeyHeight.value;
/** Floor levels (top surface y). */
export const LEVEL = {
  grounds: 0,
  basement: PLINTH - 5.5, // -4
  f1: PLINTH, // tầng nền
  l1: PLINTH + STOREY, // lầu 1 — not walkable in the MVP
  l2: PLINTH + STOREY * 2,
  l3: PLINTH + STOREY * 3,
  roof: PLINTH + STOREY * 4, // sân thượng, 21.5
} as const;

export const GROUNDS = {
  halfW: MEASURES.groundsWidth.value / 2,
  halfD: MEASURES.groundsDepth.value / 2,
  gateZ: MEASURES.groundsDepth.value / 2,
  lawnCenter: [0, MEASURES.lawnCenterZ.value] as [number, number],
  lawnRadius: MEASURES.lawnDiameter.value / 2,
  ringRadius: MEASURES.lawnDiameter.value / 2 + 7,
  ringWidth: 9,
};

/** Front block: z from FRONT_Z-26 to FRONT_Z. Rear wing behind it. */
export const PALACE = {
  frontZ: MEASURES.palaceFrontZ.value,
  front: { x0: -45, x1: 45, z0: -36, z1: -10 },
  rear: { x0: -21, x1: 21, z0: -88, z1: -36 },
};

export type RoomId =
  | "hall"
  | "cabinet"
  | "credentials"
  | "corridor"
  | "closed_east"
  | "b_corridor"
  | "b_comms"
  | "b_maps"
  | "roof";

export interface Room {
  id: RoomId;
  name: Localized;
  floor: FloorId;
  rect: { x0: number; x1: number; z0: number; z1: number };
  status: ConfidenceStatus;
  note: Localized;
}

const SIM_NOTE: Localized = {
  vi: "Vị trí và kích thước trong mô phỏng là ước lượng; trang chính thức không công bố mặt bằng chi tiết của Dinh.",
  en: "Position and size in the simulation are estimates; the official site does not publish detailed floor plans of the palace.",
};

export const ROOMS: Room[] = [
  {
    id: "hall", floor: "f1", rect: { x0: -16, x1: 16, z0: -36, z1: -10 },
    name: { vi: "Đại sảnh", en: "Main hall" }, status: "estimated", note: SIM_NOTE,
  },
  {
    id: "cabinet", floor: "f1", rect: { x0: 16, x1: 45, z0: -36, z1: -10 },
    name: { vi: "Phòng họp Hội đồng Nội các", en: "Cabinet Meeting Room" }, status: "estimated", note: SIM_NOTE,
  },
  {
    id: "closed_east", floor: "f1", rect: { x0: -45, x1: -16, z0: -36, z1: -10 },
    name: { vi: "Khu vực chưa mô hình hóa", en: "Not yet modelled" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "credentials", floor: "f1", rect: { x0: -13, x1: 13, z0: -60, z1: -36 },
    name: { vi: "Phòng Trình Quốc thư", en: "Credentials Presentation Room" }, status: "estimated",
    note: {
      vi: "Trang chính thức xác nhận Phòng Trình Quốc thư là trung tâm của Dinh; kích thước và nội thất trong mô phỏng là ước lượng.",
      en: "The official site confirms this room is the centre of the palace; its size and furnishing here are estimates.",
    },
  },
  {
    id: "corridor", floor: "f1", rect: { x0: -21, x1: 21, z0: -64, z1: -60 },
    name: { vi: "Hành lang cầu thang", en: "Stair corridor" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "b_corridor", floor: "basement", rect: { x0: -21, x1: 21, z0: -64, z1: -60 },
    name: { vi: "Hành lang tầng hầm", en: "Basement corridor" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "b_comms", floor: "basement", rect: { x0: -21, x1: -1, z0: -60, z1: -40 },
    name: { vi: "Khu thông tin liên lạc (mô phỏng)", en: "Communications area (simulated)" }, status: "simulated",
    note: {
      vi: "Nguồn chính thức chỉ nêu tầng hầm có hệ thống thông tin liên lạc; cách bố trí phòng ở đây là minh họa.",
      en: "Official sources only say the basement housed communication systems; this room layout is illustrative.",
    },
  },
  {
    id: "b_maps", floor: "basement", rect: { x0: 1, x1: 21, z0: -60, z1: -40 },
    name: { vi: "Phòng làm việc tầng hầm (mô phỏng)", en: "Basement working room (simulated)" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "roof", floor: "roof", rect: { x0: -45, x1: 45, z0: -88, z1: -10 },
    name: { vi: "Sân thượng", en: "Rooftop terrace" }, status: "estimated", note: SIM_NOTE,
  },
];

/** Stair shafts: two-lane switchbacks. near = the entrance side (higher z). */
export const STAIRS = [
  { id: "stair-basement", x0: -13.6, zNear: -64, from: LEVEL.basement, to: LEVEL.f1, flights: 2 },
  { id: "stair-roof", x0: 9, zNear: -64, from: LEVEL.f1, to: LEVEL.roof, flights: 8 },
] as const;

export const FLAG_POLE: [number, number, number] = [0, LEVEL.roof, -23];
/** Rooftop pavilion (口): outer ring and open courtyard (estimated). */
export const PAVILION = { outer: { x: 12, z0: -32, z1: -14 }, court: { x: 6, z0: -27, z1: -19 } };

export function floorFromY(y: number): FloorId {
  if (y < -1) return "basement";
  if (y > LEVEL.roof - 1) return "roof";
  if (y > 0.9) return "f1";
  return "grounds";
}
