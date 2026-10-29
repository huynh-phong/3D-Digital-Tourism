import * as THREE from "three";
import { rng } from "@/lib/geo";

/**
 * Procedural PBR texture sets for the palace (no downloaded assets).
 *
 * Every set is drawn once per quality level into canvases: base colour (sRGB),
 * roughness (linear) and a normal map derived from a height field. Patterns are
 * tileable and sized in metres; materials use world-space planar UVs (see
 * `worldUV`) so a 30 m wall and a 0.5 m chair seat get the same texel density
 * and nothing is stretched.
 *
 * Colours follow the official photos of dinhdoclap.gov.vn where available
 * (dark polished granite corridors, golden carpet + red curtains in the
 * Credentials Room, green carpet + curtains in the Cabinet Room, white façade).
 * Everything else is a neutral, well-kept finish rather than an invented one.
 */

export type TexQuality = "low" | "medium" | "high";

/* ------------------------------------------------------------------ noise */
function hash(x: number, y: number, s: number) {
  let h = (x * 374761393 + y * 668265263 + s * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Tileable value noise: lattice wraps every `period` cells. */
function vnoise(x: number, y: number, period: number, seed: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const p = (n: number) => ((n % period) + period) % period;
  const a = hash(p(xi), p(yi), seed), b = hash(p(xi + 1), p(yi), seed);
  const c = hash(p(xi), p(yi + 1), seed), d = hash(p(xi + 1), p(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
/** Tileable fBm in [0,1]. (x,y) in [0,1) texture space; `freq` lattice cells per tile. */
function fbm(x: number, y: number, freq: number, oct: number, seed: number) {
  let s = 0, a = 0.5, f = freq, n = 0;
  for (let o = 0; o < oct; o++) {
    s += vnoise(x * f, y * f, f, seed + o * 17) * a;
    n += a;
    a *= 0.5;
    f *= 2;
  }
  return s / n;
}

/**
 * Tileable Worley cells: `n`×`n` jittered seeds per tile (wrapping). d1/d2 are the
 * distances to the nearest and second-nearest seed (in tile units), id in [0,1)
 * identifies the nearest cell.
 */
function voronoi(u: number, v: number, n: number, seed: number) {
  const gx = u * n, gy = v * n, xi = Math.floor(gx), yi = Math.floor(gy);
  let d1 = 9, d2 = 9, id = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = xi + dx, cy = yi + dy;
      const wx = ((cx % n) + n) % n, wy = ((cy % n) + n) % n;
      const px = cx + 0.15 + hash(wx, wy, seed) * 0.7, py = cy + 0.15 + hash(wx, wy, seed + 1) * 0.7;
      const d = Math.hypot(gx - px, gy - py) / n;
      if (d < d1) { d2 = d1; d1 = d; id = hash(wx, wy, seed + 2); }
      else if (d < d2) d2 = d;
    }
  }
  return { d1, d2, id };
}

/* ------------------------------------------------------------- generation */
interface Field {
  size: number;
  rgb: Float32Array; // 0..1
  h: Float32Array; // height 0..1
  r: Float32Array; // roughness 0..1
}
function field(size: number): Field {
  return { size, rgb: new Float32Array(size * size * 3), h: new Float32Array(size * size), r: new Float32Array(size * size) };
}
const hex = (c: string): [number, number, number] => {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

function canvasOf(size: number) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  return c;
}

function toTextures(f: Field, normalStrength: number, aniso: number) {
  const { size } = f;
  const cCol = canvasOf(size), cRough = canvasOf(size), cNorm = canvasOf(size);
  const col = cCol.getContext("2d")!.createImageData(size, size);
  const rough = cRough.getContext("2d")!.createImageData(size, size);
  const norm = cNorm.getContext("2d")!.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x, o = i * 4;
      col.data[o] = Math.min(255, f.rgb[i * 3] * 255);
      col.data[o + 1] = Math.min(255, f.rgb[i * 3 + 1] * 255);
      col.data[o + 2] = Math.min(255, f.rgb[i * 3 + 2] * 255);
      col.data[o + 3] = 255;
      const rv = Math.max(0, Math.min(255, f.r[i] * 255));
      rough.data[o] = rough.data[o + 1] = rough.data[o + 2] = rv;
      rough.data[o + 3] = 255;
      // Sobel on the (wrapping) height field
      const hx = (xx: number, yy: number) => f.h[((yy + size) % size) * size + ((xx + size) % size)];
      const dx = (hx(x + 1, y - 1) + 2 * hx(x + 1, y) + hx(x + 1, y + 1) - hx(x - 1, y - 1) - 2 * hx(x - 1, y) - hx(x - 1, y + 1)) * normalStrength;
      const dy = (hx(x - 1, y + 1) + 2 * hx(x, y + 1) + hx(x + 1, y + 1) - hx(x - 1, y - 1) - 2 * hx(x, y - 1) - hx(x + 1, y - 1)) * normalStrength;
      const l = Math.hypot(dx, dy, 1);
      norm.data[o] = ((-dx / l) * 0.5 + 0.5) * 255;
      norm.data[o + 1] = ((dy / l) * 0.5 + 0.5) * 255;
      norm.data[o + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      norm.data[o + 3] = 255;
    }
  }
  cCol.getContext("2d")!.putImageData(col, 0, 0);
  cRough.getContext("2d")!.putImageData(rough, 0, 0);
  cNorm.getContext("2d")!.putImageData(norm, 0, 0);
  const mk = (c: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: mk(cCol, true), roughnessMap: mk(cRough, false), normalMap: mk(cNorm, false) };
}

type Painter = (f: Field, R: () => number) => void;
const each = (f: Field, fn: (u: number, v: number, i: number) => void) => {
  const s = f.size;
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) fn(x / s, y / s, y * s + x);
};
const setRGB = (f: Field, i: number, c: [number, number, number], k = 1) => {
  f.rgb[i * 3] = c[0] * k;
  f.rgb[i * 3 + 1] = c[1] * k;
  f.rgb[i * 3 + 2] = c[2] * k;
};
const mix = (a: [number, number, number], b: [number, number, number], t: number): [number, number, number] => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** distance (in texture units) to the nearest grid line of an n×m tile grid */
const gridDist = (u: number, v: number, nx: number, ny: number) => {
  const gx = u * nx, gy = v * ny;
  return Math.min(Math.abs(gx - Math.round(gx)) / nx, Math.abs(gy - Math.round(gy)) / ny);
};
/** sprinkle grain dots into the colour/height */
function speckle(f: Field, R: () => number, density: number, colors: [number, number, number][], rad: number, hDelta: number) {
  const s = f.size;
  const n = Math.floor(s * s * density);
  for (let k = 0; k < n; k++) {
    const cx = R() * s, cy = R() * s, r = rad * (0.5 + R());
    const c = colors[Math.floor(R() * colors.length)];
    const a = 0.45 + R() * 0.5;
    for (let y = Math.floor(cy - r); y <= cy + r; y++) {
      for (let x = Math.floor(cx - r); x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d > r) continue;
        const i = ((y + s) % s) * s + ((x + s) % s);
        const t = a * (1 - d / (r + 0.5));
        f.rgb[i * 3] += (c[0] - f.rgb[i * 3]) * t;
        f.rgb[i * 3 + 1] += (c[1] - f.rgb[i * 3 + 1]) * t;
        f.rgb[i * 3 + 2] += (c[2] - f.rgb[i * 3 + 2]) * t;
        f.h[i] += hDelta * t;
      }
    }
  }
}

