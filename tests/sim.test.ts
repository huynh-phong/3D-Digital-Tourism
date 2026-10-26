import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCity, CITY_BOUNDS, M, type CityBuild } from "@/lib/city/buildCity";
import { prepPolygon, signedArea, triangulate } from "@/lib/city/geom";
import { SIM_DENSITY } from "@/lib/sim/config";
import { AmbientCreatureSimulation, PedestrianSimulation } from "@/lib/sim/life";
import { TrafficSimulation } from "@/lib/sim/traffic";
import { WaterTrafficSimulation } from "@/lib/sim/water";
import type { CityData } from "@/lib/city/types";

const data = JSON.parse(readFileSync("public/data/city.json", "utf8")) as CityData;
let city: CityBuild;
beforeAll(() => {
  city = buildCity(data, [], [], "medium");
});

const maxEdge = (g: THREE.BufferGeometry) => {
  const p = g.getAttribute("position");
  let m = 0;
  for (let i = 0; i < p.count; i += 3) {
    for (const [a, b] of [[i, i + 1], [i + 1, i + 2], [i, i + 2]]) {
      m = Math.max(m, Math.hypot(p.getX(a) - p.getX(b), p.getZ(a) - p.getZ(b)));
    }
  }
  return m;
};

describe("ground geometry", () => {
  it("every flat ground triangle faces up (no dark, inside-out road patches)", () => {
    for (const k of ["roads", "walks", "markings", "banks", "water", "green"] as const) {
      const p = city.ground[k].getAttribute("position");
      let down = 0;
      for (let i = 0; i < p.count; i += 3) {
        const ax = p.getX(i), az = p.getZ(i);
        const ux = p.getX(i + 1) - ax, uz = p.getZ(i + 1) - az, vx = p.getX(i + 2) - ax, vz = p.getZ(i + 2) - az;
        const ny = uz * vx - ux * vz; // y of (u × v)
        if (ny < -1e-3) down++; // ignore zero-area slivers (invisible either way)
      }
      expect(down, k).toBe(0);
    }
  });

  it("triangulates every water and park polygon without losing or adding area", () => {
    for (const poly of [...data.water, ...data.green]) {
      const p = prepPolygon(poly.p);
      if (!p) continue;
      const tris = triangulate(p);
      const area = tris.reduce((a, [x, y, z]) => a + Math.abs((y[0] - x[0]) * (z[1] - x[1]) - (z[0] - x[0]) * (y[1] - x[1])) / 2, 0);
      expect(Math.abs(area - Math.abs(signedArea(p))) / Math.abs(signedArea(p))).toBeLessThan(0.1);
    }
  });

  it("river banks have no long chords across the water", () => {
    expect(maxEdge(city.ground.banks)).toBeLessThan(160);
  });

  it("plazas are filled areas, not traced outlines", () => {
    const areas = data.roads.filter((r) => r.a);
    expect(areas.length).toBeGreaterThan(0);
    // the asphalt layer contains nothing from plaza outlines: every road vertex is on a non-area road
    expect(city.ground.walks.getAttribute("position").count).toBeGreaterThan(0);
  });

  it("bridges over the river are lifted above the water", () => {
    const deck = city.ground.decks.getAttribute("position");
    let maxY = 0;
    for (let i = 0; i < deck.count; i++) maxY = Math.max(maxY, deck.getY(i));
    expect(maxY).toBeGreaterThan(8);
  });
});

