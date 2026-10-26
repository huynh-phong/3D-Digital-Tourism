import * as THREE from "three";
import { rng } from "@/lib/geo";
import { FACADE_STYLES, type FacadeStyle, type RoofStyle } from "./architecture";

/**
 * Procedural facade textures (no external assets, no alpha — fully opaque).
 * Each style has three canvases with the same layout of 4×4 bays:
 *   map      — albedo; wall areas are white so they take the building colour
 *   tint     — white where the vertex colour applies (walls), black where it
 *              doesn't (glass, shutters, signs keep their own colours)
 *   emissive — lit windows for night mode
 * Every tile keeps a plain band at the top (v 0.88–1) and bottom (v 0–0.08).
 */
const CELL = 128;
const N = 4;
const SIZE = CELL * N;

type Ctx = CanvasRenderingContext2D;
interface Layers { a: Ctx; t: Ctx; e: Ctx }

function canvas(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement("canvas");
  c.width = c.height = SIZE;
  return [c, c.getContext("2d")!];
}

const GLASS = ["#6f9fba", "#7fb0c8", "#5f8fa8", "#86b5c9"];
const SHUTTER = ["#3f7f6f", "#2f6f9f", "#8a5a3a", "#5f8e4e", "#2e7f8f", "#b5583d"];
const SIGN = ["#e63946", "#1d7fd1", "#f4b400", "#2a9d8f", "#ff7f11", "#7b2cbf", "#d62f6b"];

function glass(L: Layers, x: number, y: number, w: number, h: number, R: () => number, litP = 0.35) {
  const g = L.a.createLinearGradient(x, y, x + w, y + h);
  const base = GLASS[Math.floor(R() * GLASS.length)];
  g.addColorStop(0, "#d9eef7");
  g.addColorStop(0.35, base);
  g.addColorStop(1, "#4b6f84");
  L.a.fillStyle = g;
  L.a.fillRect(x, y, w, h);
  L.t.fillStyle = "#000";
  L.t.fillRect(x, y, w, h);
  if (R() < litP) {
    L.e.fillStyle = R() < 0.7 ? "#ffcf7a" : "#fff0c8";
    L.e.fillRect(x + 1, y + 1, w - 2, h - 2);
  }
}

function solid(L: Layers, x: number, y: number, w: number, h: number, color: string, tinted = false) {
  L.a.fillStyle = color;
  L.a.fillRect(x, y, w, h);
  L.t.fillStyle = tinted ? "#fff" : "#000";
  L.t.fillRect(x, y, w, h);
}

/** Wall shading drawn in the albedo while staying tinted (darker = shaded wall). */
function wallShade(L: Layers, x: number, y: number, w: number, h: number, gray: string) {
  L.a.fillStyle = gray;
  L.a.fillRect(x, y, w, h);
}

