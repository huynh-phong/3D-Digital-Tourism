import type { Localized } from "@/types";

/** Every asset or dataset used, with its licence and how it is used. */
export const ASSETS: { name: string; kind: Localized; licence: string; source: string; note: Localized }[] = [
  {
    name: "OpenStreetMap — Quận 1, TP.HCM",
    kind: { vi: "Dữ liệu bản đồ (đường, công trình, sông, công viên)", en: "Map data (streets, buildings, river, parks)" },
    licence: "ODbL 1.0 — © OpenStreetMap contributors",
    source: "https://www.openstreetmap.org/copyright",
    note: {
      vi: "Tải qua Overpass API bằng scripts/fetch-osm.mjs, chiếu sang mét và lưu trong public/data/city.json.",
      en: "Fetched via the Overpass API with scripts/fetch-osm.mjs, projected to metres and stored in public/data/city.json.",
    },
  },
  {
    name: "Nhà phố khái quát hóa",
    kind: { vi: "Hình học sinh tự động", en: "Procedurally generated geometry" },
    licence: "Mã nguồn của dự án",
    source: "lib/city/buildCity.ts",
    note: {
      vi: "Lấp các dãy phố chưa có dữ liệu công trình trong OSM; không đại diện cho công trình thật.",
      en: "Fills street frontages that have no OSM building footprints; they do not represent real buildings.",
    },
  },
  {
    name: "Mô hình địa danh cách điệu",
    kind: { vi: "Mô hình 3D dựng bằng mã", en: "3D models built in code" },
    licence: "Mã nguồn của dự án",
    source: "components/map/LandmarkModels.tsx",
    note: {
      vi: "Hình khối nhận diện, kích thước theo đường bao OSM; không phải bản tái tạo kiến trúc.",
      en: "Recognisable massing sized to OSM footprints; not architectural reconstructions.",
    },
  },
  {
    name: "Dinh Độc Lập (môi trường đi bộ)",
    kind: { vi: "Mô hình 3D dựng từ dữ liệu bố cục", en: "3D model generated from layout data" },
    licence: "Mã nguồn của dự án",
    source: "data/dinh/layout.ts · lib/dinh/palaceModel.ts",
    note: {
      vi: "Kích thước tổng thể theo nguồn chính thức; mặt bằng nội thất là ước lượng/mô phỏng (đánh dấu trong dữ liệu).",
      en: "Overall dimensions follow official sources; interior plans are estimates/simulations (flagged in the data).",
    },
  },
  {
    name: "Nhân vật người chơi và Minh Anh",
    kind: { vi: "Nhân vật dựng và hoạt ảnh bằng mã", en: "Code-built, code-animated characters" },
    licence: "Mã nguồn của dự án",
    source: "components/player/Humanoid.tsx",
    note: {
      vi: "Có thể thay bằng mô hình GLB có giấy phép mà vẫn giữ giao diện hoạt ảnh.",
      en: "Can be swapped for a licensed rigged GLB while keeping the same animation interface.",
    },
  },
  {
    name: "Ảnh tư liệu Dinh Độc Lập",
    kind: { vi: "Liên kết đến trang nguồn (không lưu trữ lại)", en: "Links to source pages (not re-hosted)" },
    licence: "© Di tích lịch sử Dinh Độc Lập",
    source: "https://dinhdoclap.gov.vn/",
    note: {
      vi: "Ứng dụng chỉ trích chú thích ảnh và dẫn liên kết; cần xin phép trước khi nhúng ảnh.",
      en: "The app only cites captions and links out; permission is needed before embedding images.",
    },
  },
];
