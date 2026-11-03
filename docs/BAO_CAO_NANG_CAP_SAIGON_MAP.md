# Báo cáo nâng cấp Saigon Map — ánh sáng, nhãn địa điểm, hình học, phạm vi sa bàn

Ngày: 30/10/2026 · Phạm vi: bản đồ thành phố (`/`). Dinh Độc Lập (`/dinh-doc-lap`) **không bị chỉnh sửa**.

Ảnh nghiệm thu: `docs/screenshots/map/sau_*.jpg` (Chrome headless, GPU ANGLE/D3D11, 1600×900).

---

## A. Ánh sáng và ngày/đêm

**Nguyên nhân bản đồ quá tối (ảnh 1):**
- Trời gần như đen (`#141c2b`).
- Mặt trời đêm chỉ 0,35, hemisphere 0,55, ambient 0,25.
- Cửa sổ phát sáng mạnh (`emissiveIntensity` 1,0).
- Mặt đất, đường và cây bị nhân màu tối `#7f8899`.

Hệ quả: tường nhà gần như tắt, chỉ còn các chấm vàng cửa sổ.

**Thay đổi:**

| | Ngày | Đêm (cũ → mới) |
|---|---|---|
| Nền trời / sương | `#cfe8e5` | `#141c2b` → `#26354f`, sương `#2a3a58` |
| Hemisphere | `#fff4e2`/`#bfa77c` 1,05 | 0,55 → 1,0 (`#7d93c4`/`#3b3a33`) |
| Ambient | 0,30 | 0,25 → 0,42 |
| Mặt trời / trăng | 2,4 `#ffe8c6`, bóng mềm | 0,35 → 0,9 `#b3c4ff` |
| Cửa sổ phát sáng | tắt | 1,0 → 0,42 (`#ffd9a0`) |
| Nhân màu mặt đất, cây, ngoại vi | — | `#7f8899` → `#a6b0c4` |

- Sông dùng màu `#4e9f98` (theo bảng màu đề xuất).
- Đường phân cấp: trục chính `#6c7274`, đường thường `#7c8183`, hẻm/đường nhỏ `#8d9190`.
- Vỉa hè `#d9cfb8`.
- Tone mapping giữ Neutral, exposure 1,0.
- Sương mù lùi xa (near ≥ 3 km, far ≥ 9 km) để mép sa bàn phía xa không bị mờ.

**Mặc định ban ngày:** `theme` mặc định đổi từ `"system"` sang `"light"` (`lib/store/settings.ts`).
- Lần đầu mở web luôn là ban ngày.
- Người dùng chọn tối thì cài đặt vẫn được lưu như cũ.

**Kết quả:**
- Ban ngày: `sau_overview.jpg`.
- Ban đêm: `sau_overview_night.jpg`, `sau_cbd_night.jpg`. Thấy rõ hình khối, mái, sông và đường; cửa sổ chỉ là điểm nhấn.

## B. Hệ thống nhãn địa điểm

**Nguyên nhân trôi/giật (đọc từ code, không phải đoán):**
1. **Cột là phần tử DOM cao cố định 20 px**, không phải hình 3D.
   - Chân cột không gắn với điểm nào trong thế giới.
   - Khi đổi góc nghiêng, chân cột "lơ lửng" so với công trình.
2. **Cơ chế "lift" né chồng nhãn:** khi hai nhãn chồng nhau, nhãn sau bị nâng lên 30 hoặc 60 px.
   - Khi xoay camera, quan hệ chồng nhau thay đổi liên tục, nên nhãn nhảy lên rồi quay về.
   - Đây chính là hiện tượng "dịch nhẹ rồi quay lại".
3. **Mức hiển thị (đầy đủ / tên ngắn / chấm) đổi ngay trong một khung hình**, gây nhấp nháy khi xoay.
4. Bong bóng có `transition-transform` + `scale-110` khi chọn hoặc hover.

**Cấu trúc mới** (`components/map/CityScene.tsx`):
- **`markerAnchor()`:** mỗi địa điểm có hai điểm neo thế giới cố định.
  - `foot` (x, 0, z) đúng toạ độ OSM.
  - `top` (x, `MARKER_H` + `STEM` = 70 m, z).
- **`MarkerStems`:** tất cả các cột là **hình học 3D thật**, một draw call.
  - Dùng drei `Line` (Line2), dày cố định 3 px ở mọi mức zoom.
  - Mô hình công trình che phần cột nằm trong nó.
  - Cột không xoay, không co giãn, không làm mượt.
