import { LEVEL } from "./layout";

/**
 * Floor-2 reception rooms and office, modelled from reference groups 11–14
 * (DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1). Positions, sizes and doors are
 * estimates (no measured plan is published). What is verified:
 * - "Phòng Tiếp khách Tổng thống" is on floor 2 and holds two red lacquer
 *   cabinets painted in gold with "Mai – Lan" and "Cúc – Trúc" (dinhdoclap.gov.vn,
 *   "Những nét vẽ Mai Lan Cúc Trúc trên tủ phòng Tiếp khách Tổng thống"); the
 *   photos showing these cabinets (DDLP_0015, 0297, 0048) are that room.
 * - The palace has offices of the President and Vice-President and reception
 *   rooms (official site); which photos show which of them is NOT verified, so
 *   the other rooms keep descriptive names.
 * Furniture positions are shared by the model (colliders) and the decor.
 */
export const F2 = LEVEL.f2;
export const CEIL_F2 = F2 + 5.2; // reception rooms (curtains run floor to ceiling in the photos)
export const CEIL_OFFICE = F2 + 4.4;

export const R2 = {
  /** Phòng Tiếp khách Tổng thống (verified name and floor; position estimated) */
  presReception: { x0: -29, x1: -7, z0: -31, z1: -10 },
  /** reception room with carved red-upholstered chairs (group 12; name unverified) */
  redReception: { x0: -45, x1: -29, z0: -36, z1: -10 },
  /** long reception room, rows of carved chairs, gold curtain wall (group 13; "Phó Tổng thống" unverified) */
  vpReception: { x0: 7, x1: 29, z0: -31, z1: -10 },
  /** reception room with cream armchairs and a curtain wall (group 11: 0013, 0076; name unverified) */
  creamReception: { x0: 29, x1: 45, z0: -36, z1: -10 },
  /** office with a desk and a landscape painting (group 14; name unverified) */
  office: { x0: -6, x1: 6, z0: -58, z1: -46 },
} as const;

/**
 * Inner courtyard (giếng trời, group 04: DDLP_0039, 0051, 0171): a garden open
 * to the sky, ringed by a two-storey gallery — square pink-granite columns on
 * the ground floor, white columns and solid white parapets upstairs, dark navy
 * slatted beams round the opening at the roof. Its position in the rear wing
 * and its size are estimates (no published plan); it is reached from the stair
 * corridor between the two stair shafts.
 */
export const COURT = {
  /** the opening to the sky (garden) */
  open: { x0: -9, x1: 9, z0: -86, z1: -76 },
  /** outer line of the galleries */
  gallery: { x0: -12.6, x1: 12.6, z0: -88, z1: -74 },
  /** passage from the corridor, between the stair shafts */
  passage: { x0: -9, x1: 9, z0: -74, z1: -64 },
  door: { x: 0, z: -64, w: 3, h: 3.2 },
  columnStep: 3,
} as const;

/** Doorways (centre on the wall line, width w, height h). */
export const R2_DOORS = {
  lobbyPres: { x: -10, z: -31, w: 2.4, h: 3.2 },
  presRed: { x: -29, z: -20.5, w: 3.2, h: 3.6 }, // the wide framed doorway of DDLP_0003
  lobbyVp: { x: 10, z: -31, w: 2.4, h: 3.2 },
  vpCream: { x: 29, z: -28, w: 2.4, h: 3.2 },
  lobbyOffice: { x: 0, z: -46, w: 2.4, h: 3.2 },
} as const;

type Seat = { x: number; z: number; ry: number };
const row = (x0: number, x1: number, n: number, z: number, ry: number): Seat[] =>
  Array.from({ length: n }, (_, i) => ({ x: x0 + ((x1 - x0) * i) / Math.max(1, n - 1), z, ry }));
const col = (z0: number, z1: number, n: number, x: number, ry: number): Seat[] =>
  Array.from({ length: n }, (_, i) => ({ x, z: z0 + ((z1 - z0) * i) / Math.max(1, n - 1), ry }));

