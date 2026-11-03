# Báo cáo nâng cấp giao thông đường bộ, đường thủy và mặt sông — Saigon Map

Ngày: 30/10/2026. Phạm vi: bản đồ thành phố (`/`). Dinh Độc Lập, Guided Tour, camera và nhãn địa điểm **không bị chỉnh sửa**.

Ảnh: `docs/screenshots/traffic/*.jpg` (Chrome headless, GPU ANGLE/D3D11, 1600×900).

**Phase 1 — hiện trạng:** dự án đã có sẵn một hệ "LivingCity" gồm:
- lane graph từ OSM, có tôn trọng đường một chiều;
- đèn tín hiệu hai pha;
- rẽ theo đường cong Bézier;
- xe, tàu chạy vòng, người đi bộ, chim.

Lần này **mở rộng hệ thống đó**, không tạo hệ song song.

## 1. Danh sách phương tiện

Tất cả là low-poly, dùng InstancedMesh. "Thân" (paint) nhận màu theo từng xe; "trim" là kính, đèn, lốp, người lái.

| Loại | Biến thể | Hình học | Animation | Tích hợp |
|---|---|---|---|---|
| Xe máy | 5: xe số, tay ga, giao hàng (thùng hàng), chở 2 người, xe máy điện | thân, yên, tay lái, đèn trước/sau, người lái đội mũ | bánh quay, nghiêng khi rẽ (≤ 0,4 rad, theo v·ω/g) | ✓ |
| Xe đạp | 1 | khung, yên, tay lái, người đạp | bánh quay, nghiêng | ✓ |
| Ô tô | 6: sedan, hatchback, SUV (giá nóc, gương), bán tải (thùng hở), ô tô điện (mái kính, dải đèn), taxi (hộp đèn mui) | thân, cabin, kính 4 phía, đèn | bánh quay; đèn sáng ban đêm | ✓ |
| Xe khách | 2: xe buýt 11 m, minibus 16 chỗ | thân, dải kính, kính lái, đèn | bánh quay; rẽ chậm theo bán kính | ✓ |
| Xe hàng | 3: van, xe tải nhỏ (bạt), xe tải thùng 8,8 m | cabin, thùng, sát-xi | bánh quay | ✓ |
| Tàu du lịch | 2: tàu 2 tầng, tàu một tầng khoang kính có boong mũi và lan can | thân mũi nhọn, cabin, kính, lan can, mái | lắc nhẹ, nghiêng khi rẽ | ✓ |
| Tàu khách / waterbus | 1 | thân dài, khoang kính, buồng lái | như trên | ✓ |
| Ca nô | 1 | thân thon, kính chắn gió | ngóc mũi theo tốc độ, quay nhanh | ✓ |
| Sà lan, tàu hàng, tàu kéo | 3 | sà lan chở cát; tàu container nhỏ có cabin và ống khói; tàu kéo có lốp chắn | quán tính lớn (phản ứng 0,12–0,3) | ✓ |
| Thuyền nhỏ | 1 | thân, mái che | lắc mạnh hơn | ✓ |

Màu sơn có nhiều bảng màu theo loại: trắng, đỏ, xanh, đen, xám, pastel. Hộp hàng giao đồ dùng màu trơn, **không có logo hay thương hiệu**.

## 2. Giao thông đường bộ (`lib/sim/traffic.ts`)

**Graph:** dùng lane graph sẵn có (`lib/city/roads.ts`). Mỗi lane có:
- polyline, chiều dài, bề rộng, lớp đường (`major` / `minor` / `local`);
- tốc độ, nút cuối, danh sách lane nối tiếp hợp lệ, cờ một chiều.

Đường hai chiều đi bên phải; đường một chiều chạy giữa. **Ước lượng:** OSM không ghi số làn, nên mỗi chiều coi là một làn; xe hai bánh có thể đi hai hàng song song.

**Bổ sung:**
- **Tỷ lệ phương tiện** (tỷ lệ nghệ thuật, không phải thống kê):
  - trục chính: ~57 % xe hai bánh, ~27 % ô tô/taxi, ~6 % buýt, ~8 % hàng, ~2 % xe đạp;
  - đường nhỏ và hẻm: chủ yếu xe máy, không có buýt hay xe tải lớn.
  - Thực đo ở mức Medium: 3 616 xe, 67 % là xe hai bánh, vì hẻm và đường nhỏ chủ yếu là xe máy.
- **Loại đường được phép:**
  - buýt, minibus, SUV, bán tải, xe tải nhỏ: chỉ trục chính và đường thường;
  - xe tải lớn: chỉ trục chính, và **không xuất hiện trong bán kính 900 m quanh lõi di sản** (Dinh, Nhà thờ, Bến Thành).