- **`MarkerProjector` (billboard):** mỗi khung hình chiếu `top` ra màn hình và đặt đáy-giữa của bong bóng đúng vào điểm đó.
  - Bong bóng luôn quay mặt về người xem.
  - Chạy sau CameraControls (priority 0 > −1), có `camera.updateMatrixWorld()` trước khi chiếu, nên cột 3D và nhãn luôn cùng một khung hình.
- **Đã bỏ:**
  - lift;
  - CSS transition trên transform, cùng `scale` và `translate` khi hover;
  - cột DOM.
- **Chống chồng nhãn chỉ bằng mức chi tiết** (đầy đủ → tên ngắn → chấm), không bao giờ dời vị trí.
  - Có trễ (hysteresis) 8 khung hình, nên nhãn không nhấp nháy khi xoay.

**Kiểm thử đo bằng toạ độ** (script CDP, so transform DOM với phép chiếu của `top` ở mỗi animation frame):

| Phép thử | Kết quả |
|---|---|
| Xoay 360° + zoom vào/ra + pan + đổi góc nghiêng | **sai lệch tối đa 0,007 px** trên 31 261 mẫu |
| Đổi mức chi tiết trong cả vòng 360° | 2 lần (trước: liên tục vì lift) |
| Sau khi camera dừng hẳn | nhãn đứng yên **0 px** (đo 1,5 s, 3 s, 6 s sau thao tác) |

Trong 0,5 s đầu sau khi buông chuột, nhãn còn dịch theo camera đang trượt quán tính (camera vẫn đi 6 m). Đó là chuyển động đúng của camera, nhãn không trễ so với cột.

## C. Building generator

Hệ thống kit hiện có đã có các loại mái, mặt tiền theo texture, ban công, mái hiên, bảng hiệu và gờ tầng. Lần này được mở rộng trong `lib/city/architecture.ts`:

- **`frontParapet` — mặt tiền giả nhà phố mái bằng (60 % nhà phố mái bằng có mặt tiền ra đường):**
  - tường mặt tiền vươn cao hơn mái 1,3–2,2 m;
  - có gờ phào;
  - kết thúc bằng đỉnh bậc hoặc mái ngói giả nhô ra.
  - Đây là hình bóng đặc trưng của nhà ống Sài Gòn.
- **`stairHut` — tum thang (40 % nhà phố mái bằng ≥ 2 tầng):** khối tum ở một đầu mái, có mái ngói hai dốc nhỏ.
- **`facadeFins` — lam đứng trên mặt tiền dài nhất (45 % văn phòng ≥ 6 tầng).**
- **Cao ốc giật cấp (50 % tháp có thân ≥ 18 tầng):**
  - thân lùi vào một lần ở khoảng 60 % chiều cao, có sàn mái tại chỗ lùi;
  - phần trên sáng màu hơn;
  - vẫn có đế, thân, vương miện và thiết bị mái như cũ.
- Quy tắc cũ giữ nguyên:
  - tường chung không mở cửa sổ;
  - ban công chỉ trên mặt tiền;
  - chiều cao OSM khi có dữ liệu;
  - landmark dùng mô hình riêng, không qua generator.

**Tối ưu:** mọi chi tiết mới được gộp vào bucket `details` sẵn có.
- Không thêm vật liệu hay draw call.
- Bucket `details` vẫn tự ẩn khi camera xa hơn 1,5 km.

## D. Đường, cây xanh, mặt nước

- **Đường:**
  - Thêm phân cấp màu theo lớp và độ rộng OSM (trục chính / đường thường / hẻm).
  - Thuật toán road mesh giữ nguyên. Nó đã là các lớp decal có thứ tự (`renderOrder`, không ghi depth): không z-fighting, giao lộ đồng màu mặt đường. Vỉa hè (rộng hơn lòng đường 6 m) đã có sẵn.
- **Cây xanh** (`CityLayers.tsx`, `buildCity.ts`):
  - **6 loài**, tăng từ 3:
    - tán tròn ghép 3 khối;
    - cây cao (dầu/sao);
    - cây nhỏ/bụi;
    - hình nón 2 tầng;
    - tán nhiều tầng;
    - tán rộng dạng dù (me, phượng).
  - Mỗi loài là một cặp InstancedMesh, tổng 12 draw call.
  - Công viên trồng theo **lùm**: loài chủ đạo đổi theo ô ~45 m, nên Thảo Cầm Viên có cụm cây khác nhau thay vì chấm xanh đều (`sau_zoo.jpg`).
  - Cây đường phố trồng theo đoạn ~90 m cùng loài.
  - Quy tắc không trồng trên đường, nhà, nước, giao lộ giữ nguyên.