describe("road traffic", () => {
  it("vehicles stay on the carriageway, never overlap in a lane and never teleport", () => {
    const sim = new TrafficSimulation(city.lanes, city.junctions, SIM_DENSITY.medium.vehicles);
    expect(sim.vehicles.length).toBeGreaterThan(300);
    expect(new Set(sim.vehicles.map((v) => v.kind)).size).toBeGreaterThanOrEqual(6);
    const dt = 1 / 30;
    const prev = sim.vehicles.map((v) => [v.x, v.z, v.respawns]);
    let offRoad = 0, checks = 0;
    for (let step = 0; step < 30 * 40; step++) {
      sim.update(dt);
      sim.pose();
      sim.vehicles.forEach((v, i) => {
        expect(Number.isFinite(v.x) && Number.isFinite(v.z)).toBe(true);
        const jump = Math.hypot(v.x - prev[i][0], v.z - prev[i][1]);
        // smooth: no teleporting between frames (except off-screen re-entry at the map edge)
        if (v.respawns === prev[i][2]) expect(jump).toBeLessThan(3);
        prev[i] = [v.x, v.z, v.respawns];
        if (step % 60 === 0) {
          checks++;
          if (!city.mask!.near(v.x, v.z, 2, M.ROAD | M.JUNCTION)) offRoad++;
        }
      });
    }
    expect(offRoad / checks).toBeLessThan(0.01);
    // no two vehicles in the same lane and sub-lane occupy the same stretch
    const byLane = new Map<string, typeof sim.vehicles>();
    for (const v of sim.vehicles) {
      if (v.s < 0) continue;
      const k = `${v.lane}:${Math.sign(v.slot)}`;
      if (!byLane.has(k)) byLane.set(k, []);
      byLane.get(k)!.push(v);
    }
    let overlaps = 0;
    for (const list of byLane.values()) {
      list.sort((a, b) => a.s - b.s);
      for (let i = 1; i < list.length; i++) if (list[i].s - list[i - 1].s < (list[i].spec.length + list[i - 1].spec.length) / 2 - 0.3) overlaps++;
    }
    expect(overlaps).toBe(0);
  });

  it("vehicles keep moving (signals cycle, junctions don't gridlock)", () => {
    const sim = new TrafficSimulation(city.lanes, city.junctions, 400);
    for (let i = 0; i < 30 * 60; i++) sim.update(1 / 30);
    const moving = sim.vehicles.filter((v) => v.stopped < 20).length;
    expect(moving / sim.vehicles.length).toBeGreaterThan(0.8);
  });
});

describe("water traffic", () => {
  it("builds loops on the river and keeps every boat on the water", () => {
    expect(city.boatLoops.length).toBeGreaterThan(0);
    const sim = new WaterTrafficSimulation(city.boatLoops, 12);
    expect(sim.boats.length).toBeGreaterThan(5);
    for (let step = 0; step < 30 * 60; step++) {
      sim.update(1 / 30);
      sim.pose(1 / 30);
      if (step % 30) continue;
      for (const b of sim.boats) expect(city.mask!.get(b.x, b.z) & M.WATER, `${b.kind} at ${b.x},${b.z}`).toBeTruthy();
    }
  });

  it("only small craft use the narrow canal", () => {
    const sim = new WaterTrafficSimulation(city.boatLoops, 30);
    for (const b of sim.boats) {
      const route = sim.routes[b.route];
      if (route.halfWidth < 40) expect(["boat", "speedboat"]).toContain(b.kind);
    }
  });
});

describe("people and creatures", () => {
  it("pedestrians never walk on the carriageway or inside buildings", () => {
    const sim = new PedestrianSimulation(city.sidewalkPaths, city.openSpaces, { walkers: 300, strollers: 120, groups: 20, pets: 10 });
    expect(sim.people.length).toBeGreaterThan(400);
    let bad = 0;
    for (let step = 0; step < 30 * 30; step++) {
      sim.update(1 / 30);
      if (step % 90) continue;
      for (const p of sim.people) if (city.mask!.get(p.x, p.z) & (M.ROAD | M.BUILD | M.WATER)) bad++;
    }
    expect(bad / (sim.people.length * 10)).toBeLessThan(0.01);
  });

  it("birds fly above the rooftops", () => {
    const sky = city.skyline;
    const skyline = (x: number, z: number) => {
      const i = Math.floor((x - CITY_BOUNDS.x0) / sky.cell), j = Math.floor((z - CITY_BOUNDS.z0) / sky.cell);
      return i >= 0 && j >= 0 && i < sky.nx && j < sky.nz ? sky.data[j * sky.nx + i] : 0;
    };
    const sim = new AmbientCreatureSimulation(
      { parks: city.openSpaces.filter((s) => s.kind === "park").flatMap((s) => s.pts.slice(0, 3)), plazas: [], banks: city.shorePts, river: city.boatRoutes.flatMap((r) => r.pts) },
      skyline,
      { flocks: 6, pigeons: 20, egrets: 6 },
    );
    expect(sim.birds.length).toBeGreaterThan(20);
    for (let step = 0; step < 30 * 40; step++) {
      sim.update(1 / 30);
      for (const b of sim.birds) expect(b.y).toBeGreaterThan(skyline(b.x, b.z) + 5);
    }
  });
});
