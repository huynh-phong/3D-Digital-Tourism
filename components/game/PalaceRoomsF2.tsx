"use client";

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { CEIL_F2, CEIL_OFFICE, COURT, CREAM, F2, OFFICE, PRES, R2, RED, VP } from "@/data/dinh/rooms2";
import { LEVEL } from "@/data/dinh/layout";
import { rng } from "@/lib/geo";
import { Chandelier, CurtainBank, Instances, M4, Painting, type Extra, type Mats } from "./Palace";

/*
 * Floor-2 reception rooms and office, re-modelled from reference groups 11–14.
 * Each room has its own carpet layout, furniture types, curtains and ceiling,
 * as in its photos. Large unique surfaces (rugs, lacquer cabinet doors) are
 * drawn once on 2048-px canvases (not tiled), the rest uses the shared PBR sets.
 * Motifs are drawn procedurally after the photos; no photo is pasted.
 */

type V3 = [number, number, number];
const box = (w: number, h: number, d: number, x: number, y: number, z: number, rx = 0) => {
  const g = new THREE.BoxGeometry(w, h, d);
  if (rx) g.rotateX(rx);
  g.translate(x, y, z);
  return g;
};
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs.map((g) => (g.index ? g.toNonIndexed() : g)))!;

/* ------------------------------------------------------------ canvas art */
function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function useCanvasMaterial(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void, opts: THREE.MeshStandardMaterialParameters = {}) {
  const m = useMemo(() => new THREE.MeshStandardMaterial({ map: canvasTexture(w, h, draw), roughness: 0.92, ...opts }),
    // `draw` is a module-level function per key
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, w, h]);
  useEffect(() => () => { m.map?.dispose(); m.dispose(); }, [m]);
  return m;
}

/** Greek-key (meander) band along a rectangle's edge. */
function meander(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, s: number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = s * 0.22;
  const step = s * 1.6;
  const run = (x0: number, y0: number, len: number, horiz: boolean) => {
    for (let t = 0; t + step <= len; t += step) {
      g.beginPath();
      const P = (a: number, b: number) => (horiz ? [x0 + t + a * s, y0 + b * s] : [x0 + b * s, y0 + t + a * s]) as [number, number];
      const pts = [P(0, 1), P(0, 0), P(1.2, 0), P(1.2, 0.8), P(0.4, 0.8), P(0.4, 0.35), P(0.8, 0.35)];
      g.moveTo(...pts[0]);
      for (const p of pts.slice(1)) g.lineTo(...p);
      g.stroke();
    }
  };
  run(x, y, w, true);
  run(x, y + h - s, w, true);
  run(x, y, h, false);
  run(x + w - s, y, h, false);
}

