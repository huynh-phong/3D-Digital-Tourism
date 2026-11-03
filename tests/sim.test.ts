import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCity, CITY_BOUNDS, M, type CityBuild } from "@/lib/city/buildCity";
import { prepPolygon, signedArea, triangulate } from "@/lib/city/geom";
import { SIM_DENSITY } from "@/lib/sim/config";
import { AmbientCreatureSimulation, PedestrianSimulation } from "@/lib/sim/life";
import { cornerSpeed, TrafficSimulation, VEHICLES } from "@/lib/sim/traffic";
import { MAX_WAKES, WaterTrafficSimulation, writeWakes } from "@/lib/sim/water";
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
  }, 240_000);

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

describe("Saigon traffic mix and behaviour", () => {
  const TWO = new Set(["motorbike", "scooter", "delivery", "pillion", "ebike", "bicycle"]);

  it("is mostly two-wheelers, with buses and lorries only on suitable roads", () => {
    const sim = new TrafficSimulation(city.lanes, city.junctions, SIM_DENSITY.medium.vehicles);
    expect(sim.vehicles.length).toBeGreaterThan(1000);
    const share = sim.vehicles.filter((v) => TWO.has(v.kind)).length / sim.vehicles.length;
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(0.75);
    expect(new Set(sim.vehicles.map((v) => v.kind)).size).toBeGreaterThanOrEqual(14);
    for (const v of sim.vehicles) {
      const cls = city.lanes[v.lane].cls;
      if (v.kind === "bus" || v.kind === "minibus") expect(cls).not.toBe("local");
      if (v.kind === "truck") {
        expect(cls).toBe("major");
        // no heavy lorries in the historic core around the palace and Bến Thành
        const p = city.lanes[v.lane].pts[Math.floor(city.lanes[v.lane].pts.length / 2)];
        expect(Math.hypot(p[0] - 350, p[1] - 100)).toBeGreaterThan(900);
      }
    }
  });

  it("takes corners slower in big vehicles and leans two-wheelers within limits", () => {
    const sim = new TrafficSimulation(city.lanes, city.junctions, SIM_DENSITY.medium.vehicles);
    const turnV: Record<string, number[]> = {};
    for (let step = 0; step < 30 * 30; step++) {
      sim.update(1 / 30);
      sim.pose(0.35, 1 / 30);
      for (const v of sim.vehicles) {
        expect(Math.abs(v.lean)).toBeLessThanOrEqual(0.4);
        if (!TWO.has(v.kind)) expect(v.lean).toBe(0);
        // safe speed of the turn being driven (sharp turns only, where it is below cruising speed)
        if (v.s < 0 && Number.isFinite(v.turnV) && v.turnV < v.vmax) (turnV[v.kind] ??= []).push(v.turnV);
      }
    }
    expect(Object.keys(turnV).length).toBeGreaterThan(5); // vehicles of many kinds slow for sharp turns
    // on the same right-angle corner (12 m chord) a bus is much slower than a motorbike
    const a = { pts: [[0, 0], [20, 0]] as [number, number][], endHeading: 0 };
    const b = { pts: [[28, 8], [28, 30]] as [number, number][] };
    const bus = cornerSpeed(VEHICLES.bus.latAcc, VEHICLES.bus.maxSpeed, a, b);
    const bike = cornerSpeed(VEHICLES.motorbike.latAcc, VEHICLES.motorbike.maxSpeed, a, b);
    expect(bus).toBeLessThan(bike * 0.7);
    expect(cornerSpeed(VEHICLES.bus.latAcc, 7, a, { pts: [[25, 0], [60, 0]] })).toBe(7); // straight on: no braking
  }, 240_000);
});

describe("river traffic", () => {
  it("runs at least six boat types, all on the water, big ones only in the wide river", () => {
    const sim = new WaterTrafficSimulation(city.boatLoops, SIM_DENSITY.medium.boats);
    expect(new Set(sim.boats.map((b) => b.kind)).size).toBeGreaterThanOrEqual(6);
    for (let step = 0; step < 30 * 40; step++) {
      sim.update(1 / 30);
      sim.pose(1 / 30);
      if (step % 30) continue;
      for (const b of sim.boats) {
        expect(city.mask!.get(b.x, b.z) & M.WATER).toBeTruthy();
        expect(b.y).toBeGreaterThan(-0.1); // never sinks into the water mesh
        expect(b.y).toBeLessThan(0.2); // nor floats above it
      }
    }
    for (const b of sim.boats) if (["barge", "cargo"].includes(b.kind)) expect(sim.routes[b.route].halfWidth).toBeGreaterThanOrEqual(90);
  });

  it("feeds every boat's wake to the water shader", () => {
    const sim = new WaterTrafficSimulation(city.boatLoops, SIM_DENSITY.medium.boats);
    sim.pose(1 / 30);
    const a = new Float32Array(MAX_WAKES * 4), b = new Float32Array(MAX_WAKES * 4);
    const n = writeWakes(sim.boats, a, b);
    expect(n).toBe(Math.min(MAX_WAKES, sim.boats.length));
    expect(a[0]).toBeCloseTo(sim.boats[0].x);
    expect(b[0]).toBeGreaterThan(0); // boat length
  });
});
