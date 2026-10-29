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
  lawnCenterZ: e(80, "Distance gate → lawn → palace estimated from the official visitor map (schematic); placed so the ring drive clears the half-moon pond."),
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
  f1: PLINTH, // tầng 1 (entrance floor)
  f2: PLINTH + STOREY, // tầng 2: upper lobby and Phòng Trình Quốc thư
  l1: PLINTH + STOREY, // same level as f2 (kept for older code)
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
  | "dai_yen"
  | "stair_hall"
  | "khanh_tiet"
  | "corridor"
  | "f2_lobby"
  | "credentials"
  | "pres_reception"
  | "red_reception"
  | "vp_reception"
  | "cream_reception"
  | "office2"
  | "courtyard"
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

/**
 * Floor 1 follows the official description (dinhdoclap.gov.vn, "Hành trình 60 năm
 * của bức tranh thủy mặc Việt Nam Quốc Tổ"): from the entrance hall, the Cabinet
 * Room is on the right, the Banquet Room on the left, the central staircase to
 * floor 2 straight ahead, and the Khánh tiết Room behind that staircase.
 * Sizes and exact positions are estimates (no measured plan is published).
 */
const OFFICIAL_LAYOUT: Localized = {
  vi: "Vị trí tương đối (bên phải/bên trái sảnh, sau cầu thang trung tâm) theo mô tả của trang chính thức dinhdoclap.gov.vn; kích thước là ước lượng.",
  en: "Relative position (right/left of the hall, behind the central staircase) follows the official site dinhdoclap.gov.vn; sizes are estimates.",
};