- **Nước:** màu `#4e9f98`; gợn sóng shader cũ giữ nguyên. Trong vùng đệm, polygon nước được cắt theo mép sa bàn, bờ kè không vẽ dọc đường cắt.
- **Cầu:** mô hình Cầu Ba Son và các mặt cầu/cầu vượt OSM giữ nguyên (`sau_river_bridge.jpg`).

## E. Phạm vi bản đồ (sa bàn)

**Toạ độ 10 địa điểm** (m, +x Đông, +z Nam, gốc tại Dinh):

| Địa điểm | x | z |
|---|---|---|
| Dinh Độc Lập | 0 | 0 |
| Nhà thờ Đức Bà | 400 | −307 |
| Bưu điện | 505 | −330 |
| BT Chứng tích CT | −351 | −263 |
| Bitexco | 1 247 | 976 |
| Chợ Bến Thành | 286 | 495 |
| Landmark 81 | 2 917 | −2 015 |
| Bến Nhà Rồng | 991 | 574 |
| Thảo Cầm Viên | 1 209 | −1 201 |
| Cầu Ba Son | 1 615 | −282 |

Vùng bao nhỏ nhất của 10 địa điểm: x −351…2 917, z −2 015…976.

**Trước:**
- vùng chi tiết `CITY_BOUNDS` (x −860…3 400, z −2 500…1 260) ≈ 16 km²;
- **cộng** vành ngoại ô từ dữ liệu ≈ 10,3 × 9,8 km ≈ **100 km²**, với nhà thưa dần trong 1,4 km;
- **cộng** mặt nền rộng thêm 3 km mỗi phía.

Đó là các vùng đất trống và đường kéo dài trong ảnh 2.

**Sau — phương án C (Hybrid):**
- **Vùng lõi:** giữ nguyên `CITY_BOUNDS`.
  - Lề tới địa điểm gần mép nhất: Bitexco cách mép Nam 284 m; các mép khác 480–510 m.
  - Mật độ được **giữ đến sát mép**: `edgeKeep` chỉ còn tưa nhẹ trong khoảng 100 m cuối, thay vì thưa dần từ 370 m vào trong.
- **Vùng đệm:** `DIORAMA_PAD` = 240 m quanh lõi (`lib/city/buildCity.ts` → `DIORAMA`).
  - Đường chính, đường dân sinh, sông và kênh thật từ OSM được cắt chính xác theo mép (Liang–Barsky / Sutherland–Hodgman).
  - Nhà khái quát xếp dọc đường thật, mật độ 100 % → 65 % ra tới mép.
  - Không nhà nào vắt qua mép.
- **Kích thước sa bàn:** x −1 100…3 640, z −2 740…1 500 = 4,74 × 4,24 km ≈ **20 km²**, giảm **~80 %** so với vành cũ, chưa tính mặt nền 3 km.
  - Mọi địa điểm cách mép ≥ 520 m.
- **Mép sa bàn:** mặt đất chỉ phủ đúng vùng sa bàn, đứng trên **đế trưng bày**:
  - viền mực `#2b241d` cao 6 m (đồng bộ viền UI);
  - thân gỗ `#c9a77c`.
  - Đây là phần đế trang trí, không phải địa hình (`sau_edge_sw.jpg`, `sau_edge_ne.jpg`).
  - Không dựng vách núi hay bờ đất giả.
- **Toạ độ không đổi:** không địa điểm nào bị dời; phép chiếu `project()` giữ nguyên; dữ liệu ngoài sa bàn không bị xoá khỏi file, chỉ không dựng.
- **Camera:**
  - `maxDistance` 5 200 → 4 600 m;
  - giới hạn target vẫn là vùng lõi;
  - góc mở đầu và nút "Góc nhìn ban đầu" giữ nguyên khung nhìn toàn bộ 10 địa điểm (`sau_overview.jpg`).

**Hạn chế:** vùng cắt là hình chữ nhật, nên vẫn chứa phần đất trống thật ở Thủ Thiêm (bờ Đông sông). Đó là địa lý thật (khu đô thị đang xây), không lấp nhà giả.