/* -------------------------------------------------------------- painters */
const P: Record<string, { paint: Painter; normal: number; seed: number }> = {
  /** Painted render on concrete: off-white, very low-frequency tonal variation, fine trowel grain. */
  plaster: {
    seed: 11, normal: 1.4,
    paint: (f) => {
      const base = hex("#efebe2");
      each(f, (u, v, i) => {
        const lo = fbm(u, v, 3, 3, 11), fine = fbm(u, v, 64, 2, 12);
        setRGB(f, i, base, 0.965 + lo * 0.05 + (fine - 0.5) * 0.025);
        f.h[i] = fine * 0.5 + lo * 0.2;
        f.r[i] = 0.8 + (fine - 0.5) * 0.12;
      });
    },
  },
  /** Interior wall paint: smoother and warmer than the façade render. */
  paint: {
    seed: 13, normal: 0.5,
    paint: (f) => {
      const base = hex("#f3efe6");
      each(f, (u, v, i) => {
        const fine = fbm(u, v, 48, 2, 13), lo = fbm(u, v, 2, 2, 14);
        setRGB(f, i, base, 0.975 + lo * 0.03 + (fine - 0.5) * 0.012);
        f.h[i] = fine * 0.3;
        f.r[i] = 0.72 + (fine - 0.5) * 0.06;
      });
    },
  },
  /** Polished dark granite in 0.8 m tiles (2×2 per texture), as in the official corridor photos. */
  graniteDark: {
    seed: 21, normal: 3,
    paint: (f, R) => {
      const base = hex("#25292c");
      each(f, (u, v, i) => {
        const cloud = fbm(u, v, 6, 3, 21);
        setRGB(f, i, base, 0.85 + cloud * 0.3);
        f.h[i] = 0.5;
        f.r[i] = 0.1 + cloud * 0.05;
      });
      speckle(f, R, 0.05, [hex("#8a8f94"), hex("#c9ccd0"), hex("#101214"), hex("#5b6166")], 0.9, 0);
      each(f, (u, v, i) => {
        const g = gridDist(u, v, 2, 2) * f.size;
        if (g < 1.2) {
          setRGB(f, i, [f.rgb[i * 3], f.rgb[i * 3 + 1], f.rgb[i * 3 + 2]], 0.75);
          f.h[i] = 0.5 - (1.2 - g) * 0.25;
          f.r[i] = 0.45;
        }
      });
    },
  },
  /** Light granite paving / steps / porch: pale grey-beige, honed, 1.2 m grid (2×2). */
  stoneLight: {
    seed: 31, normal: 2.5,
    paint: (f, R) => {
      const base = hex("#d8d3c8");
      each(f, (u, v, i) => {
        const cloud = fbm(u, v, 5, 3, 31);
        setRGB(f, i, base, 0.93 + cloud * 0.1);
        f.h[i] = 0.5 + (fbm(u, v, 40, 2, 32) - 0.5) * 0.3;
        f.r[i] = 0.62 + cloud * 0.12;
      });
      speckle(f, R, 0.035, [hex("#9c978d"), hex("#f2efe8"), hex("#6f6a62")], 0.8, 0.05);
      each(f, (u, v, i) => {
        const g = gridDist(u, v, 2, 2) * f.size;
        if (g < 1.5) {
          setRGB(f, i, [f.rgb[i * 3], f.rgb[i * 3 + 1], f.rgb[i * 3 + 2]], 0.82);
          f.h[i] = 0.5 - (1.5 - g) * 0.3;
          f.r[i] = 0.85;
        }
      });
    },
  },
  /** Credentials Room carpet: golden-yellow wool pile (official photo). */
  carpetGold: {
    seed: 41, normal: 1.2,
    paint: (f) => {
      const a = hex("#b97f26"), b = hex("#d39d3e"); // Trình Quốc thư carpet, DDLP_0021/0123
      each(f, (u, v, i) => {
        const pile = fbm(u, v, 96, 2, 41), lo = fbm(u, v, 4, 3, 42);
        setRGB(f, i, mix(a, b, lo), 0.92 + pile * 0.16);
        f.h[i] = pile;
        f.r[i] = 0.95;
      });
    },
  },
  /** Cabinet Room carpet: sea-green with a lighter interlocking brick weave (DDLP_0017, 0019, 0098). */
  carpetGreen: {
    seed: 51, normal: 1.4,
    paint: (f) => {
      const a = hex("#4f7e5e"), b = hex("#8fb39a");
      each(f, (u, v, i) => {
        const pile = fbm(u, v, 96, 2, 51);
        // herringbone: zig-zag stripes, 8 columns × 16 rows per tile
        const col = Math.floor(u * 8);
        const local = (u * 8 - col) * (col % 2 ? -1 : 1);
        const stripe = ((v * 16 + local * 2) % 1 + 1) % 1;
        const t = stripe < 0.28 ? 0.55 : 0;
        setRGB(f, i, mix(a, b, t), 0.9 + pile * 0.18);
        f.h[i] = pile * 0.7 + t * 0.4;
        f.r[i] = 0.96;
      });
    },
  },
  /** Heavy velvet curtain, red (Credentials Room). Vertical folds in colour + height. */
  curtainRed: {
    seed: 61, normal: 4,
    paint: (f) => {
      const base = hex("#b3161b");
      each(f, (u, v, i) => {
        const fold = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 6 + Math.sin(u * Math.PI * 4) * 0.8);
        const nap = fbm(u, v, 64, 2, 61);
        setRGB(f, i, base, 0.62 + fold * 0.45 + (nap - 0.5) * 0.06);
        f.h[i] = fold;
        f.r[i] = 0.82 - fold * 0.12;
      });
    },
  },
  /** Lime-olive curtain (Cabinet Room, DDLP_0001, 0017, 0019). */
  curtainGreen: {
    seed: 71, normal: 4,
    paint: (f) => {
      const base = hex("#9aa23e");
      each(f, (u, v, i) => {
        const fold = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 6 + Math.sin(u * Math.PI * 4) * 0.8);
        // damask-like lozenges, very subtle
        const dm = Math.abs(Math.sin(u * Math.PI * 24) * Math.sin(v * Math.PI * 16));
        setRGB(f, i, base, 0.6 + fold * 0.45 + (dm > 0.7 ? 0.05 : 0));
        f.h[i] = fold;
        f.r[i] = 0.8 - fold * 0.1;
      });
    },
  },
  /** Warm wood with straight grain (doors, frames, table tops). */
  wood: {
    seed: 81, normal: 1.6,
    paint: (f) => {
      const a = hex("#6b4226"), b = hex("#8c5a35");
      each(f, (u, v, i) => {
        const warp = fbm(u, v, 4, 2, 81) * 0.6;
        const grain = 0.5 + 0.5 * Math.sin((u * 26 + warp * 3) * Math.PI * 2);
        const fine = fbm(u * 1, v, 128, 2, 82);
        setRGB(f, i, mix(a, b, grain * 0.7 + fine * 0.3));
        f.h[i] = grain * 0.6 + fine * 0.4;
        f.r[i] = 0.42 + grain * 0.12;
      });
    },
  },
  /** Dark lacquer with mottled eggshell-like inlay (furniture bases, Credentials Room). */
  lacquer: {
    seed: 91, normal: 1,
    paint: (f) => {
      const a = hex("#2e140c"), b = hex("#7d4a22");
      each(f, (u, v, i) => {
        const cells = fbm(u, v, 18, 2, 91);
        const t = cells > 0.62 ? 0.65 : cells > 0.55 ? 0.25 : 0;
        setRGB(f, i, mix(a, b, t));
        f.h[i] = 0.5 + t * 0.15;
        f.r[i] = 0.22 + t * 0.15;
      });
    },
  },
  /** Gold-brown lacquer wall panels in square frames (left wall of the Credentials Room). */
  lacquerPanel: {
    seed: 95, normal: 2,
    paint: (f) => {
      const a = hex("#5b3a1a"), b = hex("#a9792f");
      each(f, (u, v, i) => {
        const mott = fbm(u, v, 10, 4, 95);
        const g = gridDist(u, v, 2, 2) * f.size;
        const frame = g < f.size * 0.012;
        setRGB(f, i, frame ? hex("#2a160b") : mix(a, b, mott));
        f.h[i] = frame ? 0.3 : 0.5 + mott * 0.1;
        f.r[i] = frame ? 0.5 : 0.3;
      });
    },
  },
  /** Lawn / ground grass: varied greens, fine blade noise. */
  grass: {
    seed: 101, normal: 2.2,
    paint: (f) => {
      const a = hex("#4e8a37"), b = hex("#78b04f"), c = hex("#8fb85a");
      each(f, (u, v, i) => {
        const patch = fbm(u, v, 4, 3, 101), blade = fbm(u, v, 128, 2, 102);
        const col = mix(mix(a, b, patch), c, Math.max(0, patch - 0.65) * 1.5);
        setRGB(f, i, col, 0.86 + blade * 0.24);
        f.h[i] = blade;
        f.r[i] = 0.92;
      });
    },
  },
  /** Asphalt of the ring drive (photo: dark grey with light curbs). */
  asphalt: {
    seed: 111, normal: 2,
    paint: (f, R) => {
      const base = hex("#5a5e63");
      each(f, (u, v, i) => {
        const lo = fbm(u, v, 5, 3, 111), fine = fbm(u, v, 96, 2, 112);
        setRGB(f, i, base, 0.88 + lo * 0.12 + (fine - 0.5) * 0.1);
        f.h[i] = fine;
        f.r[i] = 0.88;
      });
      speckle(f, R, 0.02, [hex("#8d9196"), hex("#3c3f43")], 0.7, 0.1);
    },
  },
  /** Flat-roof finish: light concrete tiles, 0.6 m grid (4×4). */
  roofTile: {
    seed: 121, normal: 2,
    paint: (f) => {
      const base = hex("#c9c5bb");
      each(f, (u, v, i) => {
        const lo = fbm(u, v, 6, 3, 121), fine = fbm(u, v, 64, 2, 122);
        const g = gridDist(u, v, 4, 4) * f.size;
        setRGB(f, i, base, (g < 1.2 ? 0.8 : 0.94) + lo * 0.08 + (fine - 0.5) * 0.04);
        f.h[i] = g < 1.2 ? 0.2 : 0.5 + fine * 0.1;
        f.r[i] = 0.86;
      });
    },
  },
  /** Bare concrete (basement). */
  concrete: {
    seed: 131, normal: 1.5,
    paint: (f) => {
      const base = hex("#a8a59c");
      each(f, (u, v, i) => {
        const lo = fbm(u, v, 4, 4, 131), fine = fbm(u, v, 80, 2, 132);
        setRGB(f, i, base, 0.88 + lo * 0.16 + (fine - 0.5) * 0.05);
        f.h[i] = fine * 0.6 + lo * 0.4;
        f.r[i] = 0.9;
      });
    },
  },
  /** Upper-floor glazing seen from outside: dark green-grey frames, 1.2 m × 1.25 m panes (4×4 per 4.8 m tile). */
  windows: {
    seed: 141, normal: 1.5,
    paint: (f) => {
      const frame = hex("#3b4a47"), glass = hex("#2d3a44"), sky = hex("#7d93a3");
      each(f, (u, v, i) => {
        const g = gridDist(u, v, 4, 4);
        const isFrame = g < 0.012;
        // a soft vertical reflection gradient inside each pane
        const pv = (v * 4) % 1;
        const refl = 0.35 * (1 - pv) + 0.15 * fbm(u, v, 4, 2, 141);
        setRGB(f, i, isFrame ? frame : mix(glass, sky, refl));
        f.h[i] = isFrame ? 0.9 : 0.4;
        f.r[i] = isFrame ? 0.5 : 0.08;
      });
    },
  },
  /* ---- rooms re-modelled from the reference photo set (DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1) ----
   * Colours are taken from the photos (median samples) and corrected for their
   * warm tungsten cast; patterns follow what the photos show, drawn
   * procedurally (no photo is pasted onto a surface). */
  /** Khánh tiết: deep red wool carpet with cream medallions and scattered flower sprays (DDLP_0240, 0079, 0108). */
  carpetRedFloral: {
    seed: 201, normal: 1.4,
    paint: (f) => {
      const red = hex("#8a1012"), red2 = hex("#a3191b"), cream = hex("#d9c08a");
      each(f, (u, v, i) => {
        const pile = fbm(u, v, 96, 2, 201), lo = fbm(u, v, 3, 2, 202);
        // 2×2 medallions per tile: a ring with a square meander inside
        const cu = (u * 2) % 1 - 0.5, cv = (v * 2) % 1 - 0.5;
        const r = Math.hypot(cu, cv);
        const ring = Math.abs(r - 0.36) < 0.012 || Math.abs(r - 0.33) < 0.006;
        const sq = Math.max(Math.abs(cu), Math.abs(cv));
        const meander = r < 0.16 && (Math.abs(sq - 0.12) < 0.012 || (Math.abs(sq - 0.07) < 0.01 && (Math.floor((cu + cv) * 40) % 2 === 0)));
        // flower sprays between the medallions: thresholded noise clusters
        const ou = (u * 2 + 0.5) % 1 - 0.5, ov = (v * 2 + 0.5) % 1 - 0.5;
        const spray = Math.hypot(ou, ov) < 0.22 && fbm(u, v, 40, 3, 203) > 0.6;
        const motif = ring || meander || spray;
        setRGB(f, i, motif ? cream : mix(red, red2, lo), 0.9 + pile * 0.18);
        f.h[i] = pile * 0.6 + (motif ? 0.35 : 0);
        f.r[i] = 0.96;
      });
    },
  },
  /** Đại yến: plain mustard-gold wool carpet (DDLP_0018, 0118, 0141). */
  carpetMustard: {
    seed: 211, normal: 1.1,
    paint: (f) => {
      const a = hex("#a8860f"), b = hex("#c4a12a");
      each(f, (u, v, i) => {
        const pile = fbm(u, v, 110, 2, 211), lo = fbm(u, v, 3, 3, 212);
        setRGB(f, i, mix(a, b, lo), 0.92 + pile * 0.14);
        f.h[i] = pile;
        f.r[i] = 0.97;
      });
    },
  },
  /** Pale gold damask curtain with deep folds (Đại yến, Trình Quốc thư, Khánh tiết windows). */
  curtainGold: {
    seed: 221, normal: 4,
    paint: (f) => {
      const base = hex("#d7b56a"), motif = hex("#eacf8c");
      each(f, (u, v, i) => {
        const fold = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 6 + Math.sin(u * Math.PI * 4) * 0.8);
        // damask: interlocking ogee lozenges
        const du = (u * 10) % 1 - 0.5, dv = (v * 6) % 1 - 0.5;
        const ogee = Math.abs(Math.abs(du) * 1.6 + Math.abs(dv) - 0.42) < 0.05 || Math.hypot(du, dv) < 0.08;
        setRGB(f, i, ogee ? motif : base, 0.66 + fold * 0.38);
        f.h[i] = fold + (ogee ? 0.04 : 0);
        f.r[i] = 0.7 - fold * 0.1 - (ogee ? 0.12 : 0);
      });
    },
  },
  /** Dark red-brown wood with vertical reeding: Khánh tiết pilasters and wall bands (DDLP_0240). */
  woodReeded: {
    seed: 231, normal: 3,
    paint: (f) => {
      const a = hex("#2c160b"), b = hex("#4a2714");
      each(f, (u, v, i) => {
        const reed = 0.5 + 0.5 * Math.cos(u * Math.PI * 2 * 16);
        const grain = fbm(u * 0.3, v, 48, 3, 231);
        setRGB(f, i, mix(a, b, grain * 0.7 + reed * 0.3));
        f.h[i] = reed * 0.8 + grain * 0.2;
        f.r[i] = 0.35 + (1 - reed) * 0.1;
      });
    },
  },
  /** Basement wall boarding: red-brown vertical planks (map room, telecom room; DDLP_0132, 0146). */
  woodPlank: {
    seed: 241, normal: 2,
    paint: (f) => {
      const a = hex("#6a2f20"), b = hex("#8a4430");
      each(f, (u, v, i) => {
        const col = Math.floor(u * 8);
        const seam = Math.abs((u * 8) % 1 - 0.5) > 0.485;
        const grain = fbm(u * 0.25 + col * 0.37, v, 40, 3, 241 + col);
        setRGB(f, i, seam ? hex("#2a120b") : mix(a, b, grain), seam ? 1 : 0.95 + hash(col, 0, 9) * 0.1);
        f.h[i] = seam ? 0.2 : 0.55 + grain * 0.1;
        f.r[i] = seam ? 0.8 : 0.5;
      });
    },
  },
  /** Red-and-gold damask upholstery (Khánh tiết sofas, DDLP_0240, 0105). */
  damaskRed: {
    seed: 251, normal: 1.6,
    paint: (f) => {
      const red = hex("#6e1813"), gold = hex("#c49a4f");
      each(f, (u, v, i) => {
        const du = (u * 6) % 1 - 0.5, dv = (v * 6) % 1 - 0.5;
        const leaf = Math.abs(Math.abs(du) * 1.3 + Math.abs(dv) - 0.3) < 0.07 || (Math.hypot(du, dv) < 0.12 && fbm(u, v, 30, 2, 252) > 0.45);
        const nap = fbm(u, v, 80, 2, 251);
        setRGB(f, i, leaf ? gold : red, 0.9 + nap * 0.15);
        f.h[i] = nap * 0.5 + (leaf ? 0.4 : 0);
        f.r[i] = leaf ? 0.55 : 0.85;
      });
    },
  },
  /** Burl-veneer lacquer of the Trình Quốc thư furniture: honey brown with dark eyes (DDLP_0123). */
  burl: {
    seed: 261, normal: 1,
    paint: (f) => {
      const a = hex("#5a2d12"), b = hex("#b07a3c"), eye = hex("#2a1307");
      each(f, (u, v, i) => {
        const w = fbm(u, v, 6, 4, 261), e = fbm(u, v, 22, 2, 262);
        setRGB(f, i, e > 0.7 ? eye : mix(a, b, w));
        f.h[i] = 0.5 + w * 0.1;
        f.r[i] = 0.2 + w * 0.08;
      });
    },
  },
  /** Acoustic ceiling tiles, 0.6 m grid with pinholes (basement ceilings, DDLP_0128, 0132). */
  ceilingTile: {
    seed: 271, normal: 1.2,
    paint: (f, R) => {
      const base = hex("#e9e7e0");
      each(f, (u, v, i) => {
        const g = gridDist(u, v, 4, 4);
        setRGB(f, i, g < 0.004 ? hex("#b9b7b0") : base, 0.97 + fbm(u, v, 32, 2, 271) * 0.05);
        f.h[i] = g < 0.004 ? 0.2 : 0.6;
        f.r[i] = 0.92;
      });
      speckle(f, R, 0.004, [hex("#8a8880")], 0.7, -0.3);
    },
  },
  /** Basement floor: light grey-blue vinyl tiles, 0.3 m (map room, DDLP_0128, 0132). */
  tileGrey: {
    seed: 281, normal: 1,
    paint: (f) => {
      const a = hex("#aeb8bd"), b = hex("#c3ccd0");
      each(f, (u, v, i) => {
        const g = gridDist(u, v, 8, 8);
        const cell = hash(Math.floor(u * 8), Math.floor(v * 8), 281);
        setRGB(f, i, g < 0.0025 ? hex("#8d979c") : mix(a, b, cell * 0.6 + fbm(u, v, 24, 2, 282) * 0.4));
        f.h[i] = g < 0.0025 ? 0.3 : 0.5;
        f.r[i] = g < 0.0025 ? 0.7 : 0.35;
      });
    },
  },
  /** Telecom room floor: white tiles with a black cross motif, 0.3 m (DDLP_0107, 0146, 0226). */
  tileCross: {
    seed: 291, normal: 1,
    paint: (f) => {
      const white = hex("#e6e4de"), black = hex("#262626");
      each(f, (u, v, i) => {
        const tu = (u * 8) % 1 - 0.5, tv = (v * 8) % 1 - 0.5;
        // a four-armed cross centred on each tile corner
        const cu = Math.abs(Math.abs(tu) - 0.5), cv = Math.abs(Math.abs(tv) - 0.5);
        const cross = (cu < 0.05 && cv < 0.2) || (cv < 0.05 && cu < 0.2) || Math.hypot(cu, cv) < 0.09;
        const g = gridDist(u, v, 8, 8) < 0.002;
        setRGB(f, i, cross ? black : g ? hex("#bdbab2") : white);
        f.h[i] = g ? 0.3 : 0.5;
        f.r[i] = 0.3;
      });
    },
  },
  /** Generic old wall map on paper (the maps in the photos are not reproduced). */
  mapPaper: {
    seed: 301, normal: 0.6,
    paint: (f) => {
      const paper = hex("#d8c99a"), land = hex("#c3b07a"), sea = hex("#9cb3a8"), line = hex("#6d5a3a");
      each(f, (u, v, i) => {
        const e = fbm(u, v, 3, 5, 301);
        const contour = Math.abs((e * 12) % 1 - 0.5) > 0.47;
        const g = gridDist(u, v, 6, 4) < 0.0015;
        const c = e < 0.45 ? sea : mix(paper, land, (e - 0.45) * 2);
        setRGB(f, i, contour || g ? line : c, 0.95 + fbm(u, v, 64, 2, 302) * 0.08);
        f.h[i] = 0.5;
        f.r[i] = 0.85;
      });
    },
  },
  /* ---- exterior, roof, courtyard and floor-2 rooms (reference groups 01–06, 11–14) ---- */
  /** Split-stone (đá chẻ) cladding of the plinth and ground storey: irregular dark grey-brown stones, deep joints (DDLP_0073, 0287, 0153). */
  stoneRubble: {
    seed: 311, normal: 4,
    paint: (f) => {
      const pal = ["#4a4640", "#5b5249", "#3d3a35", "#6a5a48", "#57524a", "#73634f", "#4f4a42"].map(hex);
      const mortar = hex("#2f2d2a");
      each(f, (u, v, i) => {
        const c = voronoi(u, v, 7, 311);
        const joint = c.d2 - c.d1;
        const tone = pal[Math.floor(c.id * pal.length)];
        const face = fbm(u, v, 24, 3, 312);
        if (joint < 0.022) {
          setRGB(f, i, mortar, 0.9 + face * 0.2);
          f.h[i] = 0.15 + joint * 6;
          f.r[i] = 0.95;
        } else {
          // split faces: a slight dome per stone plus coarse facets
          setRGB(f, i, tone, 0.82 + face * 0.32 + (c.id - 0.5) * 0.1);
          f.h[i] = 0.55 + Math.min(joint, 0.08) * 3 + (face - 0.5) * 0.35;
          f.r[i] = 0.82 + face * 0.12;
        }
      });
    },
  },
  /** Carved relief panel of the end bays (DDLP_0191): cream stone, symmetric cloud scrolls in a raised frame. One panel per texture (not tiled). */
  relief: {
    seed: 321, normal: 5,
    paint: (f) => {
      const stone = hex("#d6cfbf"), shade = hex("#9d9585");
      each(f, (u, v, i) => {
        const x = Math.abs(u - 0.5) * 2, y = Math.abs(v - 0.5) * 2; // mirrored both ways
        const border = Math.max(x, y);
        let h: number;
        if (border > 0.9) h = 0.85; // raised frame
        else if (border > 0.84) h = 0.2; // sunk margin
        else {
          // scrolls: spirals around four mirrored centres + a central medallion
          const sp = (cx: number, cy: number) => {
            const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy), a = Math.atan2(dy, dx);
            return Math.sin(r * 38 - a * 2) * Math.exp(-r * 4.5);
          };
          const med = Math.hypot(x, y * 1.2) < 0.22 ? 0.5 + 0.3 * Math.cos(Math.hypot(x, y) * 60) : 0;
          const s = sp(0.5, 0.45) + sp(0.2, 0.7) * 0.8 + sp(0.75, 0.15) * 0.6;
          h = Math.max(0.25, Math.min(0.95, 0.4 + s * 0.6 + med));
        }
        const grain = fbm(u, v, 48, 2, 321);
        f.h[i] = h + (grain - 0.5) * 0.05;
        setRGB(f, i, mix(shade, stone, Math.min(1, 0.35 + h * 0.75)), 0.96 + grain * 0.06);
        f.r[i] = 0.85;
      });
    },
  },
  /** Roof terrace / helipad pavers: grey-beige 0.5 m concrete slabs, weathered (DDLP_0106, 0246). */
  roofPaver: {
    seed: 331, normal: 2,
    paint: (f) => {
      const base = hex("#aaa396"), dark = hex("#7f796d");
      each(f, (u, v, i) => {
        const tx = Math.floor(u * 4), ty = Math.floor(v * 4);
        const t = hash(tx, ty, 331);
        const stain = fbm(u, v, 6, 3, 332);
        const g = gridDist(u, v, 4, 4) * f.size;
        setRGB(f, i, mix(base, dark, stain * 0.45 + t * 0.15), 0.94 + fbm(u, v, 90, 2, 333) * 0.1);
        f.h[i] = g < 2 ? 0.25 : 0.55 + (fbm(u, v, 50, 2, 334) - 0.5) * 0.2;
        f.r[i] = g < 2 ? 0.95 : 0.8;
        if (g < 2) setRGB(f, i, hex("#6d685e"));
      });
    },
  },
  /** Courtyard pond lining: small glass mosaic in mixed blues with light grout (DDLP_0039, 0171). */
  mosaicBlue: {
    seed: 341, normal: 1.6,
    paint: (f) => {
      const pal = ["#6f9fcf", "#5b8cc0", "#8db7de", "#4d79ad", "#a9c9e6", "#6aa3b8"].map(hex);
      each(f, (u, v, i) => {
        const n = 32, tx = Math.floor(u * n), ty = Math.floor(v * n);
        const g = gridDist(u, v, n, n) * n;
        setRGB(f, i, g < 0.09 ? hex("#d9dfe2") : pal[Math.floor(hash(tx, ty, 341) * pal.length)], 0.95 + fbm(u, v, 40, 2, 342) * 0.08);
        f.h[i] = g < 0.09 ? 0.3 : 0.6;
        f.r[i] = g < 0.09 ? 0.8 : 0.12;
      });
    },
  },
  /** Irregular slate flagging of the courtyard walks (DDLP_0039): brown-grey-purple stones, dark joints. */
  slate: {
    seed: 351, normal: 2.5,
    paint: (f) => {
      const pal = ["#6b5a50", "#7d6a5a", "#5a5250", "#857262", "#6e6460", "#8a7a6a"].map(hex);
      each(f, (u, v, i) => {
        const c = voronoi(u, v, 5, 351);
        const joint = c.d2 - c.d1 < 0.018;
        const face = fbm(u, v, 30, 3, 352);
        setRGB(f, i, joint ? hex("#3a3632") : pal[Math.floor(c.id * pal.length)], 0.86 + face * 0.25);
        f.h[i] = joint ? 0.2 : 0.55 + (face - 0.5) * 0.2;
        f.r[i] = joint ? 0.95 : 0.6 + face * 0.2;
      });
    },
  },
  /** Gold-yellow silk damask with round medallions (sofas of the President's reception room, DDLP_0015, 0081, 0297). */
  damaskYellow: {
    seed: 361, normal: 1.2,
    paint: (f) => {
      const ground = hex("#d7b75e"), motif = hex("#b8913c"), hi = hex("#efd890");
      each(f, (u, v, i) => {
        const n = 5, cu = (u * n) % 1 - 0.5, cv = (v * n) % 1 - 0.5;
        const r = Math.hypot(cu, cv);
        const ring = Math.abs(r - 0.32) < 0.035;
        const inner = r < 0.24 && Math.abs(Math.sin(Math.atan2(cv, cu) * 4) * 0.18 - r * 0.5) < 0.05;
        const sheen = fbm(u, v, 6, 2, 362);
        const c = ring || inner ? motif : mix(ground, hi, sheen * 0.35);
        setRGB(f, i, c, 0.95 + fbm(u, v, 120, 1, 363) * 0.06);
        f.h[i] = ring || inner ? 0.62 : 0.5;
        f.r[i] = ring || inner ? 0.55 : 0.4;
      });
    },
  },
  /** Red brocade with cream roundels (carved armchairs, DDLP_0003, 0286). */
  damaskRoundel: {
    seed: 371, normal: 1.2,
    paint: (f) => {
      const red = hex("#a5141f"), cream = hex("#e3d3b4");
      each(f, (u, v, i) => {
        const n = 6, row = Math.floor(v * n), cu = ((u * n + (row % 2) * 0.5) % 1) - 0.5, cv = (v * n) % 1 - 0.5;
        const r = Math.hypot(cu, cv);
        const disc = r < 0.3 && !(Math.abs(r - 0.2) < 0.03) && !(r < 0.1 && Math.abs(cu) > 0.04);
        setRGB(f, i, disc ? cream : red, 0.92 + fbm(u, v, 100, 1, 372) * 0.1);
        f.h[i] = disc ? 0.6 : 0.5;
        f.r[i] = disc ? 0.6 : 0.5;
      });
    },
  },
  /** Plain wool carpets: deep maroon (DDLP_0044, 0076) and bright red (DDLP_0015, 0122), set by material colour. */
  carpetPlain: {
    seed: 381, normal: 1.1,
    paint: (f) => {
      each(f, (u, v, i) => {
        const nap = fbm(u, v, 160, 2, 381), lo = fbm(u, v, 5, 2, 382);
        setRGB(f, i, [1, 1, 1], 0.86 + nap * 0.12 + lo * 0.06);
        f.h[i] = nap;
        f.r[i] = 0.95;
      });
    },
  },
  /** Vertical tongue-and-groove boarding of the telecom rooms, rust-brown paint (DDLP_0129, 0146, 0225). */
  boardsRust: {
    seed: 391, normal: 2.2,
    paint: (f) => {
      const base = hex("#8a3c26");
      each(f, (u, v, i) => {
        const n = 12, gu = (u * n) % 1;
        const groove = gu < 0.035;
        const grain = fbm(u * 0.3, v * 3, 20, 3, 391);
        setRGB(f, i, base, groove ? 0.55 : 0.9 + grain * 0.16);
        f.h[i] = groove ? 0.15 : 0.55 + Math.sin(gu * Math.PI) * 0.1;
        f.r[i] = groove ? 0.8 : 0.45;
      });
    },
  },
  /** Pink-grey granite cladding of the courtyard's ground-floor columns (DDLP_0039, 0171). */
  granitePink: {
    seed: 401, normal: 1.2,
    paint: (f, R) => {
      const base = hex("#b4a29a");
      each(f, (u, v, i) => {
        const cloud = fbm(u, v, 5, 3, 401);
        setRGB(f, i, base, 0.9 + cloud * 0.14);
        f.h[i] = 0.5;
        f.r[i] = 0.3;
      });
      speckle(f, R, 0.06, [hex("#6e625c"), hex("#d9cbc2"), hex("#3c3633"), hex("#9a7f74")], 0.8, 0);
    },
  },
  /** Three-tone camouflage of the helicopter on the roof (DDLP_0106, 0246): tan, olive, brown blotches. */
  camo: {
    seed: 411, normal: 0.6,
    paint: (f) => {
      const tan = hex("#b39a6a"), olive = hex("#6b6a3e"), brown = hex("#5e4a33");
      each(f, (u, v, i) => {
        const a = fbm(u, v, 3, 3, 411), b = fbm(u, v, 4, 3, 412);
        setRGB(f, i, a > 0.55 ? olive : b > 0.56 ? brown : tan, 0.95 + fbm(u, v, 60, 2, 413) * 0.08);
        f.h[i] = 0.5;
        f.r[i] = 0.7;
      });
    },
  },
  /** Tileable ripples for water normals. */
  water: {
    seed: 151, normal: 2.5,
    paint: (f) => {
      const base = hex("#3d7f8f");
      each(f, (u, v, i) => {
        const w = fbm(u, v, 8, 4, 151);
        setRGB(f, i, base, 0.9 + w * 0.15);
        f.h[i] = w;
        f.r[i] = 0.05;
      });
    },
  },
};

