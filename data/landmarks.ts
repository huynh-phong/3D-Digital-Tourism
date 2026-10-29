import type { Landmark } from "@/types";

/**
 * The 10 visitor landmarks of the central map — and only these (the map covers
 * Districts 1 and 3, the riverfront, Thủ Thiêm and Bình Thạnh up to Landmark 81). Positions are the
 * representative points of their OpenStreetMap features (checked with Overpass
 * on 2026-10-27); the OSM element is recorded so anyone can re-verify at
 * https://www.openstreetmap.org/<osm>. `geometry` says what the 3D model is
 * fitted to: a building footprint, a site boundary, or a line (the bridge).
 *
 * Reference images are linked, not re-hosted (copyright): `ref` points to the
 * official site or the Wikimedia Commons category of the place.
 *
 * Only Dinh Độc Lập has a walkable 3D tour; the others are "coming soon".
 */
export const LANDMARKS: Landmark[] = [
  {
    id: "dinh-doc-lap",
    name: { vi: "Dinh Độc Lập", en: "Independence Palace" },
    short: { vi: "Dinh", en: "Palace" },
    blurb: {
      vi: "Di tích quốc gia đặc biệt — tham quan 3D với hướng dẫn viên Minh Anh.",
      en: "Special National Relic — explore in 3D with guide Minh Anh.",
    },
    status: "available",
    lat: 10.777017, lon: 106.695403, osm: "way/39598493",
    geometry: "footprint",
    kind: "palace",
    route: "/dinh-doc-lap",
    ref: { url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", label: "dinhdoclap.gov.vn" },
  },
  {
    id: "nha-tho-duc-ba",
    name: { vi: "Nhà thờ Đức Bà Sài Gòn", en: "Saigon Notre-Dame Cathedral" },
    short: { vi: "Nhà thờ Đức Bà", en: "Notre-Dame" },
    blurb: { vi: "Nhà thờ chính tòa gạch đỏ với hai tháp chuông.", en: "The red-brick cathedral with its twin bell towers." },
    status: "coming_soon",
    lat: 10.779771, lon: 106.699058, osm: "way/801950766",
    geometry: "footprint",
    kind: "cathedral",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Notre-Dame_Cathedral_Basilica_of_Saigon", label: "Wikimedia Commons" },
  },
  {
    id: "buu-dien",
    name: { vi: "Bưu điện Trung tâm Sài Gòn", en: "Saigon Central Post Office" },
    short: { vi: "Bưu điện", en: "Post Office" },
    blurb: { vi: "Công trình bưu điện cuối thế kỷ XIX bên cạnh Nhà thờ Đức Bà.", en: "The late-19th-century post office beside the cathedral." },
    status: "coming_soon",
    lat: 10.779981, lon: 106.700021, osm: "way/39514793",
    geometry: "footprint",
    kind: "postoffice",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Saigon_Central_Post_Office", label: "Wikimedia Commons" },
  },
  {
    id: "chung-tich-chien-tranh",
    name: { vi: "Bảo tàng Chứng tích Chiến tranh", en: "War Remnants Museum" },
    short: { vi: "Bảo tàng Chứng tích", en: "War Remnants" },
    blurb: { vi: "Bảo tàng trên đường Võ Văn Tần, sân trưng bày khí tài ngoài trời.", en: "Museum on Võ Văn Tần street with an outdoor display yard." },
    status: "coming_soon",
    lat: 10.779379, lon: 106.692192, osm: "way/186249226",
    geometry: "footprint",
    kind: "museum",
    ref: { url: "https://baotangchungtichchientranh.vn/", label: "baotangchungtichchientranh.vn" },
  },
  {
    id: "ben-nha-rong",
    name: { vi: "Bến Nhà Rồng", en: "Nhà Rồng Wharf" },
    short: { vi: "Bến Nhà Rồng", en: "Nhà Rồng" },
    blurb: { vi: "Tòa nhà mái rồng bên sông Sài Gòn, nay là Bảo tàng Hồ Chí Minh.", en: "The dragon-roofed building on the Saigon River, now the Hồ Chí Minh Museum." },
    status: "coming_soon",
    lat: 10.768251, lon: 106.706807, osm: "way/808022726",
    geometry: "footprint",
    kind: "wharf",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Nh%C3%A0_R%E1%BB%93ng_Wharf", label: "Wikimedia Commons" },
  },
  {
    id: "cho-ben-thanh",
    name: { vi: "Chợ Bến Thành", en: "Bến Thành Market" },
    short: { vi: "Chợ Bến Thành", en: "Bến Thành" },
    blurb: { vi: "Khu chợ với tháp đồng hồ ở cửa Nam, biểu tượng của trung tâm.", en: "The market with its south-gate clock tower, a downtown icon." },
    status: "coming_soon",
    lat: 10.772571, lon: 106.698017, osm: "way/39514795",
    geometry: "footprint",
    kind: "market",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:B%E1%BA%BFn_Th%C3%A0nh_Market", label: "Wikimedia Commons" },
  },
  {
    id: "landmark-81",
    name: { vi: "Landmark 81", en: "Landmark 81" },
    short: { vi: "Landmark 81", en: "Landmark 81" },
    blurb: { vi: "Tòa tháp cao nhất Việt Nam (461 m) trong khu Vinhomes Central Park, Bình Thạnh.", en: "Vietnam's tallest tower (461 m), in Vinhomes Central Park, Bình Thạnh." },
    status: "coming_soon",
    // footprint tagged "Vincom Center", height 461.2 m in OSM
    lat: 10.79512, lon: 106.72208, osm: "node/11868700660",
    geometry: "footprint",
    kind: "landmark81",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Landmark_81", label: "Wikimedia Commons" },
  },
  {
    id: "bitexco",
    name: { vi: "Tòa tháp Bitexco Financial", en: "Bitexco Financial Tower" },
    short: { vi: "Bitexco", en: "Bitexco" },
    blurb: { vi: "Tòa tháp hình búp sen với sân đỗ trực thăng nhô ra ở tầng 52.", en: "The lotus-bud tower with its cantilevered helipad on floor 52." },
    status: "coming_soon",
    lat: 10.771863, lon: 106.704463, osm: "way/804073951",
    geometry: "footprint",
    kind: "tower",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Bitexco_Financial_Tower", label: "Wikimedia Commons" },
  },
  {
    id: "thao-cam-vien",
    name: { vi: "Thảo Cầm Viên Sài Gòn", en: "Saigon Zoo and Botanical Gardens" },
    short: { vi: "Thảo Cầm Viên", en: "Saigon Zoo" },
    blurb: { vi: "Vườn thú và vườn bách thảo từ năm 1864, bên rạch Thị Nghè.", en: "Zoo and botanical garden since 1864, beside the Thị Nghè canal." },
    status: "coming_soon",
    lat: 10.787808, lon: 106.706457, osm: "way/32735038",
    geometry: "boundary",
    kind: "zoo",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Saigon_Zoo_and_Botanical_Gardens", label: "Wikimedia Commons" },
  },
  {
    id: "cau-ba-son",
    name: { vi: "Cầu Ba Son", en: "Ba Son Bridge" },
    short: { vi: "Cầu Ba Son", en: "Ba Son Bridge" },
    blurb: { vi: "Cầu dây văng một trụ tháp nối Quận 1 với Thủ Thiêm (2022).", en: "Single-pylon cable-stayed bridge linking District 1 and Thủ Thiêm (2022)." },
    status: "coming_soon",
    // mid-span point; the model follows the OSM bridge line way/321564421
    lat: 10.77955, lon: 106.71017, osm: "way/321564421",
    geometry: "line",
    kind: "bridge",
    ref: { url: "https://commons.wikimedia.org/wiki/Category:Ba_Son_Bridge", label: "Wikimedia Commons" },
  },
];

/**
 * Real buildings kept as recognisable context (not visitor landmarks):
 * no marker, not in the landmark list.
 */
export const CONTEXT_BUILDINGS = [
  { id: "nha-hat", kind: "theatre" as const, lat: 10.776711, lon: 106.703219, osm: "way/801710792" },
  { id: "ubnd", kind: "hall" as const, lat: 10.776596, lon: 106.700955, osm: "way/341504305" },
];

export const CITY_ORIGIN = { lat: 10.777017, lon: 106.695403 };

/** Same projection as scripts/fetch-osm.mjs: metres, +x east, +z south. */
export function project(lat: number, lon: number): [number, number] {
  const R = 6378137;
  const x = (((lon - CITY_ORIGIN.lon) * Math.PI) / 180) * R * Math.cos((CITY_ORIGIN.lat * Math.PI) / 180);
  const y = (((lat - CITY_ORIGIN.lat) * Math.PI) / 180) * R;
  return [x, -y];
}