## F. Hiệu năng

Đo trong Chrome headless + GPU (ANGLE D3D11) trên máy phát triển, chất lượng "medium", 1600×900. FPS headless thấp hơn trình duyệt thật, dùng để so sánh tương đối.

| Khung nhìn | FPS | Draw calls | Tam giác (gồm pass bóng) |
|---|---|---|---|
| Tổng thể (home) | 21 | 319 | 5,29 M |
| Trung tâm Q1, tầm trung | 23 | 322 | 5,29 M |
| Cận cảnh đường phố | 15,5 | 167 | 9,04 M |

- Mốc trước nâng cấp (cùng công cụ, đo trong lần nâng cấp UI trước): tổng thể 19,8 FPS, cận cảnh 17,6 FPS. Hiện tại tương đương.
- Không thêm vật liệu nào cho nhà: chi tiết mới vào bucket chung. Cây thêm 6 draw call (instanced).
- Vùng ngoại ô giảm mạnh: nhà khái quát và cây chỉ còn trong dải 240 m.
- Chưa làm LOD theo chunk cho nhà; bucket `details` đã tắt khi xa.

## G. Thanh % tải tài nguyên (yêu cầu kèm theo)

Màn hình chờ bản đồ có **thanh ngang với % thật**:
- **0–40 %:** tải `city.json`, đọc theo luồng byte. Có gzip thì dùng kích thước gốc đã biết.
- **40–100 %:** dựng thành phố trong Web Worker. Worker báo tiến độ tại 8 giai đoạn: nhà OSM, nhà phố, ngõ, đường, cầu, bờ, cây, dữ liệu mô phỏng.
- Khi quay lại bản đồ (đã có cache) thì hiện 100 % ngay.

Giá trị ghi nhận khi tải: 40, 43, 60, 66, 74, 80, 83, 86, 90, 100 (`sau_loading.jpg`).

## H. Kiểm thử

- `vitest`: **93/93 đạt**. Hai test cũ khẳng định hành vi cũ (thành phố thưa 400 m ở mép; vành nhà 1,4 km) được viết lại theo yêu cầu mới. Thêm test "không vẽ gì ngoài sa bàn".
- `tsc --noEmit`, `eslint`: sạch.
- `next build`: thành công.
- Regression: chọn Dinh Độc Lập → "Bắt đầu" → tới `/dinh-doc-lap`, phase `choose` sau 30 s. Không lỗi console nghiêm trọng; chỉ có cảnh báo deprecation của three.js.

## I. File đã chỉnh sửa

**Mã nguồn:**
- `components/map/CityScene.tsx`: nhãn (`markerAnchor`, `MarkerStems`, `MarkerProjector`), đế sa bàn (`MapBase`), ánh sáng đêm, sương, camera, dev hook QA.
- `components/map/HomeExperience.tsx`: bỏ cột DOM và transition, thêm `LoadBar`.
- `components/map/CityLayers.tsx`: 6 loài cây, phát sáng cửa sổ đêm, màu nền đêm, mặt trời/trăng.
- `components/map/OutskirtsLayer.tsx`: màu đêm.
- `lib/city/architecture.ts`: `frontParapet`, `stairHut`, `facadeFins`, tháp giật cấp.
- `lib/city/buildCity.ts`: `DIORAMA`, `edgeKeep`, clip theo hình chữ nhật bất kỳ, phân cấp màu đường, chọn loài cây theo lùm, callback tiến độ.
- `lib/city/outskirts.ts`: vùng đệm cắt theo sa bàn, mật độ, khoảng cách vuông.
- `lib/city/useCityBuild.ts`: tiến độ tải và dựng (`useLoadProgress`).
- `lib/city/city.worker.ts`: gửi tiến độ.
- `lib/store/settings.ts`: mặc định ban ngày.

**Test:** `tests/landmarks.test.ts`, `tests/outskirts.test.ts`.

**Tài liệu, ảnh:** báo cáo này, `docs/screenshots/map/sau_*.jpg`.

**Không chỉnh sửa:**
- toàn bộ Dinh Độc Lập (`components/game/*`, `data/dinh/*`, `lib/dinh/*`);
- mô hình landmark (`LandmarkModels.tsx`);
- dữ liệu OSM (`public/data/*.json`);
- Scene Manager, Guided Tour, Minh Anh, i18n.

Không thêm shader hay asset mới.
