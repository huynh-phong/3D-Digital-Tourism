// Fetches the open land around the detailed city (ODbL): the main roads and
// the water (river, canals, lakes) in a ~3 km ring, so they run on past the
// edge of the city. No buildings — the ring is open ground the map can later
// grow into.
//
//   node scripts/fetch-outskirts.mjs
//
// Output: public/data/outskirts.json — same projection as city.json (metres,
// origin = Dinh Độc Lập, +x east, +z south). Queries are cached in scripts/.osm-cache.
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const ORIGIN = { lat: 10.777017, lon: 106.695403 };
// detailed city bbox (scripts/fetch-osm.mjs) grown by ~3 km on every side
const CITY = { s: 10.7655, w: 106.6875, n: 10.7995, e: 106.7265 };
const RING = { s: CITY.s - 0.027, w: CITY.w - 0.0275, n: CITY.n + 0.027, e: CITY.e + 0.0275 };

const R = 6378137;
const project = (lat, lon) => {
  const x = ((lon - ORIGIN.lon) * Math.PI) / 180 * R * Math.cos((ORIGIN.lat * Math.PI) / 180);
  const y = ((lat - ORIGIN.lat) * Math.PI) / 180 * R;
  return [Math.round(x * 2) / 2, Math.round(-y * 2) / 2];
};

const endpoints = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
const CACHE = "scripts/.osm-cache";
async function runQuery(q) {
  mkdirSync(CACHE, { recursive: true });
  const file = `${CACHE}/${createHash("sha1").update(q).digest("hex")}.json`;
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "saigon3d-build/0.1" },
          body: "data=" + encodeURIComponent(q),
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = await res.json();
        writeFileSync(file, JSON.stringify(json));
        return json;
      } catch (e) {
        console.warn("Overpass failed:", url, e.message);
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("All Overpass endpoints failed");
}

const B = `(${RING.s},${RING.w},${RING.n},${RING.e})`;
const geom = (g) => (g || []).filter(Boolean).map((n) => project(n.lat, n.lon));
const [c0, c1] = [project(RING.n, RING.w), project(RING.s, RING.e)];
const RECT = { x0: c0[0], z0: c0[1], x1: c1[0], z1: c1[1] };

function clipRing(pts) {
  const edges = [
    [(p) => p[0] >= RECT.x0, (a, b) => [RECT.x0, a[1] + ((RECT.x0 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[0] <= RECT.x1, (a, b) => [RECT.x1, a[1] + ((RECT.x1 - a[0]) / (b[0] - a[0])) * (b[1] - a[1])]],
    [(p) => p[1] >= RECT.z0, (a, b) => [a[0] + ((RECT.z0 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), RECT.z0]],
    [(p) => p[1] <= RECT.z1, (a, b) => [a[0] + ((RECT.z1 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]), RECT.z1]],
  ];
  let out = pts;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out.map((p) => [Math.round(p[0] * 2) / 2, Math.round(p[1] * 2) / 2]);
}

const ROAD_WIDTH = { motorway: 24, trunk: 22, primary: 18, secondary: 14, tertiary: 11, motorway_link: 9, trunk_link: 10, primary_link: 10, secondary_link: 9, tertiary_link: 8 };

const roads = [];
for (const w of (await runQuery(`[out:json][timeout:240];(way["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]${B};);out tags geom;`)).elements) {
  if (w.type !== "way" || (w.tags.tunnel && w.tags.tunnel !== "no")) continue;
  const p = geom(w.geometry);
  if (p.length < 2) continue;
  const oneway = w.tags.oneway === "yes" || w.tags.junction === "roundabout";
  const width = ROAD_WIDTH[w.tags.highway] ?? 10;
  roads.push({ k: w.tags.highway, w: oneway ? Math.max(6, Math.round(width * 0.6)) : width, b: w.tags.bridge && w.tags.bridge !== "no" ? 1 : undefined, p });
}

// Minor streets in a ~1 km band around the city, so its street grid carries on
// and ends where the real streets end instead of at a straight line.
const NEAR = `(${CITY.s - 0.009},${CITY.w - 0.009},${CITY.n + 0.009},${CITY.e + 0.009})`;
const MINOR_WIDTH = { unclassified: 7, residential: 6, living_street: 5 };
const minor = [];
for (const w of (await runQuery(`[out:json][timeout:240];(way["highway"~"^(unclassified|residential|living_street)$"]${NEAR};);out tags geom;`)).elements) {
  if (w.type !== "way") continue;
  const p = geom(w.geometry);
  if (p.length > 1) minor.push({ k: w.tags.highway, w: MINOR_WIDTH[w.tags.highway] ?? 6, p });
}

const water = [];
const els = (await runQuery(`[out:json][timeout:240];(way["natural"="water"]${B};way["waterway"="riverbank"]${B};relation["natural"="water"]${B};);out tags geom;`)).elements;
const key = (q) => q[0] + "," + q[1];
// The Saigon River is mapped as several multipolygons that the bbox query does
// not return: 3850169 (the centre, same as city.json) and 3799819 (the Thanh Đa
// loop, found with is_in on the river there). They are fetched by id.
els.push(...(await runQuery(`[out:json][timeout:180];rel(3850169);out tags geom;`)).elements);
// ("out geom" with full body: the tags-only form returns no members for this one)
els.push(...(await runQuery(`[out:json][timeout:180];rel(3799819);out geom;`)).elements);
for (const el of els) {
  if (el.type === "way") {
    const p = geom(el.geometry);
    if (p.length > 3) {
      const c = clipRing(p.slice(0, -1));
      if (c.length > 2) water.push({ p: c });
    }
    continue;
  }
  // multipolygon: stitch outer members into closed rings
  const segs = (el.members || []).filter((m) => m.type === "way" && m.role === "outer" && m.geometry).map((m) => geom(m.geometry));
  while (segs.length) {
    let ring = segs.shift();
    let grown = true;
    while (grown && key(ring[0]) !== key(ring[ring.length - 1])) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const s2 = segs[i], end = key(ring[ring.length - 1]);
        if (key(s2[0]) === end) ring = ring.concat(s2.slice(1));
        else if (key(s2[s2.length - 1]) === end) ring = ring.concat(s2.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring[ring.length - 1])) {
      const c = clipRing(ring.slice(0, -1));
      if (c.length > 2) water.push({ p: c, n: el.tags?.name });
    }
  }
}

// narrow canals often have only a centreline
const waterways = [];
for (const w of (await runQuery(`[out:json][timeout:240];(way["waterway"~"^(river|canal|stream)$"]${B};);out tags geom;`)).elements) {
  if (w.type !== "way") continue;
  const p = geom(w.geometry);
  if (p.length > 1) waterways.push({ k: w.tags.waterway, n: w.tags.name || undefined, p });
}

const out = {
  attribution: "© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
  fetchedAt: new Date().toISOString(),
  bbox: RING,
  rect: RECT,
  units: "metres; +x east, +z south",
  roads,
  minor,
  water,
  waterways,
};
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/outskirts.json", JSON.stringify(out));
console.log({ minor: minor.length, roads: roads.length, water: water.length, waterways: waterways.length, rect: RECT });