- **Mật độ:** theo lớp đường (1 / 0,6 / 0,2) nhân hệ số "nhộn nhịp": cao quanh trung tâm Quận 1, giảm dần trong khoảng 2,4 km.
- **Rẽ:**
  - lane tiếp theo được chọn trước khoảng 35 m;
  - xe phanh êm về **tốc độ an toàn v = √(a_ngang · R)**, với R ước lượng từ dây cung và góc rẽ (`cornerSpeed`);
  - gia tốc ngang mỗi loại khác nhau: xe máy 3,2, ô tô 2,2, buýt 1,1 m/s². Cùng một góc vuông, buýt chậm hơn xe máy hơn 30 %.
- **Giao lộ:** giữ đèn tín hiệu hai pha (10 s xanh, 2 s đỏ toàn phần), giữ khoảng cách bám xe, và xe chỉ vào giao lộ khi lane kế tiếp còn chỗ.
- **Chống kẹt:** xe đứng yên quá 30 s sẽ tái xuất ở lane khác, **chỉ khi nằm ngoài tầm nhìn camera**.
- **Người đi bộ:** dùng hệ có sẵn (vỉa hè, công viên, quảng trường, nhóm nhỏ, thú cưng). Số người ít hơn nhiều so với số xe; không chỉnh thêm.

**Giới hạn:**
- Không mô phỏng chuyển làn hay vượt, không có pha rẽ trái riêng. Xe hai bánh đi song song bằng "làn phụ".
- Ở vài đường gom ven sông, lane OSM nằm sát mép vỉa hè đã vẽ, nên khi nhìn gần xe trông như chạy sát lề.

## 3. Giao thông đường thủy (`lib/sim/water.ts`)

**Waterway graph:**
- Lấy đường tim của sông và kênh từ hình học nước thật.
- Từ đó dựng tuyến vòng: chạy bên phải luồng, quay đầu bằng cung tròn rộng.
- Đoạn quay đầu được **kiểm tra trên mặt nạ nước**; nếu cung chạm bờ thì tuyến tự rút ngắn lại.
- Đây là **tuyến mô phỏng**, không phải luồng hàng hải đã xác minh.

**Ràng buộc theo bề rộng luồng:**
- sà lan, tàu hàng: nửa bề rộng ≥ 90 m;
- tàu du lịch: ≥ 60–70 m;
- ca nô: ≥ 25 m;
- kênh hẹp chỉ có thuyền nhỏ và ca nô.

**Phân bổ đội tàu:**
- Theo trọng số: du lịch 25 %, chở khách 20 %, ca nô 20 %, hàng 20 %, nhỏ 15 %.
- Gán theo "thiếu hụt lớn nhất", nên loại hiếm (tàu kéo, tàu hàng) vẫn xuất hiện.
- Sông Sài Gòn nhận phần lớn số tàu.
- Medium có 26 tàu, đủ 8 loại.

**Cầu:** mặt cầu qua sông được nâng cao 11 m, nên tàu đi dưới cầu. Mô hình Cầu Ba Son có trụ tháp trên bờ Đông, không nằm trong luồng.

**Kiểm thử:** tàu luôn ở trên nước, cao độ từ −0,1 đến 0,2 m (không chìm, không bay), tàu lớn chỉ ở luồng rộng.

## 4. Water renderer (`lib/city/waterMaterial.ts`, mới)

Một vật liệu dùng chung cho sông trong thành phố và vùng đệm (trước đây vùng đệm là nước tĩnh). Nó mở rộng `MeshStandardMaterial` bằng `onBeforeCompile` và chỉ biên dịch một chương trình shader:

- **Gợn sóng:** ba lớp làm lệch pháp tuyến — sóng nhỏ nhanh, sóng dài biên độ thấp, nhiễu trôi chậm mô phỏng dòng chảy.
- **Màu:** mảng đậm nhạt mềm, vệt dòng chảy trôi nhẹ trên nền teal `#4e9f98`.
- **Ánh sáng:**
  - độ nhám 0,14 để bắt sáng mặt trời;
  - Fresnel ánh màu trời ở góc nghiêng;
  - lấp lánh thưa trên đỉnh gợn.
  - Ban đêm chuyển sang xanh đậm có ánh trăng, không đen.
- **Vệt sóng tàu (wake)** — mỗi pixel nước tính từ vị trí, hướng, tốc độ và kích thước của từng tàu (tối đa 40):
  - hai cánh Kelvin mở khoảng 19,5° phía sau đuôi;
  - vệt nước xáo trộn theo đường chạy;
  - sóng mũi quanh thân tàu;
  - mờ dần theo khoảng cách, cường độ theo tốc độ: ca nô rõ nhất, sà lan rộng nhưng nhẹ.
  - Wake đi theo tàu, không đứng yên và không tồn tại mãi.
  - Không tạo mesh nào thêm. Ngoài 1,8 km thì tắt.