const DRAW: Record<FacadeStyle, (L: Layers, x: number, y: number, R: () => number) => void> = {
  shop(L, x, y, R) {
    wallShade(L, x, y + CELL - 10, CELL, 10, "#e4e1dc"); // floor band
    const sh = SHUTTER[Math.floor(R() * SHUTTER.length)];
    glass(L, x + 34, y + 22, 60, 82, R);
    solid(L, x + 30, y + 18, 68, 4, "#f4f1ea"); // lintel
    if (R() < 0.75) {
      solid(L, x + 14, y + 22, 18, 82, sh);
      solid(L, x + 96, y + 22, 18, 82, sh);
      for (let k = 0; k < 8; k++) {
        solid(L, x + 14, y + 26 + k * 10, 18, 2, "rgba(0,0,0,0.25)");
        solid(L, x + 96, y + 26 + k * 10, 18, 2, "rgba(0,0,0,0.25)");
      }
    }
    // wrought-iron balcony rail across the lower part of the door
    for (let k = 0; k < 3; k++) solid(L, x + 30, y + 80 + k * 9, 68, 2, "#2f3338");
    for (let k = 0; k < 9; k++) solid(L, x + 32 + k * 8, y + 80, 2, 22, "#2f3338");
  },
  shopfront(L, x, y, R) {
    // sign band
    const sc = SIGN[Math.floor(R() * SIGN.length)];
    solid(L, x + 4, y + 10, CELL - 8, 24, sc);
    for (let k = 0; k < 3 + Math.floor(R() * 3); k++) solid(L, x + 14 + k * 20, y + 18, 14, 8, "#ffffff");
    // shop opening: open shop with goods, or a rolling shutter
    if (R() < 0.65) {
      solid(L, x + 8, y + 40, CELL - 16, 82, "#3c3934");
      const goods = ["#f2b630", "#e8453c", "#2f7fd1", "#2fa36b", "#ffffff", "#f39c8a"];
      for (let k = 0; k < 10; k++) solid(L, x + 12 + R() * (CELL - 36), y + 60 + R() * 50, 8 + R() * 12, 6 + R() * 10, goods[Math.floor(R() * goods.length)]);
      L.e.fillStyle = "#ffe2a8";
      L.e.fillRect(x + 8, y + 40, CELL - 16, 82);
    } else {
      solid(L, x + 8, y + 40, CELL - 16, 82, "#a5abb2");
      for (let k = 0; k < 16; k++) solid(L, x + 8, y + 42 + k * 5, CELL - 16, 1.5, "#7f868e");
    }
    solid(L, x, y + 36, CELL, 4, "#f4f1ea");
  },
  apartment(L, x, y, R) {
    wallShade(L, x, y + CELL - 9, CELL, 9, "#dcd8d2"); // slab edge
    solid(L, x + 26, y + 26, 76, 64, "#fafafa");
    glass(L, x + 30, y + 30, 68, 56, R);
    solid(L, x + 63, y + 30, 3, 56, "#fafafa");
    if (R() < 0.6) {
      solid(L, x + 70, y + 94, 30, 18, "#ececec");
      solid(L, x + 74, y + 98, 22, 2, "#b0b0b0");
      solid(L, x + 74, y + 103, 22, 2, "#b0b0b0");
    }
    if (R() < 0.35) solid(L, x + 26, y + 90, 76, 4, "#8a8f94"); // window rail
  },
  office(L, x, y, R) {
    wallShade(L, x, y + 10, CELL, 26, "#d9d6d0"); // spandrel
    glass(L, x, y + 36, CELL, 78, R, 0.4);
    for (let k = 0; k <= 4; k++) solid(L, x + k * 32 - 2, y + 36, 4, 78, "#eef1f3");
    solid(L, x, y + 112, CELL, 6, "#eef1f3");
  },
  glass(L, x, y, R) {
    // whole panel is glass in the building's own (vertex) colour: keep it tinted
    const g = L.a.createLinearGradient(x, y, x + CELL, y + CELL);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(0.5, "#d8e2e8");
    g.addColorStop(1, "#aebcc6");
    L.a.fillStyle = g;
    L.a.fillRect(x, y + 12, CELL, CELL - 22);
    if (R() < 0.3) {
      L.e.fillStyle = "#ffe6b0";
      L.e.fillRect(x + 4, y + 14, CELL - 8, CELL - 28);
    }
    wallShade(L, x, y + CELL - 12, CELL, 12, "#8f9aa3");
    solid(L, x, y + 12, 3, CELL - 12, "#f2f5f7");
    solid(L, x + CELL / 2 - 1, y + 12, 2, CELL - 12, "#f2f5f7");
  },
  colonial(L, x, y, R) {
    wallShade(L, x, y + 8, CELL, 6, "#e6e1d6");
    wallShade(L, x, y + 8, 10, CELL - 8, "#f7f4ee"); // pilaster
    const sh = R() < 0.7 ? "#4d7c5a" : "#3c6e8a";
    solid(L, x + 22, y + 30, 16, 80, sh);
    solid(L, x + 90, y + 30, 16, 80, sh);
    for (let k = 0; k < 7; k++) {
      solid(L, x + 22, y + 34 + k * 11, 16, 2, "rgba(0,0,0,0.25)");
      solid(L, x + 90, y + 34 + k * 11, 16, 2, "rgba(0,0,0,0.25)");
    }
    // arched window
    L.a.fillStyle = "#f6f2e8";
    L.a.beginPath();
    L.a.arc(x + 64, y + 50, 28, Math.PI, 0);
    L.a.lineTo(x + 92, y + 112);
    L.a.lineTo(x + 36, y + 112);
    L.a.closePath();
    L.a.fill();
    L.t.fillStyle = "#000";
    L.t.beginPath();
    L.t.arc(x + 64, y + 50, 28, Math.PI, 0);
    L.t.lineTo(x + 92, y + 112);
    L.t.lineTo(x + 36, y + 112);
    L.t.closePath();
    L.t.fill();
    glass(L, x + 42, y + 50, 44, 58, R);
    L.a.fillStyle = GLASS[1];
    L.a.beginPath();
    L.a.arc(x + 64, y + 50, 22, Math.PI, 0);
    L.a.fill();
    solid(L, x + 34, y + 110, 60, 5, "#f6f2e8");
  },
};

