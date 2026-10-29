import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { CONTEXT_BUILDINGS, LANDMARKS, project } from "@/data/landmarks";
import { buildCity, CITY_BOUNDS, clipPolyline, edgeKeep, pointInPolygon, type CityBuild } from "@/lib/city/buildCity";
import type { CityData } from "@/lib/city/types";

const city: CityData = JSON.parse(readFileSync("public/data/city.json", "utf8"));
const inCity = ([x, z]: [number, number], pad = 0) =>
  x > CITY_BOUNDS.x0 + pad && x < CITY_BOUNDS.x1 - pad && z > CITY_BOUNDS.z0 + pad && z < CITY_BOUNDS.z1 - pad;

describe("the central-map landmarks", () => {
  it("are exactly the ten places of the central map, once each", () => {
    expect(LANDMARKS.map((l) => l.id).sort()).toEqual(
      ["dinh-doc-lap", "nha-tho-duc-ba", "buu-dien", "chung-tich-chien-tranh", "cho-ben-thanh", "ben-nha-rong", "thao-cam-vien", "landmark-81", "bitexco", "cau-ba-son"].sort(),
    );
    expect(new Set(LANDMARKS.map((l) => l.osm)).size).toBe(LANDMARKS.length);
    expect(new Set(LANDMARKS.map((l) => l.name.vi)).size).toBe(LANDMARKS.length);
    // places outside the map are gone, and context buildings are never listed
    for (const id of ["dia-dao-cu-chi", "suoi-tien", "dam-sen"]) expect(LANDMARKS.some((l) => l.id === id)).toBe(false);
    for (const c of CONTEXT_BUILDINGS) expect(LANDMARKS.some((l) => l.id === c.id)).toBe(false);
  });

  it("only the Independence Palace can be visited", () => {
    const open = LANDMARKS.filter((l) => l.status === "available");
    expect(open.map((l) => l.id)).toEqual(["dinh-doc-lap"]);
    expect(open[0].route).toBe("/dinh-doc-lap");
    for (const l of LANDMARKS) if (l.status !== "available") expect(l.route).toBeUndefined();
  });

  it("all lie well inside the map frame, with bilingual names and a reference link", () => {
    for (const l of LANDMARKS) {
      expect(l.name.vi && l.name.en && l.short.vi && l.short.en && l.blurb.vi && l.blurb.en).toBeTruthy();
      expect(l.ref.url).toMatch(/^https:\/\//);
      expect(inCity(project(l.lat, l.lon), 200)).toBe(true);
    }
  });

  it("keep their real geographic relations", () => {
    const P = Object.fromEntries(LANDMARKS.map((l) => [l.id, project(l.lat, l.lon)]));
    const km = (a: string, b: string) => Math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1]) / 1000;
    expect(km("nha-tho-duc-ba", "buu-dien")).toBeLessThan(0.2); // across the square
    expect(km("dinh-doc-lap", "nha-tho-duc-ba")).toBeLessThan(0.6);
    expect(P["chung-tich-chien-tranh"][0]).toBeLessThan(0); // west of the palace
    // Landmark 81 is north-east of the centre, beyond the Thị Nghè canal
    expect(P["landmark-81"][0]).toBeGreaterThan(2500);
    expect(P["landmark-81"][1]).toBeLessThan(-1800);
  });

  it("put Ba Son bridge and Nhà Rồng on the river, Landmark 81 on its OSM footprint", () => {
    const river = city.water.filter((w) => w.n === "Sông Sài Gòn");
    const bridge = LANDMARKS.find((l) => l.id === "cau-ba-son")!;
    const [bx, bz] = project(bridge.lat, bridge.lon);
    expect(river.some((w) => pointInPolygon(bx, bz, w.p))).toBe(true);
    expect(city.roads.some((r) => r.n === "Cầu Ba Son" && r.b)).toBe(true);
    const nr = LANDMARKS.find((l) => l.id === "ben-nha-rong")!;
    const [nx, nz] = project(nr.lat, nr.lon);
    let near = false;
    for (let a = 0; a < Math.PI * 2 && !near; a += Math.PI / 16) near = river.some((w) => pointInPolygon(nx + Math.cos(a) * 150, nz + Math.sin(a) * 150, w.p));
    expect(near).toBe(true);
    const l81 = LANDMARKS.find((l) => l.id === "landmark-81")!;
    const [lx, lz] = project(l81.lat, l81.lon);
    const tall = city.buildings.filter((b) => b.h > 400);
    expect(tall.length).toBe(1);
    const c = tall[0].p.reduce((s, q) => [s[0] + q[0] / tall[0].p.length, s[1] + q[1] / tall[0].p.length], [0, 0]);
    expect(Math.hypot(c[0] - lx, c[1] - lz)).toBeLessThan(90);
  });
});

describe("map frame", () => {
  let built: CityBuild;
  beforeAll(() => {
    built = buildCity(city, [], [], "low");
  });

  it("clips polylines at the frame, splitting lines that leave and come back", () => {
    const { x0, x1 } = CITY_BOUNDS;
    const pieces = clipPolyline([[x0 - 100, 0], [x0 + 100, 0], [x0 + 100, CITY_BOUNDS.z1 + 50], [x1 - 100, CITY_BOUNDS.z1 + 50], [x1 - 100, 0]]);
    expect(pieces.length).toBe(2);
    expect(pieces[0][0][0]).toBeCloseTo(x0);
    for (const p of pieces) for (const q of p) expect(inCity(q, -0.01)).toBe(true);
  });

  it("no street, water or ground decal reaches beyond the frame", () => {
    const pad = 15; // half the widest street ribbon (with sidewalks) at its end cap
    // (parks keep their real outline, so "green" may reach a little past the frame)
    for (const k of ["roads", "walks", "water"] as const) {
      const p = built.ground[k].getAttribute("position");
      for (let i = 0; i < p.count; i += 7) expect(inCity([p.getX(i), p.getZ(i)], -pad)).toBe(true);
    }
  });

  it("thins the city out toward its edge instead of cutting it straight", () => {
    expect(edgeKeep(1250, -620)).toBe(1); // centre
    expect(edgeKeep(CITY_BOUNDS.x0 + 5, -620)).toBe(0); // right at the frame
    // the fade line wiggles: along one side the kept share varies
    const along = Array.from({ length: 40 }, (_, i) => edgeKeep(CITY_BOUNDS.x0 + 200, CITY_BOUNDS.z0 + 200 + i * 80));
    expect(Math.max(...along) - Math.min(...along)).toBeGreaterThan(0.3);
    // every landmark stands where the city is whole
    for (const l of LANDMARKS) expect(edgeKeep(...project(l.lat, l.lon))).toBeGreaterThan(0.8);
  });

  it("does not trace the frame as a riverbank", () => {
    const p = built.ground.banks.getAttribute("position");
    let onEdge = 0;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      if (Math.min(Math.abs(x - CITY_BOUNDS.x0), Math.abs(x - CITY_BOUNDS.x1), Math.abs(z - CITY_BOUNDS.z0), Math.abs(z - CITY_BOUNDS.z1)) < 0.5) onEdge++;
    }
    // only the few vertices where a real bank meets the frame
    expect(onEdge / p.count).toBeLessThan(0.01);
  });
});
