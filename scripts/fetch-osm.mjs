// Fetches OpenStreetMap data (ODbL) for central Saigon via Overpass and writes a
// compact, pre-projected JSON used by the 3D city map.
//
//   node scripts/fetch-osm.mjs
//
// Output: public/data/city.json  — coordinates in metres, origin = Dinh Độc Lập,
// +x = east, +z = south (three.js convention: north is -z).
import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

// Detailed city: District 1/3 core plus Thảo Cầm Viên, Ba Son and Landmark 81 (Bình Thạnh).
const BBOX = { s: 10.7655, w: 106.6875, n: 10.7995, e: 106.7265 };
// Origin: centre of the Independence Palace main building (OSM way "Dinh Độc Lập").
export const ORIGIN = { lat: 10.777017, lon: 106.695403 }; // OSM way 39598493 centroid

const R = 6378137;
const project = (lat, lon) => {
  const x = ((lon - ORIGIN.lon) * Math.PI) / 180 * R * Math.cos((ORIGIN.lat * Math.PI) / 180);
  const y = ((lat - ORIGIN.lat) * Math.PI) / 180 * R;
  return [Math.round(x * 10) / 10, Math.round(-y * 10) / 10];
};

const B = `(${BBOX.s},${BBOX.w},${BBOX.n},${BBOX.e})`;
const queries = [
  `[out:json][timeout:180];(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|primary_link|secondary_link|tertiary_link|trunk_link)$"]${B};
  way["natural"="water"]${B};
  relation["natural"="water"]${B};
  way["waterway"="riverbank"]${B};
  way["leisure"="park"]${B};
  way["landuse"="grass"]${B};
  way["man_made"="bridge"]${B};
  way["landuse"]${B};
  way["leisure"~"^(garden|playground|pitch|zoo|theme_park|water_park)$"]${B};
  way["tourism"~"^(zoo|theme_park|attraction)$"]${B};
  way["amenity"~"^(parking|school|university|hospital)$"]${B};
);out tags geom;`,
  `[out:json][timeout:180];(way["building"]${B};);out tags geom;`,
];

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
  const json = await runQueryRemote(q);
  writeFileSync(file, JSON.stringify(json));
  return json;
}

async function runQueryRemote(q) {
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of endpoints) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "saigon3d-build/0.1" },
          body: "data=" + encodeURIComponent(q),
        });
        if (!res.ok) throw new Error(String(res.status));
        return await res.json();
      } catch (e) {
        console.warn("Overpass failed:", url, e.message);
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("All Overpass endpoints failed");
}

const elements = [];
// Water-body centrelines for boat routes (river + canals).
const waterwayQuery = `[out:json][timeout:180];(way["waterway"~"^(river|canal)$"]${B};);out tags geom;`;
for (const q of queries) elements.push(...(await runQuery(q)).elements);

const ways = elements.filter((e) => e.type === "way");
const coords = (w) => (w.geometry || []).filter(Boolean).map((n) => project(n.lat, n.lon));

const ROAD_WIDTH = {
  motorway: 24, trunk: 22, primary: 18, secondary: 14, tertiary: 11, trunk_link: 10,
  primary_link: 10, secondary_link: 9, tertiary_link: 8, unclassified: 7, residential: 6,
  living_street: 5, pedestrian: 10,
};

const roads = [];
const buildings = [];
const water = [];
const green = [];
const landuse = [];
const bridges = [];

const parseHeight = (t) => {
  if (t.height) {
    const h = parseFloat(t.height);
    if (!Number.isNaN(h)) return { h, src: "osm" };
  }
  if (t["building:levels"]) {
    const l = parseFloat(t["building:levels"]);
    if (!Number.isNaN(l)) return { h: l * 3.4, src: "levels" };
  }
  return { h: 0, src: "none" };
};

for (const w of ways) {
  const t = w.tags || {};
  if (!t) continue;
  const c = coords(w);
  if (c.length < 2) continue;
  if (t.highway) {
    if (t.tunnel && t.tunnel !== "no") continue; // underground (e.g. Thủ Thiêm tunnel)
    const closed = c.length > 3 && c[0][0] === c[c.length - 1][0] && c[0][1] === c[c.length - 1][1];
    roads.push({
      k: t.highway,
      w: ROAD_WIDTH[t.highway] ?? 6,
      n: t.name || undefined,
      b: t.bridge && t.bridge !== "no" ? 1 : undefined,
      // oneway: 1 = along the geometry, -1 = against it
      o: t.oneway === "yes" || t.oneway === "true" || t.oneway === "1" || t.junction === "roundabout" ? 1 : t.oneway === "-1" ? -1 : undefined,
      l: t.layer && parseInt(t.layer, 10) ? parseInt(t.layer, 10) : undefined,
      // closed pedestrian ways are squares/plazas (areas), not loop paths
      a: closed && (t.area === "yes" || t.highway === "pedestrian") ? 1 : undefined,
      p: c,
    });
  } else if (t.building) {
    if (c.length < 4) continue;
    const { h, src } = parseHeight(t);
    buildings.push({ h: Math.round(h * 10) / 10, s: src === "none" ? undefined : 1, n: t.name || undefined, p: c.slice(0, -1) });
  } else if (t.natural === "water" || t.waterway === "riverbank") {
    water.push({ p: c });
  } else if (t.leisure === "park" || t.landuse === "grass" || t.leisure === "garden" || t.tourism === "zoo" || t.leisure === "zoo") {
    green.push({ n: t.name || undefined, p: c });
  } else if (t.landuse || t.leisure || t.tourism || t.amenity) {
    // land use of gaps between footprints: decides what (if anything) may fill them
    if (c.length < 4) continue;
    const k = t.landuse || t.leisure || t.tourism || t.amenity;
    landuse.push({ k, n: t.name || undefined, p: c.slice(0, -1) });
  } else if (t.man_made === "bridge") {
    bridges.push({ p: c });
  }
}

