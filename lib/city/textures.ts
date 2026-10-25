import * as THREE from "three";
import { rng } from "@/lib/geo";

/**
 * Procedural facade textures (no external assets). One tile = one bay
 * (3.6 m × 3.4 m); the texture holds 8×8 bays so lit windows vary at night.
 * Pixel (0..8, bottom-left) stays plain wall — roofs sample it.
 */
const TILE = 64;
const N = 8;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = c.height = TILE * N;
  return [c, c.getContext("2d")!];
}

export function makeFacadeTextures() {
  const R = rng(42);
  const [c, g] = canvas();
  const [e, ge] = canvas();
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, c.width, c.height);
  ge.fillStyle = "#000000";
  ge.fillRect(0, 0, e.width, e.height);

  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = i * TILE, y = j * TILE;
    const wide = R() < 0.3;
    const wx = x + (wide ? 10 : 18), ww = wide ? TILE - 20 : TILE - 36;
    const wy = y + 14, wh = TILE - 30;
    // window glass
    g.fillStyle = R() < 0.5 ? "#6f8796" : "#7e939e";
    g.fillRect(wx, wy, ww, wh);
    // frame / sill
    g.fillStyle = "#d6d0c4";
    g.fillRect(wx - 2, wy + wh, ww + 4, 3);
    // occasional shutters / balcony rail
    if (R() < 0.35) {
      g.fillStyle = "#c4bcae";
      g.fillRect(wx - 3, wy + wh - 8, ww + 6, 2);
      g.fillRect(wx - 3, wy + wh - 2, ww + 6, 2);
    }
    if (R() < 0.38) {
      ge.fillStyle = R() < 0.7 ? "#ffd38a" : "#fff1cc";
      ge.fillRect(wx, wy, ww, wh);
    }
  }
  // Keep the bottom-left corner plain for roofs (canvas y is flipped).
  g.fillStyle = "#ffffff";
  g.fillRect(0, c.height - 10, 10, 10);
  ge.fillStyle = "#000000";
  ge.fillRect(0, e.height - 10, 10, 10);

  const map = new THREE.CanvasTexture(c);
  const emissive = new THREE.CanvasTexture(e);
  for (const t of [map, emissive]) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(1 / N, 1 / N);
    t.anisotropy = 4;
    t.colorSpace = THREE.SRGBColorSpace;
  }
  return { map, emissive };
}