export type TexName = keyof typeof P;
export type TexSet = ReturnType<typeof toTextures>;

const cache = new Map<string, TexSet>();

/** Texture set for `name`, generated on first use and cached per size. */
export function palaceTexture(name: TexName, quality: TexQuality, aniso = 4): TexSet {
  const size = quality === "high" ? 1024 : quality === "medium" ? 512 : 256;
  const key = `${name}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const def = P[name];
  const f = field(size);
  def.paint(f, rng(def.seed));
  const set = toTextures(f, def.normal * (size / 512), aniso);
  cache.set(key, set);
  return set;
}

/** Free every cached texture (when the palace scene unmounts). */
export function disposePalaceTextures() {
  for (const s of cache.values()) Object.values(s).forEach((t) => t.dispose());
  cache.clear();
}

/**
 * World-space planar UVs: each face takes the two world axes it is most
 * aligned with, scaled to `metresPerTile`. Works for instanced and plain
 * meshes and keeps texel density uniform regardless of the box size.
 */
export function worldUV<T extends THREE.Material>(mat: T, metresPerTile: number): T {
  const scale = { value: 1 / metresPerTile };
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWorldUvScale = scale;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uWorldUvScale;")
      .replace(
        "#include <uv_vertex>",
        `vec4 wuvP = vec4(position, 1.0);
vec3 wuvN = normal;
#ifdef USE_INSTANCING
wuvP = instanceMatrix * wuvP;
wuvN = mat3(instanceMatrix) * wuvN;
#endif
wuvP = modelMatrix * wuvP;
wuvN = normalize(mat3(modelMatrix) * wuvN);
vec3 wuvA = abs(wuvN);
vec2 wuv = wuvA.y >= max(wuvA.x, wuvA.z) ? wuvP.xz
  : (wuvA.x >= wuvA.z ? vec2(-wuvP.z * sign(wuvN.x), -wuvP.y) : vec2(wuvP.x * sign(wuvN.z), -wuvP.y));
wuv *= uWorldUvScale;
#undef MAP_UV
#define MAP_UV wuv
#undef NORMALMAP_UV
#define NORMALMAP_UV wuv
#undef ROUGHNESSMAP_UV
#define ROUGHNESSMAP_UV wuv
#undef EMISSIVEMAP_UV
#define EMISSIVEMAP_UV wuv
#include <uv_vertex>`,
      );
  };
  mat.customProgramCacheKey = () => "palace-world-uv";
  return mat;
}