// Multipolygon water relations (Saigon River): stitch outer members into rings.
const key = (pt) => pt[0] + "," + pt[1];
// Clip a ring to the (padded) bbox rectangle — Sutherland–Hodgman.
const PAD = 400;
const corners = [project(BBOX.n, BBOX.w), project(BBOX.s, BBOX.e)];
const RECT = { x0: corners[0][0] - PAD, z0: corners[0][1] - PAD, x1: corners[1][0] + PAD, z1: corners[1][1] + PAD };
function clipRing(pts) {
  const edges = [
    [(p) => p[0] >= RECT.x0, (a, b) => { const t = (RECT.x0 - a[0]) / (b[0] - a[0]); return [RECT.x0, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[0] <= RECT.x1, (a, b) => { const t = (RECT.x1 - a[0]) / (b[0] - a[0]); return [RECT.x1, a[1] + t * (b[1] - a[1])]; }],
    [(p) => p[1] >= RECT.z0, (a, b) => { const t = (RECT.z0 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), RECT.z0]; }],
    [(p) => p[1] <= RECT.z1, (a, b) => { const t = (RECT.z1 - a[1]) / (b[1] - a[1]); return [a[0] + t * (b[0] - a[0]), RECT.z1]; }],
  ];
  let out = pts;
  for (const [inside, cut] of edges) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      if (inside(cur)) {
        if (!inside(prev)) out.push(cut(prev, cur));
        out.push(cur);
      } else if (inside(prev)) out.push(cut(prev, cur));
    }
    if (!out.length) break;
  }
  return out.map((p) => [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10]);
}

// 3850169 = "Sông Sài Gòn" multipolygon (found with an is_in query at 10.778,106.7095).
const relIds = [...new Set([3850169, ...elements.filter((e) => e.type === "relation" && e.tags?.natural === "water").map((e) => e.id)])];
const fullRels = [];
for (const id of relIds) fullRels.push(...(await runQuery(`[out:json][timeout:180];rel(${id});out tags geom;`)).elements);

for (const el of fullRels) {
  if (el.type !== "relation" || el.tags?.natural !== "water") continue;
  const segs = (el.members || [])
    .filter((m) => m.type === "way" && m.role === "outer" && m.geometry)
    .map((m) => m.geometry.filter(Boolean).map((n) => project(n.lat, n.lon)));
  while (segs.length) {
    let ring = segs.shift();
    let grown = true;
    while (grown && key(ring[0]) !== key(ring[ring.length - 1])) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const s2 = segs[i];
        const end = key(ring[ring.length - 1]);
        if (key(s2[0]) === end) ring = ring.concat(s2.slice(1));
        else if (key(s2[s2.length - 1]) === end) ring = ring.concat(s2.slice(0, -1).reverse());
        else continue;
        segs.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length > 3 && key(ring[0]) === key(ring[ring.length - 1])) {
      const clipped = clipRing(ring.slice(0, -1));
      if (clipped.length > 2) water.push({ p: clipped, n: el.tags.name });
    }
  }
}

const waterways = [];
try {
  for (const w of (await runQuery(waterwayQuery)).elements) {
    if (w.type !== "way" || !w.geometry) continue;
    waterways.push({ k: w.tags?.waterway, n: w.tags?.name, p: w.geometry.filter(Boolean).map((n) => project(n.lat, n.lon)) });
  }
} catch (e) {
  console.warn("waterway centrelines unavailable:", e.message);
}

const out = {
  attribution: "© OpenStreetMap contributors, ODbL 1.0 — https://www.openstreetmap.org/copyright",
  fetchedAt: new Date().toISOString(),
  bbox: BBOX,
  origin: ORIGIN,
  units: "metres; +x east, +z south",
  roads,
  buildings,
  water,
  green,
  landuse,
  bridges,
  waterways,
};
mkdirSync("public/data", { recursive: true });
writeFileSync("public/data/city.json", JSON.stringify(out));
console.log({ landuse: landuse.length, roads: roads.length, buildings: buildings.length, water: water.length, green: green.length, bridges: bridges.length });