function toTex(c: HTMLCanvasElement, srgb: boolean) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1 / N, 1 / N);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface FacadeTex { map: THREE.Texture; tint: THREE.Texture; emissive: THREE.Texture }

export function makeFacadeTextures(): Record<FacadeStyle, FacadeTex> {
  const out = {} as Record<FacadeStyle, FacadeTex>;
  FACADE_STYLES.forEach((style, si) => {
    const R = rng(100 + si);
    const [ca, a] = canvas();
    const [ct, t] = canvas();
    const [ce, e] = canvas();
    a.fillStyle = "#ffffff";
    a.fillRect(0, 0, SIZE, SIZE);
    t.fillStyle = "#ffffff";
    t.fillRect(0, 0, SIZE, SIZE);
    e.fillStyle = "#000000";
    e.fillRect(0, 0, SIZE, SIZE);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) DRAW[style]({ a, t, e }, i * CELL, j * CELL, R);
    out[style] = { map: toTex(ca, true), tint: toTex(ct, false), emissive: toTex(ce, true) };
  });
  return out;
}

/** Roof textures: greyscale detail multiplied by the roof's vertex colour. UV in metres. */
export function makeRoofTextures(): Record<RoofStyle, THREE.Texture> {
  const make = (draw: (g: Ctx, s: number) => void, metresPerTex: number) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, 256, 256);
    draw(g, 256);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / metresPerTex, 1 / metresPerTex);
    t.anisotropy = 8;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  };
  const R = rng(77);
  return {
    // clay tiles: rows of rounded tiles (rows run along the ridge)
    tile: make((g, s) => {
      for (let row = 0; row < 8; row++) {
        const y = row * 32;
        g.fillStyle = "#d9d9d9";
        g.fillRect(0, y + 26, s, 6);
        for (let k = 0; k < 8; k++) {
          const x = k * 32 + (row % 2) * 16;
          const grad = g.createLinearGradient(x, 0, x + 32, 0);
          grad.addColorStop(0, "#cfcfcf");
          grad.addColorStop(0.5, "#ffffff");
          grad.addColorStop(1, "#bdbdbd");
          g.fillStyle = grad;
          g.fillRect(x + 1, y, 30, 26);
          if (R() < 0.15) {
            g.fillStyle = "rgba(0,0,0,0.12)";
            g.fillRect(x + 1, y, 30, 26);
          }
        }
      }
    }, 2.4),
    // corrugated metal: ridges run down the slope
    metal: make((g, s) => {
      for (let k = 0; k < 16; k++) {
        const grad = g.createLinearGradient(k * 16, 0, k * 16 + 16, 0);
        grad.addColorStop(0, "#c4c4c4");
        grad.addColorStop(0.5, "#ffffff");
        grad.addColorStop(1, "#c4c4c4");
        g.fillStyle = grad;
        g.fillRect(k * 16, 0, 16, s);
      }
    }, 2),
    // flat concrete roof with faint joints and stains
    flat: make((g, s) => {
      for (let i = 0; i < 2600; i++) {
        const v = 200 + Math.floor(R() * 55);
        g.fillStyle = `rgb(${v},${v},${v})`;
        g.fillRect(R() * s, R() * s, 2, 2);
      }
      g.strokeStyle = "rgba(0,0,0,0.12)";
      g.lineWidth = 2;
      for (let k = 0; k <= 4; k++) {
        g.beginPath(); g.moveTo(k * 64, 0); g.lineTo(k * 64, s); g.stroke();
        g.beginPath(); g.moveTo(0, k * 64); g.lineTo(s, k * 64); g.stroke();
      }
    }, 4),
  };
}

/** Wall material that tints only where the tint mask is white. */
export function facadeMaterial(t: FacadeTex) {
  const m = new THREE.MeshStandardMaterial({
    vertexColors: true,
    map: t.map,
    emissiveMap: t.emissive,
    roughness: 0.82,
    metalness: 0.02,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tintMap = { value: t.tint };
    sh.fragmentShader =
      "uniform sampler2D tintMap;\n" +
      sh.fragmentShader.replace(
        "#include <color_fragment>",
        `#if defined( USE_COLOR ) && defined( USE_MAP )
          float tintK = texture2D( tintMap, vMapUv ).r;
          diffuseColor.rgb *= mix( vec3( 1.0 ), vColor.rgb, tintK );
        #elif defined( USE_COLOR )
          diffuseColor.rgb *= vColor.rgb;
        #endif`,
      );
  };
  return m;
}