/** Stylised 壽 (longevity) medallion: concentric round frame with symmetric bars (DDLP_0015, 0048, 0044). */
function shou(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, bg: string | null) {
  g.save();
  g.translate(cx, cy);
  if (bg) {
    g.fillStyle = bg;
    g.beginPath();
    g.ellipse(0, 0, r * 1.15, r, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = color;
  g.fillStyle = color;
  g.lineWidth = r * 0.09;
  g.beginPath();
  g.ellipse(0, 0, r * 1.05, r * 0.92, 0, 0, Math.PI * 2);
  g.stroke();
  const bar = (y: number, w: number) => g.fillRect(-w / 2, y - r * 0.05, w, r * 0.1);
  bar(-r * 0.62, r * 0.9);
  bar(-r * 0.32, r * 1.5);
  bar(0, r * 1.75);
  bar(r * 0.32, r * 1.5);
  bar(r * 0.62, r * 0.9);
  g.fillRect(-r * 0.05, -r * 0.8, r * 0.1, r * 1.6);
  for (const s of [-1, 1]) {
    g.fillRect(s * r * 0.55 - r * 0.05, -r * 0.32, r * 0.1, r * 0.64);
    g.beginPath();
    g.arc(s * r * 0.95, 0, r * 0.18, 0, Math.PI * 2);
    g.stroke();
  }
  g.restore();
}

/** Blue cloud scrolls (DDLP_0015, 0297 carpet; 0044 rugs). */
function clouds(g: CanvasRenderingContext2D, R: () => number, n: number, x0: number, y0: number, w: number, h: number, color: string, avoid?: (x: number, y: number) => boolean) {
  g.strokeStyle = color;
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = x0 + R() * w, y = y0 + R() * h;
    if (avoid?.(x, y)) continue;
    const s = 14 + R() * 26;
    g.lineWidth = s * 0.28;
    g.beginPath();
    g.arc(x, y, s, Math.PI * 0.9, Math.PI * 2.1);
    g.arc(x + s * 1.6, y + s * 0.2, s * 0.7, Math.PI, Math.PI * 2.3);
    g.stroke();
  }
}

/** Red carpet with a gold 壽 medallion in a ring of blue clouds, chrysanthemum spray, cream+blue meander border. */
function drawRedShou(g: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(11);
  g.fillStyle = "#24408a";
  g.fillRect(0, 0, w, h);
  g.fillStyle = "#e7d29a";
  g.fillRect(w * 0.025, h * 0.025, w * 0.95, h * 0.95);
  meander(g, w * 0.03, h * 0.03, w * 0.94, h * 0.94, w * 0.018, "#24408a");
  g.fillStyle = "#b6111f";
  g.fillRect(w * 0.075, h * 0.075, w * 0.85, h * 0.85);
  // wool shading
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "255,80,80"},${0.03 + R() * 0.04})`;
    g.fillRect(w * 0.075 + R() * w * 0.85, h * 0.075 + R() * h * 0.85, 3 + R() * 10, 2);
  }
  const cx = w / 2, cy = h * 0.45, r = w * 0.2;
  // wave/cloud ring round the medallion
  g.fillStyle = "#2a4b9b";
  g.beginPath();
  g.ellipse(cx, cy, r * 1.75, r * 1.45, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#b6111f";
  g.beginPath();
  g.ellipse(cx, cy, r * 1.45, r * 1.2, 0, 0, Math.PI * 2);
  g.fill();
  clouds(g, R, 90, cx - r * 1.8, cy - r * 1.5, r * 3.6, r * 3, "#e9e3d0", (x, y) => Math.hypot((x - cx) / 1.6, (y - cy) / 1.33) < r * 0.95);
  shou(g, cx, cy, r * 0.85, "#d9b34f", null);
  // chrysanthemum spray toward the entrance (DDLP_0015, 0297)
  const fx = cx, fy = h * 0.82;
  for (let k = 0; k < 14; k++) {
    const a = Math.PI + (k / 13) * Math.PI;
    g.fillStyle = k % 2 ? "#e2b54a" : "#f0d27a";
    g.beginPath();
    g.ellipse(fx + Math.cos(a) * w * 0.05, fy + Math.sin(a) * w * 0.035, w * 0.018, w * 0.008, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "#2a4b9b";
  g.beginPath();
  g.ellipse(fx, fy + w * 0.012, w * 0.06, w * 0.014, 0, 0, Math.PI * 2);
  g.fill();
}

/** Cream rug with a blue 壽 on a maroon panel, blue cloud scrolls and 壽 corner marks (DDLP_0044, 0076, 0218). */
function drawCreamRug(g: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(23);
  g.fillStyle = "#eadbb6";
  g.fillRect(0, 0, w, h);
  clouds(g, R, 60, 0, 0, w, h, "#8fa6c8", (x, y) => Math.abs(x - w / 2) < w * 0.28 && Math.abs(y - h / 2) < h * 0.28);
  g.fillStyle = "#7a1424";
  g.fillRect(w * 0.25, h * 0.27, w * 0.5, h * 0.46);
  shou(g, w / 2, h / 2, Math.min(w, h) * 0.18, "#2c4a96", "#c8d2e6");
  for (const [x, y] of [[0.12, 0.2], [0.88, 0.2], [0.12, 0.8], [0.88, 0.8]]) shou(g, w * x, h * y, Math.min(w, h) * 0.06, "#2c4a96", null);
  g.strokeStyle = "#c9b98f";
  g.lineWidth = w * 0.01;
  g.strokeRect(w * 0.01, h * 0.01, w * 0.98, h * 0.98);
}

/** Maroon wool field with a blue meander border (DDLP_0044, 0218). */
function drawMaroonField(g: CanvasRenderingContext2D, w: number, h: number) {
  const R = rng(37);
  g.fillStyle = "#6d1424";
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = `rgba(${R() < 0.5 ? "0,0,0" : "200,60,80"},${0.03 + R() * 0.04})`;
    g.fillRect(R() * w, R() * h, 3 + R() * 10, 2);
  }
  g.fillStyle = "#e9dcb8";
  const b = w * 0.03;
  g.fillRect(b, b, w - 2 * b, b * 1.6);
  g.fillRect(b, h - b * 2.6, w - 2 * b, b * 1.6);
  g.fillRect(b, b, b * 1.6, h - 2 * b);
  g.fillRect(w - b * 2.6, b, b * 1.6, h - 2 * b);
  meander(g, b, b, w - 2 * b, h - 2 * b, b * 1.6, "#2c4a96");
}

/** Red lacquer door with gold painted branches (Mai–Lan / Cúc–Trúc theme, official article): illustrative brushwork, not a copy. */
function drawLacquerDoor(seed: number) {
  return (g: CanvasRenderingContext2D, w: number, h: number) => {
    const R = rng(seed);
    const grd = g.createLinearGradient(0, 0, w, h);
    grd.addColorStop(0, "#7d1510");
    grd.addColorStop(1, "#5e0e0a");
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#d9b25a";
    g.fillStyle = "#e6c46c";
    g.lineCap = "round";
    // two doors side by side: plum branch (left), bamboo leaves (right)
    const branch = (x: number, y: number, a: number, len: number, wdt: number, depth: number) => {
      if (depth <= 0 || len < 8) return;
      const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
      g.lineWidth = wdt;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo((x + x2) / 2 + (R() - 0.5) * len * 0.4, (y + y2) / 2, x2, y2);
      g.stroke();
      if (depth < 3) for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.arc(x2 + (R() - 0.5) * 20, y2 + (R() - 0.5) * 20, 4 + R() * 5, 0, Math.PI * 2);
        g.fill();
      }
      branch(x2, y2, a - 0.4 - R() * 0.4, len * 0.7, wdt * 0.65, depth - 1);
      branch(x2, y2, a + 0.3 + R() * 0.4, len * 0.6, wdt * 0.6, depth - 1);
    };
    branch(w * 0.08, h * 0.95, -1.2, h * 0.25, 10, 6);
    for (let k = 0; k < 7; k++) {
      const x = w * (0.6 + k * 0.045);
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(x, h * 0.98);
      g.lineTo(x + (R() - 0.5) * 30, h * (0.2 + R() * 0.2));
      g.stroke();
      for (let j = 0; j < 6; j++) {
        const ly = h * (0.25 + R() * 0.6), lx = x + (R() - 0.5) * 20, a = (R() - 0.5) * 2;
        g.beginPath();
        g.ellipse(lx + Math.cos(a) * 25, ly + Math.sin(a) * 25, 28, 6, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    // door split and brass pulls are modelled; gold rim
    g.strokeStyle = "#c9a14a";
    g.lineWidth = 8;
    g.strokeRect(10, 10, w / 2 - 20, h - 20);
    g.strokeRect(w / 2 + 10, 10, w / 2 - 20, h - 20);
  };
}
const drawLacquerA = drawLacquerDoor(5);
const drawLacquerB = drawLacquerDoor(9);

/* ----------------------------------------------------------- furniture */
/** Carved rosewood armchair with an upholstered seat and back panel (DDLP_0044, 0049, 0003, 0286). */
function carvedChairGeo() {
  const frame = merge([
    box(0.62, 0.07, 0.56, 0, 0.44, 0),
    ...[[-0.28, 0.24], [0.28, 0.24], [-0.28, -0.24], [0.28, -0.24]].map(([x, z]) => box(0.06, 0.44, 0.06, x, 0.22, z)),
    box(0.06, 0.62, 0.06, -0.28, 0.78, -0.25), box(0.06, 0.62, 0.06, 0.28, 0.78, -0.25),
    // curved crest rail and pierced side panels of the back
    box(0.7, 0.1, 0.07, 0, 1.12, -0.25), box(0.12, 0.08, 0.07, -0.36, 1.06, -0.25), box(0.12, 0.08, 0.07, 0.36, 1.06, -0.25),
    box(0.05, 0.5, 0.04, -0.17, 0.78, -0.25), box(0.05, 0.5, 0.04, 0.17, 0.78, -0.25),
    // scrolled arms
    box(0.06, 0.06, 0.5, -0.3, 0.68, 0), box(0.06, 0.06, 0.5, 0.3, 0.68, 0), box(0.05, 0.22, 0.05, -0.3, 0.56, 0.22), box(0.05, 0.22, 0.05, 0.3, 0.56, 0.22),
    box(0.56, 0.06, 0.04, 0, 0.1, 0.25),
  ]);
  const pad = merge([box(0.54, 0.09, 0.5, 0, 0.52, 0.02), box(0.28, 0.48, 0.035, 0, 0.8, -0.225)]);
  return { frame, pad };
}
/** Upholstered armchair with block arms (gold damask / cream), DDLP_0081, 0076, 0013. */
function armchairGeo() {
  const body = merge([box(0.64, 0.2, 0.62, 0, 0.42, 0.02), box(0.64, 0.6, 0.18, 0, 0.82, -0.25), box(0.15, 0.36, 0.66, -0.36, 0.58, 0), box(0.15, 0.36, 0.66, 0.36, 0.58, 0)]);
  const legs = merge([[-0.3, 0.26], [0.3, 0.26], [-0.3, -0.26], [0.3, -0.26]].map(([x, z]) => box(0.05, 0.32, 0.05, x, 0.16, z)));
  return { body, legs };
}
function sofaGeo(seats = 3) {
  const w = seats * 0.75;
  const body = merge([box(w, 0.22, 0.75, 0, 0.44, 0.02), box(w, 0.6, 0.2, 0, 0.84, -0.3), box(0.2, 0.36, 0.8, -w / 2 - 0.1, 0.6, 0), box(0.2, 0.36, 0.8, w / 2 + 0.1, 0.6, 0)]);
  const base = box(w + 0.45, 0.32, 0.72, 0, 0.16, 0);
  return { body, base };
}
/** Low lacquered table with a waisted apron and cabriole-like feet (DDLP_0044, 0297). */
function lowTableGeo(w = 1.3, d = 0.75, h = 0.45) {
  return merge([box(w, 0.05, d, 0, h, 0), box(w - 0.1, 0.08, d - 0.1, 0, h - 0.07, 0), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => box(0.06, h - 0.05, 0.06, (sx * (w - 0.1)) / 2, (h - 0.05) / 2, (sz * (d - 0.1)) / 2))]);
}
function tripodGeo() {
  const top = box(0.45, 0.04, 0.45, 0, 0.62, 0);
  const col = new THREE.CylinderGeometry(0.04, 0.05, 0.56, 8);
  col.translate(0, 0.32, 0);
  const feet = [0, 1, 2].map((k) => {
    const f = box(0.04, 0.04, 0.32, 0, 0.05, 0.14);
    f.rotateY((k / 3) * Math.PI * 2);
    return f;
  });
  return merge([top, col, ...feet]);
}
/** Baluster vase on a square pedestal. */
function vaseGeo() {
  const pts = [[0.001, 0], [0.13, 0], [0.12, 0.05], [0.24, 0.3], [0.26, 0.5], [0.2, 0.75], [0.11, 0.86], [0.1, 0.95], [0.14, 1.0], [0.001, 1.0]].map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(pts, 24);
}

function useFurnitureGeos() {
  const geo = useMemo(() => ({
    carved: carvedChairGeo(),
    arm: armchairGeo(),
    sofa: sofaGeo(3),
    lowTable: lowTableGeo(),
    smallTable: lowTableGeo(0.9, 0.6, 0.5),
    tripod: tripodGeo(),
    vase: vaseGeo(),
    pedestal: box(0.5, 0.8, 0.5, 0, 0.4, 0),
    unit: new THREE.BoxGeometry(1, 1, 1),
  }), []);
  useEffect(() => () => {
    const all = [geo.carved.frame, geo.carved.pad, geo.arm.body, geo.arm.legs, geo.sofa.body, geo.sofa.base, geo.lowTable, geo.smallTable, geo.tripod, geo.vase, geo.pedestal, geo.unit];
    all.forEach((g) => g.dispose());
  }, [geo]);
  return geo;
}
const mats4 = (list: { x: number; z: number; ry?: number }[], y = F2, s = 1) => list.map((p) => M4(p.x, y, p.z, p.ry ?? 0, s, s, s));

/* ------------------------------------------------------- shared shell */
type Rect = { x0: number; x1: number; z0: number; z1: number };
/**
 * Room shell common to the reception rooms (DDLP_0044, 0050, 0076, 0015): wood
 * floor round the carpet, white ceiling with a sloped reeded-wood border and a
 * round crystal chandelier, curtain banks with light behind the sheers on the
 * window walls, brass sconces.
 */
function ReceptionShell({ r, mats, extra, windows, chandeliers }: { r: Rect; mats: Mats; extra: Extra; windows: { p: V3; ry: number; w: number }[]; chandeliers: [number, number][] }) {
  const W = r.x1 - r.x0, D = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const h = CEIL_F2 - F2 - 0.2;
  const border = useMemo(() => {
    const t = 1.5, items: THREE.Matrix4[] = [];
    // four sloped strips of reeded wood at the ceiling edge
    items.push(M4(cx, CEIL_F2 - 0.35, r.z0 + t / 2, 0, W, 0.7, t), M4(cx, CEIL_F2 - 0.35, r.z1 - t / 2, 0, W, 0.7, t));
    items.push(M4(r.x0 + t / 2, CEIL_F2 - 0.35, cz, 0, t, 0.7, D - 2 * t), M4(r.x1 - t / 2, CEIL_F2 - 0.35, cz, 0, t, 0.7, D - 2 * t));
    return items;
  }, [r, cx, cz, W, D]);
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  useEffect(() => () => unit.dispose(), [unit]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, F2 + 0.012, cz]} material={extra.woodPlank} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <Instances geometry={unit} material={extra.woodReeded} items={border} receiveShadow={false} />
      {chandeliers.map(([x, z]) => (
        <Chandelier key={`${x},${z}`} p={[x, CEIL_F2 - 0.7, z]} r={0.95} extra={extra} />
      ))}
      {windows.map((w, i) => (
        <group key={i}>
          <CurtainBank p={[w.p[0], F2 + h / 2, w.p[2]]} ry={w.ry} w={w.w} h={h} drape={extra.curtainGold} sheer={extra.sheer} />
          <mesh position={[w.p[0] - Math.sin(w.ry) * 0.12, F2 + h / 2, w.p[2] - Math.cos(w.ry) * 0.12]} rotation={[0, w.ry, 0]} material={extra.panelGlow}>
            <planeGeometry args={[w.w * 0.62, h * 0.9]} />
          </mesh>
        </group>
      ))}
      {/* brass sconces on the walls between windows */}
      {windows.slice(0, -1).map((w, i) => {
        const n = windows[i + 1];
        if (Math.abs(n.ry - w.ry) > 0.01) return null;
        const p: V3 = [(w.p[0] + n.p[0]) / 2, F2 + 2.6, (w.p[2] + n.p[2]) / 2];
        return (
          <group key={`s${i}`} position={p} rotation={[0, w.ry, 0]}>
            <mesh position={[0, 0, -0.06]} material={mats.gold}><boxGeometry args={[0.12, 0.3, 0.04]} /></mesh>
            <mesh position={[0, 0.08, 0.04]} material={extra.glow}><sphereGeometry args={[0.08, 10, 8]} /></mesh>
          </group>
        );
      })}
    </group>
  );
}
const along = (x0: number, x1: number, n: number, z: number, ry: number, w: number) => Array.from({ length: n }, (_, i) => ({ p: [x0 + ((x1 - x0) * (i + 0.5)) / n, 0, z] as V3, ry, w }));
const alongZ = (z0: number, z1: number, n: number, x: number, ry: number, w: number) => Array.from({ length: n }, (_, i) => ({ p: [x, 0, z0 + ((z1 - z0) * (i + 0.5)) / n] as V3, ry, w }));

/* ======================================================= the five rooms */
/** Phòng Tiếp khách Tổng thống (DDLP_0015, 0081, 0297, 0048; official article on its lacquer cabinets). */
export function PresReceptionDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const r = R2.presReception;
  const g = useFurnitureGeos();
  const rug = useCanvasMaterial("redShou", 2048, 2048, drawRedShou);
  const doorA = useCanvasMaterial("lacA", 1024, 1024, drawLacquerA, { roughness: 0.2, metalness: 0.05 });
  const doorB = useCanvasMaterial("lacB", 1024, 1024, drawLacquerB, { roughness: 0.2, metalness: 0.05 });
  const tusk = useMemo(() => {
    const c = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.05, 0.9, 0.12), new THREE.Vector3(-0.05, 1.8, 0.1), new THREE.Vector3(-0.35, 2.4, -0.05)]);
    return new THREE.TubeGeometry(c, 24, 0.075, 10);
  }, []);
  useEffect(() => () => tusk.dispose(), [tusk]);
  const P = PRES;
  const sofas = useMemo(() => mats4(P.sofas), [P]);
  const arms = useMemo(() => mats4(P.armchairs), [P]);
  const side = useMemo(() => mats4(P.sideChairs), [P]);
  const tables = useMemo(() => mats4(P.lowTables), [P]);
  const tri = useMemo(() => mats4(P.tripods), [P]);
  const vases = useMemo(() => P.vases.map((v) => M4(v.x, F2 + 0.8, v.z, 0, 1.25, 1.25, 1.25)), [P]);
  const peds = useMemo(() => mats4(P.vases), [P]);
  const t = P.throne;
  return (
    <group>
      <ReceptionShell r={r} mats={mats} extra={extra} windows={along(r.x0 + 1, r.x1 - 1, 5, r.z1 - 0.45, Math.PI, 3.2)} chandeliers={[[P.cx, -21.5]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[P.rug.x, F2 + 0.025, P.rug.z]} material={rug} receiveShadow>
        <planeGeometry args={[P.rug.w, P.rug.d]} />
      </mesh>
      {/* the framed niche: gilt frame, dark wood panel, elephant tusks, carved chair (DDLP_0048, 0297) */}
      <group position={[t.x, F2, r.z0 + 0.22]}>
        <mesh position={[0, 2.3, 0]} material={mats.gold}><boxGeometry args={[4.0, 4.6, 0.1]} /></mesh>
        <mesh position={[0, 2.3, 0.06]} material={extra.rosewood}><boxGeometry args={[3.6, 4.2, 0.04]} /></mesh>
        <mesh position={[0, 2.5, 0.09]} material={extra.woodReeded}><boxGeometry args={[1.6, 3.6, 0.03]} /></mesh>
      </group>
      {[-1, 1].map((s) => (
        <mesh key={s} geometry={tusk} position={[t.x + s * 1.05, F2 + 0.15, t.z + 0.1]} scale={[s, 1, 1]} material={extra.ivory} castShadow />
      ))}
      <group position={[t.x, F2, t.z]}>
        <mesh position={[0, 0.5, 0]} material={extra.rosewood} castShadow><boxGeometry args={[1.2, 0.5, 0.75]} /></mesh>
        <mesh position={[0, 1.15, -0.3]} material={extra.rosewood} castShadow><boxGeometry args={[1.25, 1.1, 0.14]} /></mesh>
        <mesh position={[0, 1.78, -0.3]} material={extra.rosewood}><sphereGeometry args={[0.3, 12, 8]} /></mesh>
        <mesh position={[0, 0.79, 0.04]} material={extra.damaskRed}><boxGeometry args={[0.9, 0.08, 0.55]} /></mesh>
      </group>
      {/* two red lacquer cabinets painted in gold (official: Mai–Lan, Cúc–Trúc) on bronze-shod bases */}
      {P.cabinets.map((c, i) => (
        <group key={i} position={[c.x, F2, c.z]}>
          <mesh position={[0, 0.1, 0]} material={extra.bronze}><boxGeometry args={[1.66, 0.2, 0.62]} /></mesh>
          <mesh position={[0, 1.15, 0]} material={extra.lacquerRed} castShadow><boxGeometry args={[1.6, 1.9, 0.56]} /></mesh>
          <mesh position={[0, 1.15, 0.285]} material={i ? doorB : doorA}><planeGeometry args={[1.52, 1.82]} /></mesh>
          {[-0.08, 0.08].map((x) => (
            <mesh key={x} position={[x, 1.15, 0.3]} material={mats.gold}><boxGeometry args={[0.03, 0.16, 0.03]} /></mesh>
          ))}
        </group>
      ))}
      <Instances geometry={g.sofa.body} material={extra.damaskYellow} items={sofas} castShadow />
      <Instances geometry={g.sofa.base} material={extra.rosewood} items={sofas} />
      <Instances geometry={g.arm.body} material={extra.damaskYellow} items={arms} castShadow />
      <Instances geometry={g.arm.legs} material={extra.rosewood} items={arms} />
      <Instances geometry={g.carved.frame} material={extra.rosewood} items={side} castShadow />
      <Instances geometry={g.carved.pad} material={extra.cream} items={side} />
      <Instances geometry={g.lowTable} material={extra.rosewood} items={tables} castShadow />
      <Instances geometry={g.tripod} material={extra.rosewood} items={tri} />
      <Instances geometry={g.pedestal} material={extra.rosewood} items={peds} />
      <Instances geometry={g.vase} material={extra.cobalt} items={vases} />
    </group>
  );
}

/** Reception room with carved red chairs (DDLP_0003, 0286): desk with a key-fret apron before a tall wood panel, round table group, cobalt vases. */
export function RedReceptionDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const r = R2.redReception;
  const g = useFurnitureGeos();
  const rug = useCanvasMaterial("redShou", 2048, 2048, drawRedShou);
  const chairs = useMemo(() => mats4(RED.chairs), []);
  const vases = useMemo(() => RED.vases.map((v) => M4(v.x, F2 + 0.8, v.z, 0, 1.3, 1.5, 1.3)), []);
  const peds = useMemo(() => mats4(RED.vases), []);
  const d = RED.desk, rt = RED.roundTable;
  return (
    <group>
      <ReceptionShell r={r} mats={mats} extra={extra} windows={[...along(r.x0 + 1, r.x1 - 1, 4, r.z1 - 0.45, Math.PI, 3.0), ...alongZ(-30, -12, 4, r.x0 + 0.45, Math.PI / 2, 3.4)]} chandeliers={[[RED.cx, -22]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[RED.rug.x, F2 + 0.025, RED.rug.z]} material={rug} receiveShadow>
        <planeGeometry args={[RED.rug.w, RED.rug.d]} />
      </mesh>
      {/* tall reeded wood panel behind the desk (DDLP_0286) */}
      <mesh position={[d.x, F2 + 2.3, r.z0 + 0.25]} material={extra.woodReeded}><boxGeometry args={[3.2, 4.6, 0.08]} /></mesh>
      <group position={[d.x, F2, d.z]}>
        <mesh position={[0, 0.76, 0]} material={extra.rosewood} castShadow><boxGeometry args={[d.w, 0.06, d.d]} /></mesh>
        <mesh position={[0, 0.45, 0]} material={extra.rosewood} castShadow><boxGeometry args={[d.w - 0.1, 0.56, d.d - 0.1]} /></mesh>
        {/* key-fret band on the apron */}
        <mesh position={[0, 0.66, d.d / 2 - 0.04]} material={mats.gold}><boxGeometry args={[d.w - 0.2, 0.06, 0.01]} /></mesh>
      </group>
      <group position={[rt.x, F2, rt.z]}>
        <mesh position={[0, 0.72, 0]} material={mats.glass}><cylinderGeometry args={[rt.r, rt.r, 0.03, 40]} /></mesh>
        <mesh position={[0, 0.69, 0]} material={extra.rosewood}><cylinderGeometry args={[rt.r - 0.05, rt.r - 0.05, 0.05, 40]} /></mesh>
        <mesh position={[0, 0.34, 0]} material={extra.rosewood}><cylinderGeometry args={[0.1, 0.22, 0.68, 12]} /></mesh>
      </group>
      <Instances geometry={g.carved.frame} material={extra.rosewood} items={chairs} castShadow />
      <Instances geometry={g.carved.pad} material={extra.damaskRoundel} items={chairs} />
      <Instances geometry={g.pedestal} material={extra.rosewood} items={peds} />
      <Instances geometry={g.vase} material={extra.cobalt} items={vases} />
    </group>
  );
}

/** Long reception room (DDLP_0044, 0049, 0050, 0218, 0082): maroon carpet with three cream 壽 rugs, two facing rows of carved chairs with red cushions, lacquer tables, gold curtain wall. */
export function VpReceptionDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const r = R2.vpReception;
  const g = useFurnitureGeos();
  const field = useCanvasMaterial("maroonField", 2048, 2048, drawMaroonField);
  const rugMat = useCanvasMaterial("creamRug", 2048, 1536, drawCreamRug);
  const chairs = useMemo(() => mats4([...VP.rows, ...VP.endChairs]), []);
  const tables = useMemo(() => mats4(VP.tables), []);
  const vases = useMemo(() => VP.vases.map((v) => M4(v.x, F2 + 0.8, v.z, 0, 1.1, 1.3, 1.1)), []);
  const peds = useMemo(() => mats4(VP.vases), []);
  const h = CEIL_F2 - F2 - 0.2;
  return (
    <group>
      <ReceptionShell r={r} mats={mats} extra={extra} windows={along(r.x0 + 0.5, r.x1 - 2, 5, r.z1 - 0.45, Math.PI, 3.2)} chandeliers={[[15, -20.5], [23, -20.5]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[18, F2 + 0.02, -20.5]} material={field} receiveShadow>
        <planeGeometry args={[21, 19]} />
      </mesh>
      {VP.rugs.map((p) => (
        <mesh key={p.x} rotation={[-Math.PI / 2, 0, 0]} position={[p.x, F2 + 0.028, p.z]} material={rugMat} receiveShadow>
          <planeGeometry args={[4.4, 3.3]} />
        </mesh>
      ))}
      {/* gold curtain wall at the end of the room (DDLP_0044, 0049) */}
      <CurtainBank p={[r.x1 - 0.35, F2 + h / 2, -18]} ry={-Math.PI / 2} w={14.5} h={h} drape={extra.curtainGold} sheer={extra.curtainGold} />
      <Instances geometry={g.carved.frame} material={extra.rosewood} items={chairs} castShadow />
      <Instances geometry={g.carved.pad} material={extra.damaskRed} items={chairs} />
      <Instances geometry={g.lowTable} material={mats.lacquer} items={tables} castShadow />
      <Instances geometry={g.pedestal} material={mats.dark} items={peds} />
      <Instances geometry={g.vase} material={extra.blueWhite} items={vases} />
      <mesh position={[VP.endTable.x, F2 + 0.3, VP.endTable.z]} material={mats.lacquer}><boxGeometry args={[0.7, 0.6, 1.0]} /></mesh>
    </group>
  );
}

/** Reception room with cream armchairs (DDLP_0013, 0076): maroon carpet with cream 壽 rugs, rows of cream armchairs, curtain wall at the back. */
export function CreamReceptionDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const r = R2.creamReception;
  const g = useFurnitureGeos();
  const field = useCanvasMaterial("maroonField", 2048, 2048, drawMaroonField);
  const rugMat = useCanvasMaterial("creamRug", 2048, 1536, drawCreamRug);
  const arms = useMemo(() => mats4(CREAM.armchairs), []);
  const tables = useMemo(() => mats4(CREAM.tables), []);
  const vases = useMemo(() => CREAM.vases.map((v) => M4(v.x, F2 + 0.8, v.z, 0, 1.1, 1.3, 1.1)), []);
  const peds = useMemo(() => mats4(CREAM.vases), []);
  const h = CEIL_F2 - F2 - 0.2;
  return (
    <group>
      <ReceptionShell r={r} mats={mats} extra={extra} windows={[...along(r.x0 + 1, r.x1 - 1, 4, r.z1 - 0.45, Math.PI, 3.0), ...alongZ(-32, -12, 5, r.x1 - 0.45, -Math.PI / 2, 3.2)]} chandeliers={[[37, -23]]} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[37, F2 + 0.02, -23]} material={field} receiveShadow>
        <planeGeometry args={[14.5, 24]} />
      </mesh>
      {CREAM.rugs.map((p) => (
        <mesh key={p.z} rotation={[-Math.PI / 2, 0, Math.PI / 2]} position={[p.x, F2 + 0.028, p.z]} material={rugMat} receiveShadow>
          <planeGeometry args={[4.6, 3.4]} />
        </mesh>
      ))}
      <CurtainBank p={[37, F2 + h / 2, r.z0 + 0.35]} ry={0} w={15.4} h={h} drape={extra.curtainGold} sheer={extra.curtainGold} />
      <Instances geometry={g.arm.body} material={extra.cream} items={arms} castShadow />
      <Instances geometry={g.arm.legs} material={extra.rosewood} items={arms} />
      <Instances geometry={g.lowTable} material={extra.rosewood} items={tables} castShadow />
      <Instances geometry={g.pedestal} material={mats.dark} items={peds} />
      <Instances geometry={g.vase} material={extra.blueWhite} items={vases} />
      {/* a bowl of orchids on the end table (DDLP_0013, 0076) */}
      <mesh position={[37, F2 + 0.65, -33.4]} material={extra.palm}><icosahedronGeometry args={[0.28, 1]} /></mesh>
    </group>
  );
}

/** Office with desk (DDLP_0055, 0122): reeded wood wainscot, landscape painting, desk with blotter and telephones, standing fan, red carpet. */
export function OfficeDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const r = R2.office, o = OFFICE;
  const W = r.x1 - r.x0, D = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
  const g = useFurnitureGeos();
  const chair = useMemo(() => [M4(o.chair.x, F2, o.chair.z, o.chair.ry)], [o]);
  const wainscot = useMemo(() => {
    const t = 1.15, out: THREE.Matrix4[] = [];
    out.push(M4(cx, F2 + t / 2, r.z0 + 0.22, 0, W - 0.4, t, 0.04));
    for (const x of [r.x0 + 0.22, r.x1 - 0.22]) out.push(M4(x, F2 + t / 2, cz, Math.PI / 2, D - 0.4, t, 0.04));
    out.push(M4(r.x0 + 2.4, F2 + t / 2, r.z1 - 0.22, 0, 4.4, t, 0.04), M4(r.x1 - 2.4, F2 + t / 2, r.z1 - 0.22, 0, 4.4, t, 0.04));
    return out;
  }, [r, W, D, cx, cz]);
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, F2 + 0.02, cz]} material={extra.carpetRed} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      <Instances geometry={g.unit} material={extra.woodReeded} items={wainscot} receiveShadow={false} />
      {/* landscape painting in a wide wood frame over the wainscot (illustrative, not a copy) */}
      <Painting p={[cx, F2 + 2.25, r.z0 + 0.3]} ry={0} w={3.8} h={1.75} style="oil" seed={71} frame={mats.wood} />
      {[-3.6, 3.6].map((x) => (
        <group key={x} position={[x, F2 + 3.1, r.z0 + 0.28]}>
          <mesh material={mats.metal}><boxGeometry args={[0.16, 0.5, 0.08]} /></mesh>
          <mesh position={[0, 0, 0.06]} material={extra.glow}><boxGeometry args={[0.12, 0.44, 0.04]} /></mesh>
        </group>
      ))}
      {/* desk: dark polished top, serpentine apron with brass escutcheon, leather blotter, telephones */}
      <group position={[o.desk.x, F2, o.desk.z]}>
        <mesh position={[0, 0.77, 0]} material={extra.rosewood} castShadow><boxGeometry args={[o.desk.w, 0.06, o.desk.d]} /></mesh>
        <mesh position={[0, 0.45, 0]} material={mats.wood} castShadow><boxGeometry args={[o.desk.w - 0.2, 0.55, o.desk.d - 0.15]} /></mesh>
        <mesh position={[0, 0.55, o.desk.d / 2 - 0.07]} material={mats.gold}><boxGeometry args={[0.24, 0.08, 0.02]} /></mesh>
        <mesh position={[0, 0.805, 0.05]} material={mats.dark}><boxGeometry args={[1.1, 0.01, 0.6]} /></mesh>
        {[[0.85, "#d96b80"], [1.05, "#ece3cf"], [-0.9, "#ece3cf"]].map(([x, c]) => (
          <mesh key={x as number} position={[x as number, 0.85, -0.25]}>
            <boxGeometry args={[0.22, 0.09, 0.2]} />
            <meshStandardMaterial color={c as string} roughness={0.35} />
          </mesh>
        ))}
      </group>
      <Instances geometry={g.carved.frame} material={extra.rosewood} items={chair} castShadow />
      <Instances geometry={g.carved.pad} material={extra.damaskYellow} items={chair} />
      {/* standing fan (DDLP_0122) */}
      <group position={[o.fan.x, F2, o.fan.z]}>
        <mesh position={[0, 0.03, 0]} material={extra.fan}><cylinderGeometry args={[0.3, 0.32, 0.05, 16]} /></mesh>
        <mesh position={[0, 0.7, 0]} material={extra.fan}><cylinderGeometry args={[0.025, 0.025, 1.35, 8]} /></mesh>
        <mesh position={[0, 1.45, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={extra.fan}><torusGeometry args={[0.32, 0.012, 6, 32]} /></mesh>
        <mesh position={[0, 1.45, 0]} material={extra.fan}><sphereGeometry args={[0.09, 10, 8]} /></mesh>
      </group>
      {/* red drape at the window corner (DDLP_0122) */}
      <mesh position={[r.x1 - 0.3, F2 + (CEIL_OFFICE - F2) / 2, r.z1 - 2.3]} rotation={[0, -Math.PI / 2, 0]} material={extra.curtainRed}>
        <planeGeometry args={[1.4, CEIL_OFFICE - F2 - 0.2]} />
      </mesh>
    </group>
  );
}

/* ================================================================ courtyard */
/**
 * Inner courtyard (DDLP_0039, 0051, 0171): slate walks and a blue-mosaic pond
 * round a rockery (hòn non bộ) with a miniature tiered pagoda on top, shrubs
 * and broad-leaf plants, a clipped tree, an areca palm, a stone lantern, a
 * granite floor under the gallery and dark navy slatted beams round the opening
 * at the roof. Plants are simple volumes; the composition follows the photos.
 */
export function CourtyardDecor({ mats, extra }: { mats: Mats; extra: Extra }) {
  const C = COURT, O = C.open, G = C.gallery, f1 = LEVEL.f1, roof = LEVEL.roof;
  const geo = useMemo(() => {
    const rock = new THREE.DodecahedronGeometry(1, 0);
    const blob = new THREE.IcosahedronGeometry(1, 1);
    const unit = new THREE.BoxGeometry(1, 1, 1);
    const pondShape = new THREE.Shape();
    // irregular pond on the near side of the garden (DDLP_0039)
    const pts = [[-8.4, -76.6], [-2, -76.4], [3.5, -77.2], [6.2, -78.8], [4, -80.2], [0.5, -79.6], [-3.5, -80.4], [-7.6, -79.8], [-8.6, -78.2]];
    pts.forEach(([x, z], i) => (i ? pondShape.lineTo(x, -z) : pondShape.moveTo(x, -z)));
    const pond = new THREE.ShapeGeometry(pondShape);
    pond.rotateX(-Math.PI / 2);
    return { rock, blob, unit, pond, frond: (() => {
      const g = new THREE.PlaneGeometry(0.5, 2.2, 1, 6);
      const p = g.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const v = p.getY(i) + 1.1;
        p.setXYZ(i, p.getX(i) * (1 - v / 3), v * 0.7 - 0.25 * v * (v / 2.2), v * 0.8);
      }
      g.computeVertexNormals();
      return g;
    })() };
  }, []);
  useEffect(() => () => Object.values(geo).forEach((g) => g.dispose()), [geo]);
  const items = useMemo(() => {
    const R = rng(404);
    const rocks: THREE.Matrix4[] = [], shrubs: THREE.Matrix4[] = [], dark: THREE.Matrix4[] = [], beams: THREE.Matrix4[] = [], edge: THREE.Matrix4[] = [], fronds: THREE.Matrix4[] = [];
    // the rockery: a tall pile of dark weathered stones (centre-left of the garden)
    for (let k = 0; k < 26; k++) {
      const h = R(), a = R() * Math.PI * 2, r = (1 - h) * 2.2;
      const s = 0.5 + (1 - h) * 0.9;
      rocks.push(M4(-2.5 + Math.cos(a) * r, f1 + h * 4.2 + 0.3, -82.5 + Math.sin(a) * r * 0.8, R() * 6, s, s * (1.1 + R()), s));
    }
    // stones edging the pond and the beds
    for (let k = 0; k < 40; k++) {
      const t = k / 40, x = -8.4 + t * 14.6, z = -76.5 - Math.sin(t * Math.PI) * 3.9 - R() * 0.3;
      edge.push(M4(x, f1 + 0.12, z, R() * 6, 0.32 + R() * 0.2, 0.18, 0.28 + R() * 0.2));
    }
    // shrubs and broad-leaf beds round the rockery and along the walks
    for (let k = 0; k < 34; k++) {
      const x = O.x0 + 0.8 + R() * (O.x1 - O.x0 - 1.6), z = O.z0 + 0.8 + R() * 5.2;
      const s = 0.45 + R() * 0.7;
      shrubs.push(M4(x, f1 + s * 0.6, z, R() * 6, s * 1.2, s * 0.8, s));
    }
    // clipped tree crowns (DDLP_0039 left; 0171)
    for (const [x, z, y, s] of [[-6.5, -83.5, 3.2, 1.3], [-6.2, -83.2, 2.2, 1.0], [5.5, -84, 2.6, 1.1], [-2.5, -82.5, 5.0, 0.7]]) shrubs.push(M4(x, f1 + y, z, 0, s * 1.3, s * 0.8, s * 1.3));
    for (const [x, z, h] of [[-6.4, -83.4, 3.2], [5.5, -84, 2.4]]) dark.push(M4(x, f1 + h / 2, z, 0, 0.18, h, 0.18));
    // areca palm by the north-east corner (DDLP_0171)
    dark.push(M4(6.8, f1 + 3.5, -84.6, 0, 0.2, 7, 0.2));
    for (let i = 0; i < 10; i++) fronds.push(M4(6.8, f1 + 7, -84.6, (i / 10) * Math.PI * 2, 1.3, 1.3, 1.3));
    // dark navy slatted beams round the opening at the roof (DDLP_0039, 0051, 0171)
    for (let x = G.x0 + 0.3; x <= G.x1 - 0.3; x += 0.55) {
      beams.push(M4(x, roof - 0.55, (O.z0 + G.z0) / 2 + 0.1, 0, 0.12, 0.42, O.z0 - G.z0 - 0.4));
      beams.push(M4(x, roof - 0.55, (O.z1 + G.z1) / 2, 0, 0.12, 0.42, G.z1 - O.z1 - 0.4));
    }
    for (let z = O.z0; z <= O.z1; z += 0.55) for (const x of [(O.x0 + G.x0) / 2, (O.x1 + G.x1) / 2]) beams.push(M4(x, roof - 0.55, z, 0, G.x1 - O.x1 - 0.4, 0.42, 0.12));
    return { rocks, shrubs, dark, beams, edge, fronds };
  }, [O, G, f1, roof]);
  const pagoda = [0.62, 0.5, 0.4, 0.31, 0.23];
  return (
    <group>
      {/* granite floor of the galleries and the passage (DDLP_0039: pale polished stone) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, f1 + 0.012, (G.z0 + C.passage.z1) / 2]} material={mats.path} receiveShadow>
        <planeGeometry args={[G.x1 - G.x0, C.passage.z1 - G.z0]} />
      </mesh>
      {/* the garden: slate walks, lawn, pond */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[(O.x0 + O.x1) / 2, f1 + 0.02, (O.z0 + O.z1) / 2]} material={extra.slate} receiveShadow>
        <planeGeometry args={[O.x1 - O.x0, O.z1 - O.z0]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-1, f1 + 0.03, -83]} material={extra.lawn} receiveShadow>
        <circleGeometry args={[4.6, 32]} />
      </mesh>
      <mesh geometry={geo.pond} position={[0, f1 + 0.035, 0]} material={extra.mosaicBlue} receiveShadow />
      <mesh geometry={geo.pond} position={[0, f1 + 0.1, 0]} material={extra.water} />
      <Instances geometry={geo.rock} material={mats.dark} items={items.rocks} castShadow />
      <Instances geometry={geo.rock} material={mats.stone} items={items.edge} castShadow />
      <Instances geometry={geo.blob} material={extra.hedge} items={items.shrubs} castShadow />
      <Instances geometry={geo.unit} material={extra.bark} items={items.dark} castShadow />
      <Instances geometry={geo.frond} material={extra.palm} items={items.fronds} castShadow />
      {/* miniature tiered pagoda on the rockery (DDLP_0039, 0051) */}
      {pagoda.map((r, i) => (
        <group key={i} position={[-2.5, f1 + 4.6 + i * 0.36, -82.5]}>
          <mesh position={[0, 0.12, 0]} material={mats.dark}><cylinderGeometry args={[r * 0.55, r * 0.6, 0.24, 8]} /></mesh>
          <mesh position={[0, 0.27, 0]} material={mats.dark}><coneGeometry args={[r, 0.12, 8]} /></mesh>
        </group>
      ))}
      {/* stone lantern beside the pond (DDLP_0171) */}
      <group position={[3.2, f1, -80.6]}>
        <mesh position={[0, 0.35, 0]} material={mats.stone}><cylinderGeometry args={[0.14, 0.2, 0.7, 8]} /></mesh>
        <mesh position={[0, 0.85, 0]} material={mats.stone}><boxGeometry args={[0.5, 0.35, 0.5]} /></mesh>
        <mesh position={[0, 1.15, 0]} material={mats.stone}><coneGeometry args={[0.5, 0.3, 4]} /></mesh>
      </group>
      <Instances geometry={geo.unit} material={extra.navy} items={items.beams} />
    </group>
  );
}
