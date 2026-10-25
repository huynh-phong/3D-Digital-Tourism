import type { Landmark } from "@/types";

/**
 * Landmark positions are the centroids of their OpenStreetMap features
 * (queried 2026-10-25 via Overpass). The OSM element is recorded so anyone can
 * re-verify: https://www.openstreetmap.org/<osm>.
 */
export const LANDMARKS: Landmark[] = [
  {
    id: "dinh-doc-lap",
    name: { vi: "Dinh Độc Lập", en: "Independence Palace" },
    short: {
      vi: "Di tích quốc gia đặc biệt — tham quan 3D với hướng dẫn viên Minh Anh.",
      en: "Special National Relic — explore in 3D with guide Minh Anh.",
    },
    status: "available",
    lat: 10.777017, lon: 106.695403, osm: "way/39598493",
    kind: "palace",
    route: "/dinh-doc-lap",
  },
  {
    id: "nha-tho-duc-ba",
    name: { vi: "Nhà thờ Đức Bà Sài Gòn", en: "Saigon Notre-Dame Cathedral" },
    short: { vi: "Nhà thờ chính tòa nổi tiếng với hai tháp chuông.", en: "The cathedral famed for its twin bell towers." },
    status: "coming_soon",
    lat: 10.779771, lon: 106.699058, osm: "way/801950766",
    kind: "cathedral",
  },
  {
    id: "buu-dien",
    name: { vi: "Bưu điện Trung tâm Sài Gòn", en: "Saigon Central Post Office" },
    short: { vi: "Công trình bưu điện bên cạnh Nhà thờ Đức Bà.", en: "The post office next to the cathedral." },
    status: "coming_soon",
    lat: 10.779981, lon: 106.700021, osm: "way/39514793",
    kind: "postoffice",
  },
  {
    id: "cho-ben-thanh",
    name: { vi: "Chợ Bến Thành", en: "Bến Thành Market" },
    short: { vi: "Khu chợ biểu tượng của trung tâm thành phố.", en: "The iconic market of downtown Saigon." },
    status: "coming_soon",
    lat: 10.772571, lon: 106.698017, osm: "way/39514795",
    kind: "market",
  },
  {
    id: "nguyen-hue",
    name: { vi: "Phố đi bộ Nguyễn Huệ", en: "Nguyễn Huệ Walking Street" },
    short: { vi: "Đại lộ đi bộ từ trụ sở UBND Thành phố ra sông Sài Gòn.", en: "Pedestrian boulevard from City Hall toward the river." },
    status: "coming_soon",
    lat: 10.7738, lon: 106.704215, osm: "way/377881079",
    kind: "street",
  },
  {
    id: "nha-hat",
    name: { vi: "Nhà hát Thành phố", en: "Saigon Opera House" },
    short: { vi: "Nhà hát ở đầu đường Đồng Khởi.", en: "The theatre at the head of Đồng Khởi street." },
    status: "coming_soon",
    lat: 10.776711, lon: 106.703219, osm: "way/801710792",
    kind: "theatre",
  },
  {
    id: "ubnd",
    name: { vi: "Trụ sở UBND TP. Hồ Chí Minh", en: "Ho Chi Minh City Hall" },
    short: { vi: "Công trình ở đầu phố đi bộ Nguyễn Huệ.", en: "The building at the head of Nguyễn Huệ street." },
    status: "coming_soon",
    lat: 10.776596, lon: 106.700955, osm: "way/341504305",
    kind: "hall",
  },
  {
    id: "bitexco",
    name: { vi: "Tòa tháp Bitexco Financial", en: "Bitexco Financial Tower" },
    short: { vi: "Tòa tháp chọc trời với sân đỗ trực thăng nhô ra.", en: "The skyscraper with its cantilevered helipad." },
    status: "coming_soon",
    lat: 10.771863, lon: 106.704463, osm: "way/804073951",
    kind: "tower",
  },
  {
    id: "bach-dang",
    name: { vi: "Công viên Bến Bạch Đằng", en: "Bạch Đằng Wharf Park" },
    short: { vi: "Công viên ven sông Sài Gòn.", en: "Riverside park on the Saigon River." },
    status: "coming_soon",
    lat: 10.77228, lon: 106.706489, osm: "way/472074784",
    kind: "riverside",
  },
];

export const CITY_ORIGIN = { lat: 10.777017, lon: 106.695403 };

/** Same projection as scripts/fetch-osm.mjs: metres, +x east, +z south. */
export function project(lat: number, lon: number): [number, number] {
  const R = 6378137;
  const x = (((lon - CITY_ORIGIN.lon) * Math.PI) / 180) * R * Math.cos((CITY_ORIGIN.lat * Math.PI) / 180);
  const y = (((lat - CITY_ORIGIN.lat) * Math.PI) / 180) * R;
  return [x, -y];
}
