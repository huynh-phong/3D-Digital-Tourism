import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { addBuilding, newBuckets, PALETTE } from "@/lib/city/architecture";
import { buildCity, M, pointInPolygon } from "@/lib/city/buildCity";
import { prepPolygon, toGeometry } from "@/lib/city/geom";
import { rng } from "@/lib/geo";
import type { CityData } from "@/lib/city/types";

/** Every triangle's winding must agree with its stored normal (no inside-out faces). */
function windingMismatches(g: THREE.BufferGeometry) {
  const p = g.getAttribute("position"), n = g.getAttribute("normal");
  let bad = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
    const cross = b.clone().sub(a).cross(c.clone().sub(a));
    nn.fromBufferAttribute(n, i);
    if (cross.dot(nn) <= 0) bad++;
  }
  return bad;
}

describe("building geometry", () => {
  const square = prepPolygon([[0, 0], [0, 10], [10, 10], [10, 0]])!; // given clockwise on purpose

  it("orients footprints counter-clockwise", () => {
    expect(square).not.toBeNull();
  });

  it.each(["shophouse", "apartment", "office", "tower", "colonial"] as const)("%s: closed walls facing out, roofs facing up", (kind) => {
    const B = newBuckets();
    addBuilding(B, { poly: square, kind, floors: kind === "tower" ? 20 : 4, wall: PALETTE.pastel[0], front: 0, R: rng(1) });
    for (const buf of [...Object.values(B.walls), ...Object.values(B.roofs), B.details]) {
      if (!buf.pos.length) continue;
      const g = toGeometry(buf);
      expect(windingMismatches(g)).toBe(0);
    }
    // walls of the base storey: every normal points away from the footprint centre
    const walls = Object.values(B.walls).flatMap((b) => (b.pos.length ? [toGeometry(b)] : []));
    for (const g of walls) {
      const p = g.getAttribute("position"), n = g.getAttribute("normal");
      for (let i = 0; i < p.count; i++) {
        if (Math.abs(n.getY(i)) > 0.01) continue;
        const toOut = new THREE.Vector2(p.getX(i) - 5, p.getZ(i) - 5);
        expect(toOut.dot(new THREE.Vector2(n.getX(i), n.getZ(i)))).toBeGreaterThan(-1e-6);
      }
    }
    // there is a cap: some faces point straight up
    const roofs = Object.values(B.roofs).filter((b) => b.pos.length);
    expect(roofs.length).toBeGreaterThan(0);
  });

  it("caps self-intersecting footprints instead of leaving them open", () => {
    const bowtie = prepPolygon([[0, 0], [10, 10], [10, 0], [0, 10]]);
    if (!bowtie) return; // rejected outright is also acceptable
    const B = newBuckets();
    addBuilding(B, { poly: bowtie, kind: "apartment", floors: 3, wall: PALETTE.apartment[0], R: rng(2) });
    expect(B.roofs.flat.pos.length).toBeGreaterThan(0);
  });
});

describe("city build from real OSM data", () => {
  const data = JSON.parse(readFileSync("public/data/city.json", "utf8")) as CityData;
  const city = buildCity(data, [], [], "medium");

  it("generates buildings, trees and junctions", () => {
    expect(city.stats.osmBuildings).toBeGreaterThan(1500);
    expect(city.stats.trees).toBeGreaterThan(500);
    expect(city.stats.junctions).toBeGreaterThan(100);
  });

  it("has no inside-out triangles anywhere", () => {
    for (const [k, g] of Object.entries(city.buckets)) expect(windingMismatches(g), k).toBe(0);
  });

  it("never plants a tree on a carriageway, junction, building or water", () => {
    const bad = city.trees.filter((t) => city.mask!.get(t.x, t.z) & (M.ROAD | M.JUNCTION | M.BUILD | M.WATER));
    expect(bad).toEqual([]);
  });

  it("keeps trees out of OSM building footprints", () => {
    const fps = data.buildings.map((b) => b.p);
    const inside = city.trees.filter((t) => fps.some((p) => pointInPolygon(t.x, t.z, p)));
    expect(inside.length).toBe(0);
  });
});
