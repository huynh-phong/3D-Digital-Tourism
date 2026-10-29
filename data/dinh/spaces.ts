import type { ConfidenceStatus, FloorId, Localized, Vec3 } from "@/types";
import { LEVEL, PALACE, STAIRS, type RoomId } from "./layout";
import { CEIL_F2, CEIL_OFFICE, COURT, R2, R2_DOORS } from "./rooms2";

/**
 * Room registry: the palace is split into independent spaces (scenes). Each
 * space owns the part of the model inside its regions — render boxes,
 * colliders, furniture, lights and navigation — and is mounted only while the
 * visitor is in it (or while it is being loaded / kept in the small cache).
 *
 * Only spaces that exist in the model are listed. Floor 1 follows the official
 * description (hall; Cabinet Room right, Banquet Room left, central staircase
 * ahead, Khánh tiết behind it). Rooms not modelled yet (the reception rooms and
 * the President's office of floor 2, the upper storeys) have no space and no
 * door leading to them.
 */
export type SpaceId =
  | "exterior"
  | "hall"
  | "cabinet"
  | "dai_yen"
  | "khanh_tiet"
  | "f2_lobby"
  | "credentials"
  | "pres_reception"
  | "red_reception"
  | "vp_reception"
  | "cream_reception"
  | "office2"
  | "courtyard"
  | "corridor"
  | "stair_basement"
  | "stair_roof"
  | "b_corridor"
  | "b_comms"
  | "b_maps"
  | "roof";

/** Axis-aligned region (world metres). */
export interface Region {
  x0: number; x1: number;
  y0: number; y1: number;
  z0: number; z1: number;
}

/** Decorative modules (furniture, curtains, grounds…) a space mounts; see components/game/Palace.tsx. */
export type DecorId =
  | "grounds" // lawn, ring drive, ponds, trees, gate, outdoor exhibits
  | "groundsView" // the same ground surfaces without trees and exhibits (seen through glass)
  | "facade" // porch canopy, stone curtain, glazing
  | "mainDoor"
  | "hall"
  | "cabinet"
  | "credentials"
  | "rearFloor"
  | "stairBay" // central staircase foot, runner and rope posts
  | "lobby2" // floor-2 lobby round the stairwell
  | "daiYen"
  | "khanhTiet"
  | "comms"
  | "maps"
  | "rooftop"
  | "roofline" // terrace paving, palms, lamps, antenna, pavilion fascia (seen from the grounds too)
  | "presReception"
  | "redReception"
  | "vpReception"
  | "creamReception"
  | "office2"
  | "courtyard"
  | "helipad"; // helicopter, painted circles, ferns, rear structures

export interface Space {
  id: SpaceId;
  name: Localized;
  floor: FloorId;
  /** HUD room name (data/dinh/layout ROOMS), if any */
  room: RoomId | null;
  /** what this space owns: boxes and colliders intersecting these regions */
  regions: Region[];
  /** what is visible from inside without being walkable (through glass) */
  viewRegions?: Region[];
  /**
   * owned like `regions` (render, colliders, navigation) but not used to decide
   * which space the visitor is in: the central stairwell, walked between the
   * hall and the floor-2 lobby without a door
   */
  sharedRegions?: Region[];
  decor: DecorId[];
  /** interior fill lights: x, y, z, range, intensity (at most LIGHT_POOL) */
  lights: [number, number, number, number, number][];
  /** default arrival point (restart / fallback) */
  spawn: { p: Vec3; yaw: number };
  /** higher loads first when several are queued */
  loadingPriority: number;
  /** "lru": may stay in the cache after leaving; "evict": freed as soon as it is left */
  cachePolicy: "lru" | "evict";
  verification: ConfidenceStatus;
}

/** Interior fill lights are a fixed pool (changing the light count recompiles every shader). */
export const LIGHT_POOL = 4;

const f1 = LEVEL.f1, f2 = LEVEL.f2, bas = LEVEL.basement, roofY = LEVEL.roof;
const F = PALACE.front, Rr = PALACE.rear;
const [sb, sr] = STAIRS;
const SHAFT_W = 4.6, SHAFT_Z0 = -74;
const CEIL = f1 + 5; // just above the ground-floor ceiling slab (f1 + 4.7 … + 5.0)

/** Ground-floor band: floor slab top … ceiling slab. */
const g = (x0: number, x1: number, z0: number, z1: number): Region => ({ x0, x1, z0, z1, y0: f1 - 0.2, y1: CEIL });
const b = (x0: number, x1: number, z0: number, z1: number): Region => ({ x0, x1, z0, z1, y0: bas - 0.2, y1: f1 - 0.2 });

