import * as THREE from "three";

/**
 * Procedural facade textures for the landmark models on the city map (canvas,
 * no external assets). One texture = one bay (bayW m) × one storey (storeyH m);
 * `boxUV` maps a box in metres so windows keep their real size on every face.
 * The top band of every tile is plain wall, used for roofs and caps.
 */
export type FacadeKind = "post" | "brick" | "market" | "palace" | "museum" | "wharf" | "glass" | "fins";

const cache = new Map<FacadeKind, THREE.Texture>();

type G = CanvasRenderingContext2D;
const S = 256;

function arch(g: G, x: number, y: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + w / 2);
  g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0);
  g.lineTo(x + w, y + h);
  g.closePath();
}
function lancet(g: G, x: number, y: number, w: number, h: number) {
  g.beginPath();
  g.moveTo(x, y + h);
  g.lineTo(x, y + w * 0.8);
  g.quadraticCurveTo(x, y, x + w / 2, y - w * 0.2);
  g.quadraticCurveTo(x + w, y, x + w, y + w * 0.8);
  g.lineTo(x + w, y + h);
  g.closePath();
}
const glassGrad = (g: G, y0: number, y1: number) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, "#cfe6f0");
  gr.addColorStop(1, "#4f7488");
  return gr;
};

const DRAW: Record<FacadeKind, (g: G) => void> = {
  // Saigon Central Post Office: ochre walls, white pilasters and cornices, tall arched windows
  post(g) {
    g.fillStyle = "#eab95c"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#fbf3df"; g.fillRect(0, 0, S, 26); g.fillRect(0, S - 18, S, 18);
    g.fillRect(0, 0, 22, S); g.fillRect(S - 22, 0, 22, S);
    g.fillStyle = "#fbf3df"; arch(g, 70, 54, 116, 170); g.fill();
    g.fillStyle = glassGrad(g, 64, 220); arch(g, 80, 64, 96, 156); g.fill();
    g.fillStyle = "#3f6d55"; g.fillRect(126, 70, 4, 150); // green window bar
    g.fillStyle = "#fbf3df"; g.fillRect(64, 220, 128, 10);
  },
  // Notre-Dame: red Marseille brick with mortar joints and pointed lancet windows in stone frames
  brick(g) {
    g.fillStyle = "#b9533b"; g.fillRect(0, 0, S, S);
    g.fillStyle = "rgba(255,230,210,0.22)";
    for (let y = 0; y < S; y += 8) g.fillRect(0, y, S, 1.5);
    for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? 0 : 12; x < S; x += 24) g.fillRect(x, y, 1.5, 8);
    g.fillStyle = "#e8e0d2"; g.fillRect(0, 0, S, 18); // stone string course
    g.fillStyle = "#e8e0d2"; lancet(g, 92, 66, 72, 170); g.fill();
    g.fillStyle = glassGrad(g, 60, 236); lancet(g, 102, 76, 52, 156); g.fill();
    g.fillStyle = "#e8e0d2"; g.fillRect(126, 70, 4, 160);
  },
  // Bến Thành market: cream walls, wide arched openings, a band at the eaves
  market(g) {
    g.fillStyle = "#f2e6cb"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#c9a46a"; g.fillRect(0, 0, S, 20); g.fillRect(0, 120, S, 8);
    g.fillStyle = "#6e5a44"; arch(g, 40, 140, 176, 116); g.fill();
    g.fillStyle = "#e9dcc0"; g.fillRect(28, 140, 12, 116); g.fillRect(216, 140, 12, 116);
    g.fillStyle = glassGrad(g, 40, 110); arch(g, 70, 40, 116, 70); g.fill();
  },
  // Independence Palace: white concrete, dark glazing bands behind the stone "curtain"
  palace(g) {
    g.fillStyle = "#f6f4ee"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#2f3b45"; g.fillRect(0, 70, S, 140);
    g.fillStyle = "#dfe7ec"; for (let x = 0; x < S; x += 32) g.fillRect(x, 70, 3, 140);
    g.fillStyle = "#e9e5da"; g.fillRect(0, 210, S, 20);
  },
  // War Remnants Museum: off-white blocks with horizontal ribbon windows
  museum(g) {
    g.fillStyle = "#efece4"; g.fillRect(0, 0, S, S);
    g.fillStyle = glassGrad(g, 90, 170); g.fillRect(0, 90, S, 80);
    g.fillStyle = "#d8d3c7"; for (let x = 0; x < S; x += 64) g.fillRect(x, 90, 4, 80);
    g.fillStyle = "#c9c3b5"; g.fillRect(0, 230, S, 26);
  },
  // Nhà Rồng: colonial cream walls, arched windows with green shutters
  wharf(g) {
    g.fillStyle = "#f3e2b4"; g.fillRect(0, 0, S, S);
    g.fillStyle = "#fbf6e8"; g.fillRect(0, 0, S, 22); g.fillRect(0, S - 22, S, 22);
    g.fillStyle = "#fbf6e8"; arch(g, 82, 60, 92, 160); g.fill();
    g.fillStyle = glassGrad(g, 70, 210); arch(g, 92, 70, 72, 144); g.fill();
    g.fillStyle = "#3f7d5a"; g.fillRect(50, 80, 30, 134); g.fillRect(176, 80, 30, 134);
  },
  // curtain wall: light sky-reflecting glass with mullions and floor lines
  glass(g) {
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, "#d7ecf4"); gr.addColorStop(0.5, "#86b6cc"); gr.addColorStop(1, "#5d8aa1");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = "#eef4f6"; g.fillRect(0, 0, S, 10);
    g.fillStyle = "rgba(255,255,255,0.7)"; for (let x = 0; x < S; x += 64) g.fillRect(x, 0, 3, S);
  },
  // Landmark 81: glass with white vertical fins
  fins(g) {
    const gr = g.createLinearGradient(0, 0, 0, S);
    gr.addColorStop(0, "#cfe5ef"); gr.addColorStop(1, "#6f9fb7");
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    g.fillStyle = "#f7f8f6"; for (let x = 0; x < S; x += 43) g.fillRect(x, 0, 9, S);
    g.fillStyle = "rgba(255,255,255,0.55)"; g.fillRect(0, 0, S, 6);
  },
};