export const ROOMS: Room[] = [
  {
    id: "hall", floor: "f1", rect: { x0: -16, x1: 16, z0: -36, z1: -10 },
    name: { vi: "Đại sảnh", en: "Main hall" }, status: "estimated", note: SIM_NOTE,
  },
  {
    id: "cabinet", floor: "f1", rect: { x0: 16, x1: 45, z0: -36, z1: -10 },
    name: { vi: "Phòng họp Hội đồng Nội các", en: "Cabinet Meeting Room" }, status: "estimated", note: OFFICIAL_LAYOUT,
  },
  {
    id: "dai_yen", floor: "f1", rect: { x0: -45, x1: -16, z0: -36, z1: -10 },
    name: { vi: "Phòng Đại yến", en: "State Banquet Room" }, status: "estimated", note: OFFICIAL_LAYOUT,
  },
  {
    id: "stair_hall", floor: "f1", rect: { x0: -13, x1: 13, z0: -44, z1: -36 },
    name: { vi: "Cầu thang trung tâm", en: "Central staircase" }, status: "estimated", note: OFFICIAL_LAYOUT,
  },
  {
    id: "khanh_tiet", floor: "f1", rect: { x0: -13, x1: 13, z0: -60, z1: -44 },
    name: { vi: "Phòng Khánh tiết", en: "Khánh tiết (Ceremonial) Room" }, status: "estimated", note: OFFICIAL_LAYOUT,
  },
  {
    id: "corridor", floor: "f1", rect: { x0: -21, x1: 21, z0: -64, z1: -60 },
    name: { vi: "Hành lang cầu thang", en: "Stair corridor" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "f2_lobby", floor: "f2", rect: { x0: -13, x1: 13, z0: -46, z1: -31 },
    name: { vi: "Sảnh tầng 2", en: "Floor 2 lobby" }, status: "estimated", note: SIM_NOTE,
  },
  {
    id: "credentials", floor: "f2", rect: { x0: -7, x1: 7, z0: -31, z1: -12 },
    name: { vi: "Phòng Trình Quốc thư", en: "Credentials Presentation Room" }, status: "estimated",
    note: {
      vi: "Bức sơn mài “Bình Ngô Đại Cáo” (8,20 m × 4,70 m) trưng bày tại phòng này theo trang chính thức. Vị trí của phòng trên tầng 2 và kích thước phòng là ước lượng, chưa đối chiếu được với sơ đồ chính thức.",
      en: "The lacquer painting “Bình Ngô Đại Cáo” (8.20 m × 4.70 m) hangs in this room according to the official site. The room's position on floor 2 and its size are estimates, not yet checked against an official plan.",
    },
  },
  {
    id: "pres_reception", floor: "f2", rect: { x0: -29, x1: -7, z0: -31, z1: -10 },
    name: { vi: "Phòng Tiếp khách Tổng thống", en: "President's Reception Room" }, status: "estimated",
    note: {
      vi: "Tên phòng và tầng 2 theo trang chính thức (bài “Những nét vẽ Mai Lan Cúc Trúc trên tủ phòng Tiếp khách Tổng thống”); bố trí theo ảnh tham chiếu DDLP_0015, 0081, 0297, 0048. Vị trí và kích thước phòng là ước lượng.",
      en: "Room name and floor 2 from the official site (article on the Mai–Lan–Cúc–Trúc cabinets); furnished after reference photos DDLP_0015, 0081, 0297, 0048. Position and size are estimates.",
    },
  },
  {
    id: "red_reception", floor: "f2", rect: { x0: -45, x1: -29, z0: -36, z1: -10 },
    name: { vi: "Phòng tiếp khách ghế gỗ bọc đỏ", en: "Reception room with red carved chairs" }, status: "simulated",
    note: {
      vi: "Dựng theo nhóm ảnh 12 (DDLP_0003, 0286). Tên phòng chính thức và vị trí chưa xác minh được.",
      en: "Built from reference group 12 (DDLP_0003, 0286). Official name and position not verified.",
    },
  },
  {
    id: "vp_reception", floor: "f2", rect: { x0: 7, x1: 29, z0: -31, z1: -10 },
    name: { vi: "Phòng tiếp khách (nhóm ảnh 13)", en: "Reception room (photo group 13)" }, status: "simulated",
    note: {
      vi: "Dựng theo nhóm ảnh 13 (DDLP_0044, 0049, 0050, 0218) và 0082. Bộ ảnh phân loại là “Phòng tiếp khách Phó Tổng thống” nhưng chưa đối chiếu được với nguồn chính thức.",
      en: "Built from reference group 13 (DDLP_0044, 0049, 0050, 0218) and 0082. The photo set labels it the Vice-President's reception room; not checked against an official source.",
    },
  },
  {
    id: "cream_reception", floor: "f2", rect: { x0: 29, x1: 45, z0: -36, z1: -10 },
    name: { vi: "Phòng tiếp khách ghế bọc kem", en: "Reception room with cream armchairs" }, status: "simulated",
    note: {
      vi: "Dựng theo ảnh DDLP_0013, 0076 (nhóm 11). Tên phòng chính thức và vị trí chưa xác minh được.",
      en: "Built from DDLP_0013, 0076 (group 11). Official name and position not verified.",
    },
  },
  {
    id: "office2", floor: "f2", rect: { x0: -6, x1: 6, z0: -58, z1: -46 },
    name: { vi: "Phòng làm việc (bàn giấy)", en: "Office with desk" }, status: "simulated",
    note: {
      vi: "Dựng theo nhóm ảnh 14 (DDLP_0055, 0122). Trang chính thức có nhắc phòng làm việc của Tổng thống và Phó Tổng thống, nhưng chưa xác minh được ảnh này thuộc phòng nào; bức tranh là minh họa, không sao chép tác phẩm.",
      en: "Built from reference group 14 (DDLP_0055, 0122). The official site mentions offices of the President and Vice-President, but which one these photos show is not verified; the painting is illustrative, not a copy.",
    },
  },
  {
    id: "courtyard", floor: "f1", rect: { x0: -12.6, x1: 12.6, z0: -88, z1: -64 },
    name: { vi: "Sân trong (giếng trời)", en: "Inner courtyard (lightwell)" }, status: "simulated",
    note: {
      vi: "Dựng theo nhóm ảnh 04 (DDLP_0039, 0051, 0171): vườn lộ thiên có hòn non bộ, hồ lát mosaic, hành lang hai tầng. Vị trí trong khối nhà sau và kích thước là ước lượng; nguồn chính thức chưa công bố mặt bằng.",
      en: "Built from reference group 04 (DDLP_0039, 0051, 0171): an open-air garden with a rockery, a mosaic pond and a two-storey gallery. Its position in the rear wing and its size are estimates; no official plan is published.",
    },
  },
  {
    id: "b_corridor", floor: "basement", rect: { x0: -21, x1: 21, z0: -64, z1: -60 },
    name: { vi: "Hành lang tầng hầm", en: "Basement corridor" }, status: "simulated", note: SIM_NOTE,
  },
  {
    id: "b_comms", floor: "basement", rect: { x0: -21, x1: -1, z0: -60, z1: -40 },
    name: { vi: "Phòng truyền tin (hầm)", en: "Telecommunications room (basement)" }, status: "simulated",
    note: {
      vi: "Bố trí theo ảnh tham chiếu nhóm 16 (máy điện tín, tổng đài, máy vô tuyến); vị trí phòng trong tầng hầm là mô phỏng.",
      en: "Furnished after reference group 16 (teleprinters, switchboard, radio sets); its position within the basement is simulated.",
    },
  },
  {
    id: "b_maps", floor: "basement", rect: { x0: 1, x1: 21, z0: -60, z1: -40 },
    name: { vi: "Phòng bản đồ tác chiến (hầm)", en: "War map room (basement)" }, status: "simulated",
    note: {
      vi: "Bố trí theo ảnh tham chiếu nhóm 15 (vách ốp gỗ, bản đồ treo tường, bàn chỉ huy); bản đồ là hình minh họa, không sao chép bản đồ thật; vị trí phòng là mô phỏng.",
      en: "Furnished after reference group 15 (wood-panelled walls, wall maps, commander's desk); the maps are illustrative, not copies of the real ones; the room's position is simulated.",
    },
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
  if (y > LEVEL.f2 - 1) return "f2";
  if (y > 0.9) return "f1";
  return "grounds";
}