/** Phòng Tiếp khách Tổng thống (DDLP_0015, 0081, 0297, 0048): axis toward the niche on the back wall. */
export const PRES = (() => {
  const r = R2.presReception, cx = (r.x0 + r.x1) / 2;
  return {
    cx,
    // three-seat sofas and armchairs in gold damask, facing the axis
    sofas: [{ x: cx - 5.2, z: -22.5, ry: Math.PI / 2 }, { x: cx + 5.2, z: -22.5, ry: -Math.PI / 2 }],
    armchairs: [
      ...col(-18.5, -15.5, 2, cx - 5.2, Math.PI / 2), ...col(-18.5, -15.5, 2, cx + 5.2, -Math.PI / 2),
      { x: cx - 1.6, z: -29.2, ry: 0 }, { x: cx + 1.6, z: -29.2, ry: 0 },
    ],
    lowTables: [{ x: cx - 3.4, z: -22.5, ry: 0 }, { x: cx + 3.4, z: -22.5, ry: 0 }, { x: cx, z: -28.2, ry: 0 }],
    tripods: [{ x: cx - 3.6, z: -17, ry: 0 }, { x: cx + 3.6, z: -17, ry: 0 }, { x: cx - 3.2, z: -29, ry: 0 }, { x: cx + 3.2, z: -29, ry: 0 }],
    sideChairs: [...col(-27, -13, 6, r.x0 + 0.6, Math.PI / 2), ...col(-27, -13, 6, r.x1 - 0.6, -Math.PI / 2)],
    cabinets: [{ x: cx - 5.4, z: r.z0 + 0.45 }, { x: cx + 5.4, z: r.z0 + 0.45 }],
    throne: { x: cx, z: r.z0 + 0.9 },
    vases: [{ x: r.x0 + 0.8, z: r.z0 + 0.8 }, { x: r.x1 - 0.8, z: r.z0 + 0.8 }],
    rug: { x: cx, z: -21.5, w: 11.5, d: 15 },
  };
})();

/** Reception room with carved red chairs (DDLP_0003, 0286): desk before a tall wood panel, a round table group. */
export const RED = (() => {
  const r = R2.redReception, cx = (r.x0 + r.x1) / 2;
  return {
    cx,
    desk: { x: cx, z: -31.6, w: 2.6, d: 1.1 },
    chairs: [
      { x: cx, z: -33, ry: 0 }, { x: cx - 1.1, z: -29.6, ry: Math.PI }, { x: cx + 1.1, z: -29.6, ry: Math.PI },
      // round table group
      ...Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        return { x: cx + Math.cos(a) * 1.7, z: -18 + Math.sin(a) * 1.7, ry: Math.atan2(-Math.cos(a), -Math.sin(a)) };
      }),
      ...col(-26, -14, 5, r.x0 + 0.7, Math.PI / 2),
    ],
    roundTable: { x: cx, z: -18, r: 0.9 },
    vases: [{ x: cx - 3.2, z: -34.8 }, { x: cx + 3.2, z: -34.8 }, { x: r.x0 + 0.8, z: -11 }, { x: r.x1 - 0.8, z: -11 }],
    rug: { x: cx, z: -24, w: 11, d: 16 },
  };
})();

/** Long reception room (DDLP_0044, 0049, 0050, 0218, 0082): two facing rows of carved chairs, curtain wall at the east end. */
export const VP = (() => {
  const r = R2.vpReception;
  return {
    rows: [...row(10, 25, 9, -13.4, Math.PI), ...row(10, 25, 9, -27.6, 0)],
    tables: [...row(11.5, 23.5, 4, -15.4, 0), ...row(11.5, 23.5, 4, -25.6, 0)],
    endChairs: [{ x: r.x1 - 1.4, z: -22, ry: -Math.PI / 2 }, { x: r.x1 - 1.4, z: -19, ry: -Math.PI / 2 }],
    endTable: { x: r.x1 - 1.4, z: -20.5 },
    vases: [{ x: 8, z: -11 }, { x: 8, z: -30 }, { x: r.x1 - 0.7, z: -11.5 }, { x: r.x1 - 0.7, z: -26 }],
    rugs: [{ x: 12.5, z: -20.5 }, { x: 18, z: -20.5 }, { x: 23.5, z: -20.5 }],
  };
})();

/** Reception room with cream armchairs (DDLP_0013, 0076): facing rows, curtain wall at the back. */
export const CREAM = (() => {
  const r = R2.creamReception;
  return {
    armchairs: [...col(-31, -14, 7, r.x0 + 3, Math.PI / 2), ...col(-31, -14, 7, r.x1 - 3, -Math.PI / 2), { x: 35.6, z: -33.6, ry: 0 }, { x: 38.4, z: -33.6, ry: 0 }],
    tables: [...col(-29, -16, 4, r.x0 + 4.6, 0), ...col(-29, -16, 4, r.x1 - 4.6, 0), { x: 37, z: -33.4, ry: 0 }],
    vases: [{ x: r.x0 + 1, z: -34.8 }, { x: r.x1 - 1, z: -34.8 }],
    rugs: [{ x: 37, z: -29 }, { x: 37, z: -22.5 }, { x: 37, z: -16 }],
  };
})();

/** Office (DDLP_0055, 0122): desk, chair, telephones, landscape painting over a reeded wood wainscot. */
export const OFFICE = { desk: { x: 0, z: -54.2, w: 2.6, d: 1.2 }, chair: { x: 0, z: -55.6, ry: 0 }, fan: { x: -3.5, z: -50 } };