- **Ven bờ:** hai dải nước nông màu teal sáng nằm ngay trong bờ kè, tạo chuyển tiếp mềm; không dùng viền trắng.
- **Đèn xe/tàu ban đêm:** vật liệu trim nhận diện màu đèn pha và đèn hậu, cho chúng phát sáng khi chế độ đêm bật.

Ảnh:
- trước: `truoc_song.jpg`;
- sau: `song_cau_ba_son.jpg`, `vet_song_ca_no.jpg`, `dem_song.jpg`.

## 5. Hiệu năng

**Tối ưu đã áp dụng:**
- **Mô phỏng bước cố định 30 Hz** (`TrafficSimulation.step`). Ở 60 FPS: 0,8 ms/khung, trước đây 2,2 ms.
- **SimulationLOD:** chỉ xe trong tầm nhìn (frustum + lề 40 m) được tính lại tư thế mỗi khung; số còn lại theo lịch xoay vòng 1/8. Xe trở lại tầm nhìn thì đặt thẳng vào vị trí đúng, không trượt.
  - Đo ở góc trung bình Q1: tính tư thế 3,2 → 1,8 ms.
- **Chỉ vẽ xe trong tầm nhìn:** mỗi khung, xe nhìn thấy được dồn vào đầu instance buffer và `count` = số xe thấy được. Màu sơn gắn theo từng xe nên không nhấp nháy. Bánh xe xử lý tương tự.
- Mỗi loại xe/tàu dùng 2 draw call cố định, không tăng theo số lượng xe.
- Wake không tốn geometry. Ngoài 1,3 km ẩn người đi bộ; ngoài 650 m ẩn bánh xe.
- Khi rời bản đồ vào Dinh, canvas bản đồ unmount, nên toàn bộ mô phỏng dừng hẳn.

**Ba mức mật độ** (theo cài đặt "Chất lượng" sẵn có, không thêm quality manager):

| Mức | Xe | Tàu | Trước nâng cấp |
|---|---|---|---|
| Low | 1 400 | 12 | 360 / 8 |
| Medium (mặc định) | 3 600 | 26 | 900 / 18 |
| High | 5 600 | 36 | 1 500 / 26 |

**Đo ở mức Medium** (Chrome headless + GPU, máy phát triển đang chạy song song trình duyệt khác của người dùng, nên số tuyệt đối dao động; so sánh tương đối):

| Khung nhìn | Trước (900 xe) | Sau (3 616 xe) | Draw calls | Tam giác |
|---|---|---|---|---|
| Tổng thể | 21 FPS | 20,5 FPS | 344 | 5,6 M |
| Cận cảnh phố | 15,5 FPS | 15,3 FPS | 225 | 9,3 M |
| Q1 tầm trung | — | 14,4 FPS | 227 | 9,1 M |

- Chi phí JS: giao thông ~2,5–4 ms/khung; tàu thuyền 0,03 ms.
- Chưa đo riêng được thời gian GPU của shader nước (không có công cụ timer query trong môi trường này).
- **Chưa làm:** tự giảm mật độ khi FPS thấp; LOD mô hình xe theo khoảng cách (hiện dùng một mức chi tiết).

**Lỗi đã gặp và sửa:** bật/tắt `castShadow` của InstancedMesh xe mỗi khung làm phần thân xe ngừng hiển thị. Đã bỏ việc bật/tắt đó; xe giữ cấu hình bóng cố định như trước.

## 6. Kiểm thử và file

- `vitest`: **97/97 đạt**, thêm 4 test mới:
  - tỷ lệ và loại đường của xe;
  - tốc độ vào cua theo kích thước và giới hạn độ nghiêng;
  - 8 loại tàu, tàu luôn trên nước, cao độ hợp lệ;
  - dữ liệu wake cho shader.
- Các test cũ vẫn đạt: xe không rời mặt đường, không chồng nhau trong làn, không dịch chuyển tức thời, không kẹt cứng.
- Test xe trên mặt đường được nới timeout lên 240 s vì mô phỏng nhiều xe hơn.
- `tsc --noEmit`, `eslint`: sạch. `next build`: thành công.
- Regression bản đồ → Dinh Độc Lập: OK, 28 s.

**File chỉnh sửa:**
- `lib/sim/models.ts`, `lib/sim/traffic.ts`, `lib/sim/water.ts`, `lib/sim/config.ts`
- `lib/city/buildCity.ts` (dải nước nông ven bờ)
- `components/map/LivingCity.tsx`, `components/map/CityLayers.tsx`, `components/map/OutskirtsLayer.tsx`
- `tests/sim.test.ts`

**File mới:** `lib/city/waterMaterial.ts`, báo cáo này, `docs/screenshots/traffic/*`.
