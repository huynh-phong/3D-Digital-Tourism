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
      const a = hex("#d99b2b"), b = hex("#e9b548");
      each(f, (u, v, i) => {
        const pile = fbm(u, v, 96, 2, 41), lo = fbm(u, v, 4, 3, 42);
        setRGB(f, i, mix(a, b, lo), 0.92 + pile * 0.16);
        f.h[i] = pile;
        f.r[i] = 0.95;
      });
    },
  },
  /** Cabinet Room carpet: green with a lighter herringbone weave (official photo). */
  carpetGreen: {
    seed: 51, normal: 1.4,
    paint: (f) => {
      const a = hex("#2f9a3e"), b = hex("#6cc56a");
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
  /** Patterned velvet curtain, olive green (Cabinet Room). */
  curtainGreen: {
    seed: 71, normal: 4,
    paint: (f) => {
      const base = hex("#7a9a1f");
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