export function facadeTexture(kind: FacadeKind) {
  let t = cache.get(kind);
  if (t) return t;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  DRAW[kind](c.getContext("2d")!);
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  cache.set(kind, t);
  return t;
}

/** Box geometry whose UVs are in bays/storeys, so a facade texture tiles at real scale; tops sample the plain band. */
export function facadeBox(sx: number, sy: number, sz: number, bayW: number, storeyH: number) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const uv = g.getAttribute("uv") as THREE.BufferAttribute;
  // face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  for (let f = 0; f < 6; f++) {
    for (let k = 0; k < 4; k++) {
      const i = f * 4 + k, u = uv.getX(i), v = uv.getY(i);
      if (f === 2 || f === 3) uv.setXY(i, 0.02 + u * 0.02, 0.99); // roof / underside: plain
      else uv.setXY(i, (u * (f < 2 ? sz : sx)) / bayW, (v * sy) / storeyH);
    }
  }
  uv.needsUpdate = true;
  return g;
}

/**
 * Materials lit at night, registered with their own light: stone and render facades are
 * floodlit warm and soft; glass towers only get a faint white wash; accents (a tower crown)
 * glow brighter. Switched by the map with the theme.
 */
const lit = new Map<THREE.MeshStandardMaterial, { color: string; k: number }>();
export function floodlit(m: THREE.MeshStandardMaterial, color = "#ffb878", k = 0.16) {
  lit.set(m, { color, k });
  return m;
}
export function setLandmarkNight(dark: boolean) {
  for (const [m, l] of lit) {
    m.emissive.set(dark ? l.color : "#000000");
    m.emissiveIntensity = dark ? l.k : 0;
  }
}