/** Everything outside the building footprint, ground to above the roof. */
const OUTSIDE: Region[] = [
  { x0: -260, x1: 260, z0: F.z1, z1: 260, y0: -2, y1: 40 },
  { x0: -260, x1: 260, z0: -260, z1: Rr.z0, y0: -2, y1: 40 },
  { x0: -260, x1: F.x0, z0: Rr.z0, z1: F.z1, y0: -2, y1: 40 },
  { x0: F.x1, x1: 260, z0: Rr.z0, z1: F.z1, y0: -2, y1: 40 },
  { x0: F.x0, x1: Rr.x0, z0: Rr.z0, z1: F.z0, y0: -2, y1: 40 },
  { x0: Rr.x1, x1: F.x1, z0: Rr.z0, z1: F.z0, y0: -2, y1: 40 },
];
/**
 * The central stairwell (central flight, landing, two side flights; see
 * FURNITURE.stair*): walked between the hall and the floor-2 lobby. Below the
 * lobby floor the visitor is in the hall, above it in the lobby.
 */
export const STAIRWELL: Region = { x0: -5.6, x1: 5.6, z0: -44.2, z1: -35.4, y0: f1 - 0.2, y1: f1 + 6.6 };
/** Floor-2 spaces (above the floor-1 ceiling slab). */
const LOBBY2: Region = { x0: -13, x1: 13, z0: -46, z1: -31, y0: f2 - 0.2, y1: f2 + 5 };
const CRED2: Region = { x0: -7, x1: 7, z0: -31, z1: -12, y0: f2 - 0.2, y1: f2 + 6.6 };
/** The glazed ground-floor rooms, seen from the porch and the grounds. */
const GLAZED_ROOMS: Region[] = [g(-16, 16, F.z0, F.z1), g(16, F.x1, F.z0, F.z1)];

