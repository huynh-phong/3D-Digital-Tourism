import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CITY_BOUNDS, DIORAMA } from "@/lib/city/buildCity";
import { buildOutskirts, distanceToCity, edgeDensity, FADE, onWater, outsideCity, type OutskirtsData } from "@/lib/city/outskirts";

const data: OutskirtsData = JSON.parse(readFileSync("public/data/outskirts.json", "utf8"));
const ring = buildOutskirts(data, "medium");

describe("buffer band around the city (diorama)", () => {
  it("has real roads and water running out of the city", () => {
    expect(data.roads.length).toBeGreaterThan(500);
    expect(data.water.length).toBeGreaterThan(20);
    // the river carries on beyond the city edge
    expect(data.water.some((w) => w.p.some(([x, z]) => distanceToCity(x, z) > 1500))).toBe(true);
    expect(ring.roads.getAttribute("position").count).toBeGreaterThan(1000);
  });

  it("splits lines at the city edge and keeps only the parts outside it", () => {
    const { x0, x1 } = CITY_BOUNDS;
    const pieces = outsideCity([[x0 - 500, 0], [x1 + 500, 0]]);
    expect(pieces.length).toBe(2);
    expect(pieces[0][1][0]).toBeCloseTo(x0);
    expect(pieces[1][0][0]).toBeCloseTo(x1);
  });

  it("lines the buffer band with houses, all on the diorama base", () => {
    const n = ring.houses.length / 7;
    expect(n).toBeGreaterThan(500);
    let near = 0, far = 0;
    for (let i = 0; i < n; i++) {
      const x = ring.houses[i * 7], z = ring.houses[i * 7 + 1];
      const d = distanceToCity(x, z);
      expect(d).toBeGreaterThan(0); // never inside the detailed city
      expect(d).toBeLessThan(FADE); // nothing past the diorama edge
      expect(x > DIORAMA.x0 && x < DIORAMA.x1 && z > DIORAMA.z0 && z < DIORAMA.z1).toBe(true);
      if (d < FADE / 3) near++;
      else if (d > (FADE * 2) / 3) far++;
    }
    // dense next to the city, a little sparser toward the edge
    expect(near).toBeGreaterThan(far);
    expect(edgeDensity(0)).toBe(1);
    expect(edgeDensity(FADE)).toBe(0);
  });

  it("draws the Saigon River as its real outline (no filled-in hull over Thủ Thiêm)", () => {
    // the centre (relation 3850169) and the Thanh Đa loop (relation 3799819)
    expect(data.water.filter((w) => w.n === "Sông Sài Gòn").length).toBeGreaterThanOrEqual(2);
    const river = data.water.find((w) => w.n === "Sông Sài Gòn")!;
    let area = 0;
    for (let i = 0; i < river.p.length; i++) {
      const q = river.p[i], r = river.p[(i + 1) % river.p.length];
      area += q[0] * r[1] - r[0] * q[1];
    }
    expect(Math.abs(area / 2)).toBeGreaterThan(5e6);
    // Thủ Thiêm (inside the river loop) stays dry land
    expect(onWater(data, 1900, 400)).toBe(false);
    // the drawn water area matches the outlines (a convex-hull fallback would be far larger)
    const g = ring.water.getAttribute("position");
    let drawn = 0;
    for (let i = 0; i < g.count; i += 3) {
      const ax = g.getX(i), az = g.getZ(i);
      drawn += Math.abs((g.getX(i + 1) - ax) * (g.getZ(i + 2) - az) - (g.getX(i + 2) - ax) * (g.getZ(i + 1) - az)) / 2;
    }
    let outlines = 0;
    for (const w of data.water) {
      let a2 = 0;
      for (let i = 0; i < w.p.length; i++) {
        const q = w.p[i], r = w.p[(i + 1) % w.p.length];
        a2 += q[0] * r[1] - r[0] * q[1];
      }
      outlines += Math.abs(a2 / 2);
    }
    expect(drawn).toBeLessThan(outlines * 1.25 + 2e6); // + canal ribbons
  });

  it("never puts a house on the water", () => {
    const n = ring.houses.length / 7;
    for (let i = 0; i < n; i += 5) expect(onWater(data, ring.houses[i * 7], ring.houses[i * 7 + 1])).toBe(false);
  });

  it("draws nothing (roads, water, trees) outside the diorama", () => {
    for (const g of [ring.roads, ring.water]) {
      const p = g.getAttribute("position");
      // ribbons may overshoot by half a road width at the clip line
      for (let i = 0; i < p.count; i += 5) {
        expect(p.getX(i)).toBeGreaterThan(DIORAMA.x0 - 20);
        expect(p.getX(i)).toBeLessThan(DIORAMA.x1 + 20);
        expect(p.getZ(i)).toBeGreaterThan(DIORAMA.z0 - 20);
        expect(p.getZ(i)).toBeLessThan(DIORAMA.z1 + 20);
      }
    }
    for (let i = 0; i < ring.trees.length; i += 3) expect(distanceToCity(ring.trees[i], ring.trees[i + 1])).toBeLessThan(FADE);
  });
});
