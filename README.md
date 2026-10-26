<div align="center">

# 🏛️ Sài Gòn 3D — Du lịch số di sản

**Saigon 3D — Immersive Heritage Explorer**

Bản đồ Sài Gòn 3D dựng từ dữ liệu OpenStreetMap thật, và chuyến tham quan **Dinh Độc Lập** có thể đi bộ,
với hướng dẫn viên AI **Minh Anh** dẫn đường, thuyết minh song ngữ và trả lời câu hỏi dựa trên tư liệu đã kiểm chứng.

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs)](https://nextjs.org)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=000)](https://react.dev)
[![Three.js](https://img.shields.io/badge/Three.js-r186-000000?logo=threedotjs)](https://threejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=fff)](https://www.typescriptlang.org)
[![Gemini](https://img.shields.io/badge/AI-Gemini%20Flash-8E75B2?logo=googlegemini&logoColor=fff)](https://ai.google.dev)
[![Azure Speech](https://img.shields.io/badge/voice-Azure%20AI%20Speech-0078D4?logo=microsoftazure&logoColor=fff)](https://learn.microsoft.com/azure/ai-services/speech-service/)
[![Tests](https://img.shields.io/badge/tests-60%20passing-2ea44f)](#-kiểm-thử)
[![OSM](https://img.shields.io/badge/data-OpenStreetMap%20ODbL-7EBC6F?logo=openstreetmap&logoColor=fff)](https://www.openstreetmap.org/copyright)

[Tính năng](#-tính-năng) · [Ảnh chụp](#-ảnh-chụp) · [Hướng dẫn viên AI](#-hướng-dẫn-viên-ai-minh-anh) · [Kiến trúc](#-kiến-trúc) · [Độ chính xác](#-độ-chính-xác-lịch-sử)

</div>

---

## 📖 Giới thiệu

**Sài Gòn 3D** là ứng dụng web du lịch số cho di sản TP. Hồ Chí Minh:

- **Bản đồ thành phố 3D** khu trung tâm (Quận 1) dựng tự động từ OpenStreetMap: đường phố, sông Sài Gòn, kênh Bến Nghé, công viên và khoảng 2.400 công trình, cùng xe cộ, thuyền, người đi bộ và chim được mô phỏng.
- **Dinh Độc Lập đi bộ được**: khuôn viên, mặt tiền với rèm hoa đá, đại sảnh, Phòng Trình Quốc thư, Phòng họp Nội các, tầng hầm và sân thượng, có va chạm vật lý.
- **Minh Anh, hướng dẫn viên AI** là một nhân vật trong thế giới 3D: đi trước dẫn đường, dừng chờ khi bạn tụt lại, thuyết minh có phụ đề và giọng nữ tiếng Việt/Anh, và trả lời câu hỏi bằng Gemini dựa trên kho tư liệu có nguồn.

> **Trạng thái:** MVP. Dinh Độc Lập là điểm được đầu tư hoàn chỉnh; các địa danh khác trên bản đồ ở trạng thái “Sắp ra mắt”.

## ✨ Tính năng

| | |
|---|---|
| 🗺️ **Bản đồ 3D từ dữ liệu thật** | Hình học đường, sông, công viên, công trình từ OSM; kiến trúc sinh tự động theo diện tích/chiều cao; dựng trong Web Worker |
| 🚦 **Thành phố sống động** | 8 loại xe chạy theo chiều `oneway` thật, dừng đèn đỏ ở giao lộ; tàu thuyền trên sông và kênh; người đi bộ, chó, mèo, chim; 3 mức chất lượng và LOD |
| 🏛️ **Dinh Độc Lập chi tiết** | Texture PBR sinh bằng mã, rèm hoa đá dựng bằng hình học thật, nội thất các phòng theo ảnh chính thức, ánh sáng dịu dần khi vào/ra nhà |
| 🚶 **Điều khiển kiểu game** | WASD, chạy, nhảy, góc nhìn thứ nhất/thứ ba; khóa chuột (Pointer Lock); dáng đi khớp vận tốc, chân không trượt; hỗ trợ cảm ứng |
| 🧭 **Dẫn đường** | Chọn điểm đến (điểm dừng, hiện vật, phòng) → dải sáng bám sàn đi qua cửa và cầu thang hợp lệ, không xuyên tường; khoảng cách và chỉ dẫn rẽ trái/phải/lên/xuống |
| 👩‍🏫 **Minh Anh dẫn đoàn** | Đi trước 2–4 m, chậm lại và chờ khi bạn tụt lại, nhắc bằng lời (không lặp liên tục), thuyết minh khi bạn đến gần, tạm dừng khi bạn đi xa |
| 🤖 **Hỏi đáp AI** | Gemini Flash trả lời **chỉ từ kho tư liệu có nguồn**, đúng ngôn ngữ bạn đang gõ, nhớ ngữ cảnh nhiều lượt; thiếu khóa hoặc lỗi thì trả lời trích từ kho (ghi rõ chế độ demo/dự phòng) |
| 🔊 **Giọng bản xứ** | Minh Anh đọc tiếng Việt bằng giọng nữ **HoaiMy** và tiếng Anh bằng giọng nữ **Jenny** (Azure AI Speech, phát âm chuẩn), cố định theo ngôn ngữ; stream theo từng câu, lỗi thì thử lại rồi chỉ hiện phụ đề |
| 🌐 **Song ngữ & tiếp cận** | Tiếng Việt / English, giao diện sáng/tối, đổi phím, giảm chuyển động, phụ đề |

## 📸 Ảnh chụp

| Mặt tiền và rèm hoa đá | Minh Anh thuyết minh ở cổng |
|---|---|
| ![Mặt tiền Dinh Độc Lập](docs/screenshots/palace-facade.png) | ![Minh Anh thuyết minh](docs/screenshots/guide-explaining.jpg) |
| **Dải dẫn đường trên đường vòng** | **Phòng Trình Quốc thư** |
| ![Dẫn đường](docs/screenshots/route-guidance.jpg) | ![Phòng Trình Quốc thư](docs/screenshots/credentials-room.jpg) |
| **Phòng họp Hội đồng Nội các** | |
| ![Phòng họp Nội các](docs/screenshots/cabinet-room.jpg) | |

<sub>Ảnh chụp từ ứng dụng (chế độ chất lượng thấp/trung bình, trình duyệt headless).</sub>

## 🤖 Hướng dẫn viên AI Minh Anh

Minh Anh vừa là nhân vật trong thế giới 3D, vừa là trợ lý hỏi đáp:

- **Trả lời bằng Google Gemini (Flash)**, chỉ dựa trên kho tư liệu đã kiểm chứng của dự án; câu hỏi nằm ngoài kho được trả lời thẳng thắn là chưa có tư liệu. Khi AI quá tải, hệ thống chuyển sang model dự phòng hoặc trích nguyên văn từ kho và ghi rõ điều đó.
- **Giọng nói bản xứ từ Azure AI Speech**: tiếng Việt bằng giọng nữ HoaiMy, tiếng Anh bằng giọng nữ Jenny, cố định theo ngôn ngữ.
- **Dẫn đoàn thật sự**: đi trước người chơi, chờ khi bị bỏ lại, nhắc nhở có chừng mực, thuyết minh khi người chơi đến gần và tạm dừng khi họ đi xa.

**Luồng hội thoại**

```mermaid
flowchart LR
  Q[Người chơi gõ câu hỏi] --> A["/api/ask<br/>truy xuất kho tư liệu"]
  A --> G[Gemini Flash<br/>+ model dự phòng]
  G --> T[Chữ hiện ngay<br/>trong thẻ Minh Anh]
  T --> N["narrator: tách câu<br/>GET /api/tts"]
  N --> E["Azure AI Speech stream<br/>(vi: HoaiMy, en: Jenny)"]
  E --> P[Phát từng câu,<br/>câu sau tạo song song]
  E -. lỗi sau khi thử lại .-> F[Chỉ phụ đề cho câu đó]
```

- Minh Anh trả lời bằng **ngôn ngữ bạn đang gõ** và chọn giọng tương ứng.
- Câu hỏi mới dừng ngay âm thanh cũ, không bao giờ phát chồng.
- Không lưu hội thoại hay file âm thanh; server chỉ giữ vài câu trong bộ nhớ đệm.
- Khóa API chỉ nằm phía server; `/api/ask` và `/api/tts` có giới hạn tần suất và kiểm tra dữ liệu đầu vào (zod).

## 🎮 Điều khiển

| Phím | Chức năng |
|---|---|
| <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> / mũi tên | Di chuyển (đi 3 m/s) |
| <kbd>Shift</kbd> | Chạy (5,5 m/s) |
| Chuột | Nhìn quanh — nhấp vào cảnh hoặc <kbd>L</kbd> để khóa chuột; không khóa thì giữ và kéo |
| <kbd>Esc</kbd> | Đang khóa chuột: mở khóa (game vẫn chạy) · Con trỏ đã mở: tạm dừng / cài đặt |
| <kbd>E</kbd> | Tương tác / đóng bảng thông tin |
| <kbd>V</kbd> | Góc nhìn thứ nhất ↔ thứ ba |
| <kbd>Space</kbd> | Nhảy |
| <kbd>M</kbd> | Sơ đồ tầng & chọn điểm đến |
| <kbd>G</kbd> | Gọi Minh Anh lại gần |
| <kbd>Enter</kbd> | Hỏi Minh Anh |
| <kbd>H</kbd> | Ẩn/hiện hướng dẫn |

Mọi phím (trừ Esc) đổi được trong Cài đặt. Thiết bị cảm ứng có cần điều khiển ảo.

## 🧱 Kiến trúc

**Công nghệ:** Next.js 16 (App Router) · React 19 · Three.js + React Three Fiber + drei · Rapier (vật lý, character controller) · Zustand · Framer Motion · Tailwind CSS 4 · zod · Vitest · Azure AI Speech.

```
app/                 Trang: / (bản đồ), /dinh-doc-lap (tham quan), /sources · API: /api/ask, /api/tts, /api/status
components/
  map/               CityScene, CityLayers (nhà, mặt đất, cây, mặt trời), LivingCity (xe, thuyền, người, chim)
  game/              DinhScene (Canvas + Rapier), Palace (render + vật liệu), RouteGuide (dải dẫn đường, marker), DinhExperience (HUD)
  player/            Player (character controller, camera), Humanoid (nhân vật & hoạt ảnh bằng mã)
  guide/             GuideNPC (Minh Anh trong thế giới 3D), GuideCard (hội thoại, phụ đề)
  tour/              StopList, InfoPanel, FloorMap, NavHud, Overlays
data/                dinh/ (sources, knowledge, tour, layout) · landmarks · i18n (vi/en) · assets (giấy phép)
lib/
  city/              buildCity (worker), roads, architecture, textures, geom
  sim/               traffic, water, life, models, config (LOD)
  dinh/              palaceModel (hình + collider + đồ thị đi bộ từ một nguồn), route (tìm đường), textures (PBR thủ tục)
  guide/brain.ts     Máy trạng thái của Minh Anh
  tour/              director, navigator, destinations
  server/            ai.ts (Gemini / Claude), tts.ts (Azure: HoaiMy / Jenny), rateLimit
  audio/narrator.ts  Phát theo câu, phụ đề đồng bộ, tự hạ cấp giọng đọc
scripts/fetch-osm.mjs  Tải & tiền xử lý OSM
tests/               vitest
```

**Nguyên tắc thiết kế**

- **Một nguồn dữ liệu cho hình, va chạm và đường đi.** `lib/dinh/palaceModel.ts` sinh khối hiển thị, collider Rapier, đồ thị đi bộ và vật cản (kể cả nội thất) từ `data/dinh/layout.ts`. Người chơi, Minh Anh và bộ tìm đường vì vậy nhìn thấy cùng một thế giới.
- **Kiến thức nằm trong dữ liệu.** Mỗi câu thuyết minh dựa trên một `Fact` có nguồn và mức tin cậy (`verified` / `estimated` / `simulated` / `conflicting`).
- **AI bị ràng buộc vào kho tư liệu.** Mô hình chỉ được trả lời từ phần tư liệu truy xuất kèm theo; dữ kiện mâu thuẫn được nêu rõ là mâu thuẫn.
- **Hành vi tách khỏi hiển thị.** Tìm đường (`route.ts`) và quyết định của Minh Anh (`brain.ts`) là mã thuần, được kiểm thử độc lập.

<details>
<summary><b>Minh Anh — máy trạng thái</b></summary>

`WAITING` → `LEADING` → (bạn tụt lại hơn ~6 m) `CHECKING_DISTANCE` → `WAITING_FOR_PLAYER` → (hơn ~8 m) `REMINDING` → (bạn đến trong ~3,6 m) `RESUMING` → `LEADING` → đến điểm dừng → `EXPLAINING` (khi bạn ở gần; tạm dừng nếu bạn đi xa) → `WAITING`. Ngoài ra còn `LISTENING` khi bạn mở hộp hỏi đáp và `FOLLOWING` ở chế độ tự do. Mỗi chuyển trạng thái theo khoảng cách có ngưỡng vào/ra khác nhau cộng thời gian chờ để không rung trạng thái. Tất cả thông số nằm trong `lib/game/config.ts`.

</details>

<details>
<summary><b>Chuyển cảnh bản đồ ↔ Dinh</b></summary>

Next.js 16 giữ trang đã xem trong React `<Activity>`. Khi trang bị ẩn, React Three Fiber hủy WebGL context, vì vậy mỗi lần trang hiện lại thì canvas được gắn mới (`lib/useVisitKey.ts`). Thành phố đã dựng được giữ trong bộ nhớ, nên quay lại không phải dựng lại. Cảnh Dinh chỉ hiện sau khi shader đã biên dịch xong.

</details>

## 🧪 Kiểm thử

Dự án có 60 kiểm thử tự động (Vitest), gồm:

- **Kho tri thức:** toàn vẹn dữ liệu, nguồn, i18n, truy xuất câu trả lời.
- **Vật lý:** một capsule dùng character controller Rapier đi từ cổng lên sân thượng, xuống tầng hầm, tới các hiện vật theo tuyến đã lập; tường chặn được.
- **Tìm đường:** từ 7 điểm xuất phát tới mọi điểm đến; tuyến được kiểm tra độc lập là không xuyên vật cản, chỉ đổi tầng qua cầu thang, đi vòng quanh thảm cỏ.
- **Minh Anh:** dẫn trước, dừng chờ, nhắc có giới hạn, không rung trạng thái, đi tiếp khi bắt kịp, chỉ thuyết minh đúng lúc, không đi khi không có tuyến.
- **Thành phố:** mặt đường hướng lên, xe không chồng nhau và không kẹt cứng, thuyền luôn trên mặt nước, chim bay trên mái nhà.

## 📚 Độ chính xác lịch sử

Ứng dụng tách rõ điều đã được kiểm chứng với điều là ước lượng hoặc mô phỏng; toàn bộ nguồn xem tại trang `/sources`.

| Thành phần | Trạng thái |
|---|---|
| Đường phố, sông, công viên, đường bao công trình | Dữ liệu OSM thật (ODbL) |
| Kiểu kiến trúc, màu sắc từng công trình; nhà phố lấp đầy | **Sinh tự động**, không phải kiến trúc thật |
| Khuôn viên 300 × 400 m, thảm cỏ 102 m, khối nhà 4.500 m², cao 26 m, KTS Ngô Viết Thụ | Theo [dinhdoclap.gov.vn](https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/) |
| Cách chia khối chữ T, chiều cao tầng, vị trí phòng, tầng hầm | **Ước lượng / mô phỏng** (không có mặt bằng chi tiết công khai) |
| Vật liệu: mặt tiền trắng, sàn granite tối, thảm vàng + rèm đỏ (Trình Quốc thư), thảm + rèm xanh (Nội các), rèm hoa đá dạng đốt trúc | Theo ảnh trên trang chính thức; texture **sinh bằng mã** |
| Chiều cao dải rèm hoa đá, vị trí tâm thảm cỏ | **Ước lượng** theo ảnh và sơ đồ tham quan |
| Tranh sơn mài trong Phòng Trình Quốc thư | Chỉ là khung minh họa, không tái tạo tác phẩm thật |
| Tuyến xe, tàu thuyền, đèn tín hiệu, người đi bộ | **Mô phỏng** |

Ảnh tư liệu của Di tích không được nhúng lại; ứng dụng dẫn liên kết tới trang nguồn kèm chú thích.

## 🚧 Giới hạn & hướng phát triển

- Nhân vật và kiến trúc dựng bằng mã; nên thay bằng mô hình GLB có giấy phép (nhân vật có rig, mô hình Dinh từ bản vẽ đo đạc). Giao diện `HumanoidAnim` và `palaceModel` đã tách sẵn để thay.
- Chỉ đi được tầng nền, tầng hầm và sân thượng; các tầng lầu “chưa mô hình hóa”. Có lối tắt cầu thang (<kbd>E</kbd>).
- Giọng nói phụ thuộc hạn mức của dịch vụ Azure; khi hết hạn mức, câu trả lời vẫn hiển thị đầy đủ dưới dạng phụ đề. Tiếng Việt hiện chỉ có hai giọng bản xứ (HoaiMy nữ, NamMinh nam).
- Hoạt ảnh miệng chưa có lip-sync; nhân vật chỉ chuyển sang hoạt ảnh “nói” khi đang phát tiếng.
- Chưa có nhập câu hỏi bằng giọng nói (micro).
- Hiệu năng cần đo thêm trên nhiều cấu hình máy; có 3 mức đồ họa Thấp/Trung bình/Cao.

## 🙏 Nguồn dữ liệu & ghi công

- Dữ liệu bản đồ © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), giấy phép ODbL 1.0.
- Tư liệu lịch sử và kiến trúc: [Di tích lịch sử Dinh Độc Lập — dinhdoclap.gov.vn](https://dinhdoclap.gov.vn).
- Giọng đọc: [Azure AI Speech](https://learn.microsoft.com/azure/ai-services/speech-service/) (HoaiMy, Jenny).
- AI: [Google Gemini API](https://ai.google.dev).

Danh mục đầy đủ tài sản và giấy phép nằm trong `data/assets.ts` và trang `/sources`.

## 📄 Giấy phép

Chưa chọn giấy phép cho mã nguồn: mọi quyền thuộc về tác giả cho đến khi có file `LICENSE`. Dữ liệu OSM trong `public/data/city.json` tuân theo ODbL 1.0.