export const SPACES: Space[] = [
  {
    id: "exterior",
    name: { vi: "Khuôn viên", en: "Grounds" },
    floor: "grounds",
    room: null,
    regions: OUTSIDE,
    // the glazed rooms, and the roofline (parapet, pavilion pillars, stair house) seen from below
    viewRegions: [...GLAZED_ROOMS, { x0: F.x0 - 1, x1: F.x1 + 1, z0: Rr.z0 - 1, z1: F.z1 + 1, y0: roofY - 0.4, y1: roofY + 12 }],
    decor: ["grounds", "facade", "mainDoor", "hall", "cabinet", "roofline", "rooftop"],
    lights: [],
    spawn: { p: [0, 0, 138], yaw: Math.PI },
    loadingPriority: 10,
    cachePolicy: "lru",
    verification: "estimated",
  },
  // floor-2 spaces first: spaceAt() picks the first match, and their floor is the hall's ceiling
  {
    id: "f2_lobby",
    name: { vi: "Sảnh tầng 2", en: "Floor 2 lobby" },
    floor: "f2",
    room: "f2_lobby",
    regions: [LOBBY2],
    sharedRegions: [STAIRWELL],
    decor: ["lobby2"],
    lights: [[0, f2 + 4, -38, 14, 10], [8, f2 + 4, -42, 10, 6], [-8, f2 + 4, -42, 10, 6]],
    spawn: { p: [3.6, f2, -43.4], yaw: 0 },
    loadingPriority: 6,
    cachePolicy: "evict",
    verification: "estimated",
  },
  {
    id: "credentials",
    name: { vi: "Phòng Trình Quốc thư", en: "Credentials Presentation Room" },
    floor: "f2",
    room: "credentials",
    regions: [CRED2],
    decor: ["credentials"],
    lights: [[0, f2 + 5.2, -26, 16, 14], [0, f2 + 5.2, -16, 16, 14], [0, f2 + 3, -14.5, 8, 6]],
    spawn: { p: [5, f2, -28.4], yaw: 0 },
    loadingPriority: 8,
    cachePolicy: "lru",
    verification: "estimated",
  },
  ...(
    [
      ["pres_reception", { vi: "Phòng Tiếp khách Tổng thống", en: "President's Reception Room" }, R2.presReception, "presReception", "estimated", [-18, -20.5, -31.6], Math.PI],
      ["red_reception", { vi: "Phòng tiếp khách ghế gỗ bọc đỏ", en: "Reception room with red carved chairs" }, R2.redReception, "redReception", "simulated", [-37, -20.5, -30.4], -Math.PI / 2],
      ["vp_reception", { vi: "Phòng tiếp khách (nhóm ảnh 13)", en: "Reception room (photo group 13)" }, R2.vpReception, "vpReception", "simulated", [18, -20.5, 11.6], 0],
      ["cream_reception", { vi: "Phòng tiếp khách ghế bọc kem", en: "Reception room with cream armchairs" }, R2.creamReception, "creamReception", "simulated", [37, -22, 30.6], Math.PI / 2],
    ] as const
  ).map(([id, name, r, decor, verification, [lx, lz, sx], yaw]): Space => {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
    return {
      id, name, floor: "f2", room: id,
      regions: [{ ...r, y0: f2 - 0.2, y1: CEIL_F2 + 0.4 }],
      decor: [decor],
      lights: [[cx, CEIL_F2 - 0.8, cz, 18, 14], [lx, CEIL_F2 - 1.2, lz, 14, 9], [cx, f2 + 2.5, r.z1 - 1.2, 10, 5]],
      // spawn just inside the entrance door (x for the doors in z-walls, z for those in x-walls)
      spawn: id === "pres_reception" || id === "vp_reception" ? { p: [id === "pres_reception" ? -10 : 10, f2, -29.2], yaw: 0 } : { p: [sx, f2, lz === -20.5 ? -20.5 : -28], yaw },
      loadingPriority: 6,
      cachePolicy: "lru",
      verification,
    };
  }),
  {
    id: "office2",
    name: { vi: "Phòng làm việc (bàn giấy)", en: "Office with desk" },
    floor: "f2",
    room: "office2",
    regions: [{ ...R2.office, y0: f2 - 0.2, y1: CEIL_OFFICE + 0.4 }],
    decor: ["office2"],
    lights: [[0, CEIL_OFFICE - 0.6, -52, 12, 10], [0, f2 + 2.4, -56, 8, 4]],
    spawn: { p: [1.5, f2, -47.4], yaw: Math.PI },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "hall",
    name: { vi: "Đại sảnh", en: "Main hall" },
    floor: "f1",
    room: "hall",
    // the hall and, straight ahead, the bay of the central staircase
    regions: [g(-16, 16, F.z0, F.z1), g(-13, 13, -44, F.z0)],
    sharedRegions: [STAIRWELL],
    // the floor-2 lobby is visible up the stairwell
    viewRegions: [LOBBY2],
    decor: ["hall", "facade", "mainDoor", "groundsView", "rearFloor", "stairBay"],
    lights: [[-8, 5.3, -23, 20, 16], [8, 5.3, -23, 20, 16], [0, 5.2, -38, 14, 10]],
    spawn: { p: [0, f1, -15], yaw: Math.PI },
    loadingPriority: 9,
    cachePolicy: "lru",
    verification: "estimated",
  },
  {
    id: "cabinet",
    name: { vi: "Phòng họp Hội đồng Nội các", en: "Cabinet Meeting Room" },
    floor: "f1",
    room: "cabinet",
    regions: [g(16, F.x1, F.z0, F.z1)],
    decor: ["cabinet", "facade", "groundsView"],
    lights: [[30, 5.2, -23, 20, 18], [22, 5.2, -16, 14, 8], [40, 5.2, -23, 14, 8]],
    spawn: { p: [20.4, f1, -22.5], yaw: Math.PI / 2 },
    loadingPriority: 7,
    cachePolicy: "lru",
    verification: "estimated",
  },
  {
    id: "dai_yen",
    name: { vi: "Phòng Đại yến", en: "State Banquet Room" },
    floor: "f1",
    room: "dai_yen",
    regions: [g(F.x0, -16, F.z0, F.z1)],
    decor: ["daiYen"],
    lights: [[-36, 5.2, -23, 20, 16], [-25, 5.2, -23, 18, 14], [-43, 3.6, -23, 8, 5]],
    spawn: { p: [-19.6, f1, -22.5], yaw: -Math.PI / 2 },
    loadingPriority: 7,
    cachePolicy: "lru",
    verification: "estimated",
  },
  {
    id: "khanh_tiet",
    name: { vi: "Phòng Khánh tiết", en: "Khánh tiết (Ceremonial) Room" },
    floor: "f1",
    room: "khanh_tiet",
    regions: [g(-13, 13, -60, -44)],
    decor: ["khanhTiet", "rearFloor"],
    lights: [[0, 5.2, -48, 16, 14], [0, 5.2, -56, 16, 14], [0, 3, -45.2, 8, 5]],
    spawn: { p: [8.4, f1, -46.6], yaw: Math.PI },
    loadingPriority: 7,
    cachePolicy: "lru",
    verification: "estimated",
  },
  {
    id: "corridor",
    name: { vi: "Hành lang cầu thang", en: "Stair corridor" },
    floor: "f1",
    room: "corridor",
    regions: [g(Rr.x0, Rr.x1, -64, -60)],
    decor: ["rearFloor"],
    lights: [[0, 5.2, -62, 16, 12], [-12, 5.2, -62, 10, 6]],
    spawn: { p: [5.5, f1, -62.2], yaw: -Math.PI / 2 },
    loadingPriority: 6,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "courtyard",
    name: { vi: "Sân trong (giếng trời)", en: "Inner courtyard (lightwell)" },
    floor: "f1",
    room: "courtyard",
    // the passage between the shafts and the two-storey gallery round the garden (below the roof)
    regions: [
      { ...COURT.passage, y0: f1 - 0.2, y1: CEIL },
      { ...COURT.gallery, y0: f1 - 0.2, y1: roofY - 0.5 },
    ],
    // the roof slab round the opening and the slatted beams
    viewRegions: [{ ...COURT.gallery, y0: roofY - 0.5, y1: roofY + 1.5 }],
    decor: ["courtyard"],
    lights: [[0, CEIL - 0.6, -69, 10, 6], [-10.8, CEIL - 0.6, -81, 12, 6], [10.8, CEIL - 0.6, -81, 12, 6]],
    spawn: { p: [0, f1, -66], yaw: Math.PI },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "stair_basement",
    name: { vi: "Cầu thang xuống tầng hầm", en: "Basement stairs" },
    floor: "f1",
    room: null,
    regions: [{ x0: sb.x0, x1: sb.x0 + SHAFT_W, z0: SHAFT_Z0, z1: -64, y0: bas - 0.2, y1: f1 + 3.4 }],
    decor: [],
    lights: [[sb.x0 + 2.3, f1 + 2.5, -69, 12, 9], [sb.x0 + 2.3, bas + 2.5, -69, 12, 9]],
    spawn: { p: [sb.x0 + 2.3, f1, -65.4], yaw: Math.PI },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "stair_roof",
    name: { vi: "Cầu thang lên sân thượng", en: "Rooftop stairs" },
    floor: "f1",
    room: null,
    regions: [{ x0: sr.x0, x1: sr.x0 + SHAFT_W, z0: SHAFT_Z0, z1: -64, y0: f1 - 0.2, y1: roofY + 3.6 }],
    decor: [],
    lights: [[sr.x0 + 2.3, 6, -69, 16, 12], [sr.x0 + 2.3, 16, -69, 16, 12], [sr.x0 + 2.3, roofY + 1, -69, 10, 8]],
    spawn: { p: [sr.x0 + 2.3, f1, -65.4], yaw: Math.PI },
    loadingPriority: 4,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "b_corridor",
    name: { vi: "Hành lang tầng hầm", en: "Basement corridor" },
    floor: "basement",
    room: "b_corridor",
    regions: [b(Rr.x0, Rr.x1, -64, -60)],
    decor: [],
    lights: [[0, -0.3, -62, 14, 10], [-11, -0.3, -62, 10, 6]],
    spawn: { p: [-7.5, bas, -62.2], yaw: Math.PI / 2 },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "b_comms",
    name: { vi: "Khu thông tin liên lạc (mô phỏng)", en: "Communications area (simulated)" },
    floor: "basement",
    room: "b_comms",
    regions: [b(Rr.x0, -1, -60, -40)],
    decor: ["comms"],
    lights: [[-10, -0.3, -50, 18, 14]],
    spawn: { p: [-10.5, bas, -57.4], yaw: 0 },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "b_maps",
    name: { vi: "Phòng làm việc tầng hầm (mô phỏng)", en: "Basement working room (simulated)" },
    floor: "basement",
    room: "b_maps",
    regions: [b(1, Rr.x1, -60, -40)],
    decor: ["maps"],
    lights: [[10, -0.3, -50, 16, 14]],
    spawn: { p: [10.5, bas, -57.4], yaw: 0 },
    loadingPriority: 5,
    cachePolicy: "evict",
    verification: "simulated",
  },
  {
    id: "roof",
    name: { vi: "Sân thượng", en: "Rooftop terrace" },
    floor: "roof",
    room: "roof",
    regions: [{ x0: F.x0 - 1, x1: F.x1 + 1, z0: Rr.z0 - 1, z1: F.z1 + 1, y0: roofY - 0.4, y1: roofY + 12 }],
    // the grounds below are part of the view from the terrace
    viewRegions: OUTSIDE.map((r) => ({ ...r, y1: Math.min(r.y1, roofY - 0.4) })),
    decor: ["rooftop", "roofline", "helipad", "grounds", "facade"],
    lights: [],
    spawn: { p: [0, roofY, -40], yaw: 0 },
    loadingPriority: 6,
    cachePolicy: "lru",
    verification: "estimated",
  },
];

export const SPACE_BY_ID = new Map(SPACES.map((s) => [s.id, s]));

/**
 * Reference photos each space was modelled from: group folder and photo ids in
 * DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1 (DANH_MUC_ANH_GIU_LAI.csv). The photos
 * are references only; none is pasted onto a surface.
 */
export const REFERENCE_PHOTOS: Partial<Record<SpaceId, { group: string; priority: "P0" | "P1"; ids: string[] }[]>> = {
  exterior: [
    { group: "01_Ngoai_that_San_co_Dai_phun_nuoc", priority: "P0", ids: ["0061", "0070", "0071", "0074", "0187", "0189", "0194", "0299"] },
    { group: "02_Ngoai_that_Mat_tien_Tong_the", priority: "P0", ids: ["0068", "0153", "0155", "0156", "0192", "0197", "0199", "0216"] },
    { group: "03_Ngoai_that_Lam_che_nang_Mat_ben", priority: "P0", ids: ["0072", "0073", "0191", "0287"] },
  ],
  hall: [{ group: "06_Cau_thang_chinh", priority: "P1", ids: ["0066", "0239"] }],
  cabinet: [{ group: "07_Phong_hop_Noi_cac", priority: "P0", ids: ["0001", "0017", "0019", "0098", "0139", "0247"] }],
  dai_yen: [{ group: "08_Phong_Dai_yen", priority: "P0", ids: ["0008", "0018", "0042", "0067", "0097", "0118", "0141", "0168", "0248", "0293"] }],
  credentials: [{ group: "09_Phong_Trinh_quoc_thu", priority: "P0", ids: ["0021", "0030", "0031", "0110", "0123", "0198", "0242"] }],
  khanh_tiet: [{ group: "10_Phong_Khanh_tiet", priority: "P0", ids: ["0079", "0096", "0105", "0108", "0119", "0137", "0138", "0240"] }],
  b_maps: [{ group: "15_Ham_tac_chien_Phong_ban_do", priority: "P0", ids: ["0128", "0132", "0173", "0174", "0277", "0298"] }],
  b_comms: [{ group: "16_Ham_tac_chien_Phong_truyen_tin", priority: "P1", ids: ["0107", "0129", "0130", "0131", "0146", "0147", "0148", "0225", "0226"] }],
  roof: [{ group: "05_San_thuong_Bai_dap", priority: "P1", ids: ["0106", "0202", "0204", "0246"] }],
  courtyard: [{ group: "04_San_trong_Gieng_troi", priority: "P1", ids: ["0039", "0051", "0171"] }],
  pres_reception: [{ group: "11_Phong_tiep_khach_Nghi_le", priority: "P1", ids: ["0015", "0081", "0297"] }, { group: "12_Phong_tiep_khach_Ghe_go_do", priority: "P1", ids: ["0048"] }],
  red_reception: [{ group: "12_Phong_tiep_khach_Ghe_go_do", priority: "P1", ids: ["0003", "0082", "0286"] }],
  vp_reception: [{ group: "13_Phong_tiep_khach_Pho_Tong_thong", priority: "P1", ids: ["0044", "0049", "0050", "0218"] }],
  cream_reception: [{ group: "11_Phong_tiep_khach_Nghi_le", priority: "P1", ids: ["0013", "0076"] }],
  office2: [{ group: "14_Phong_lam_viec_Ban_giay", priority: "P1", ids: ["0055", "0122"] }],
};

const inside = (r: Region, p: Vec3, pad = 0) =>
  p[0] >= r.x0 - pad && p[0] <= r.x1 + pad && p[1] >= r.y0 - pad && p[1] <= r.y1 + pad && p[2] >= r.z0 - pad && p[2] <= r.z1 + pad;

/** The space a point belongs to (interior spaces first; the outside last). */
export function spaceAt(p: Vec3): SpaceId {
  for (const s of SPACES) if (s.id !== "exterior" && s.regions.some((r) => inside(r, p, 0.05))) return s.id;
  return "exterior";
}

/* ----------------------------------------------------------------- doors */
/**
 * Door leaves in the real doorways of the model (closed: the way through is
 * the F interaction). Each belongs to the two spaces it connects. `ry`: 0 for
 * a door in a wall along x, π/2 for one in a wall along z.
 */
export interface SpaceDoor {
  id: string;
  between: [SpaceId, SpaceId];
  p: Vec3; // bottom centre
  ry: number;
  w: number;
  h: number;
}

export const SPACE_DOORS: SpaceDoor[] = [
  { id: "d-hall-cabinet", between: ["hall", "cabinet"], p: [16, f1, -22.5], ry: Math.PI / 2, w: 4, h: 3.2 },
  { id: "d-hall-daiyen", between: ["hall", "dai_yen"], p: [-16, f1, -22.5], ry: Math.PI / 2, w: 4, h: 3.2 },
  { id: "d-hall-khanhtiet-w", between: ["hall", "khanh_tiet"], p: [-9, f1, -44], ry: 0, w: 2.4, h: 3 },
  { id: "d-hall-khanhtiet-e", between: ["hall", "khanh_tiet"], p: [9, f1, -44], ry: 0, w: 2.4, h: 3 },
  { id: "d-lobby-credentials", between: ["f2_lobby", "credentials"], p: [5, f2, -31], ry: 0, w: 2.4, h: 3.2 },
  { id: "d-lobby-pres", between: ["f2_lobby", "pres_reception"], p: [R2_DOORS.lobbyPres.x, f2, R2_DOORS.lobbyPres.z], ry: 0, w: R2_DOORS.lobbyPres.w, h: R2_DOORS.lobbyPres.h },
  { id: "d-pres-red", between: ["pres_reception", "red_reception"], p: [R2_DOORS.presRed.x, f2, R2_DOORS.presRed.z], ry: Math.PI / 2, w: R2_DOORS.presRed.w, h: R2_DOORS.presRed.h },
  { id: "d-lobby-vp", between: ["f2_lobby", "vp_reception"], p: [R2_DOORS.lobbyVp.x, f2, R2_DOORS.lobbyVp.z], ry: 0, w: R2_DOORS.lobbyVp.w, h: R2_DOORS.lobbyVp.h },
  { id: "d-vp-cream", between: ["vp_reception", "cream_reception"], p: [R2_DOORS.vpCream.x, f2, R2_DOORS.vpCream.z], ry: Math.PI / 2, w: R2_DOORS.vpCream.w, h: R2_DOORS.vpCream.h },
  { id: "d-lobby-office", between: ["f2_lobby", "office2"], p: [R2_DOORS.lobbyOffice.x, f2, R2_DOORS.lobbyOffice.z], ry: 0, w: R2_DOORS.lobbyOffice.w, h: R2_DOORS.lobbyOffice.h },
  { id: "d-corridor-courtyard", between: ["corridor", "courtyard"], p: [COURT.door.x, f1, COURT.door.z], ry: 0, w: COURT.door.w, h: COURT.door.h },
  { id: "d-khanhtiet-corridor", between: ["khanh_tiet", "corridor"], p: [8.5, f1, -60], ry: 0, w: 3, h: 3.2 },
  { id: "d-corridor-stairb", between: ["corridor", "stair_basement"], p: [sb.x0 + SHAFT_W / 2, f1, -64], ry: 0, w: 4, h: 3.2 },
  { id: "d-corridor-stairr", between: ["corridor", "stair_roof"], p: [sr.x0 + SHAFT_W / 2, f1, -64], ry: 0, w: 4, h: 3.2 },
  { id: "d-stairb-bcorridor", between: ["stair_basement", "b_corridor"], p: [sb.x0 + SHAFT_W / 2, bas, -64], ry: 0, w: 4, h: 2.8 },
  { id: "d-bcorridor-comms", between: ["b_corridor", "b_comms"], p: [-10.5, bas, -60], ry: 0, w: 2.4, h: 2.6 },
  { id: "d-bcorridor-maps", between: ["b_corridor", "b_maps"], p: [10.5, bas, -60], ry: 0, w: 2.4, h: 2.6 },
  { id: "d-stairr-roof", between: ["stair_roof", "roof"], p: [sr.x0 + SHAFT_W / 2, roofY, -64], ry: 0, w: 3, h: 2.6 },
];
