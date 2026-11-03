# Báo cáo nâng cấp nhà cửa, bảng màu và ánh sáng ngày/đêm — Saigon Map

Ngày: 30/10/2026. Phạm vi: bản đồ thành phố.

Các phần sau **không bị chỉnh sửa**: Dinh Độc Lập, camera, nhãn địa điểm, landmark, đường, toạ độ, Guided Tour.

Ảnh: `docs/screenshots/buildings/`.
- `truoc_*`: trước nâng cấp.
- `sau_*`: sau nâng cấp, chụp ở cùng vị trí camera.
- Ảnh cận cảnh phố thêm: `sau_pho_can_canh*.jpg`, `sau_dem_pho_can_canh.jpg`.

## Phase 1 — Nguyên nhân

| Vấn đề | Nguyên nhân trong code |
|---|---|
| Đêm "kinh dị" | Texture phát sáng của mặt tiền (`lib/city/textures.ts`) là **một mẫu 4×4 ô cửa cố định**, khoảng 35 % ô sáng. Mẫu này lặp lại trên **mọi tòa nhà toàn thành phố**, cùng màu vàng, cùng cường độ, nên skyline thành một lưới đèn đồng bộ. Không có bloom; độ lóa đến từ emissive và mật độ ô sáng. |
| Kính đen sì | Gradient kính kết thúc ở `#4b6f84` (rất tối); cao ốc dùng bảng màu kính xanh xám đậm. |
| Màu xỉn, olive | Bảng màu tường có nhiều olive/xám nhạt (`#b8c9a3`, `#a9c2b6`…); mái ngói đỏ sẫm; tán cây độ sáng 34 %. |
| Mặt tiền phẳng | Cửa sổ, cửa chớp, lan can chỉ là texture vẽ trên mặt phẳng. Geometry mặt tiền chỉ có ban công thỉnh thoảng, mái hiên và bảng hiệu. |

## Phase 2 — Geometry nhà cửa (`lib/city/architecture.ts`)

**Mới — `streetFacade`:** áp dụng cho mặt tiền ra đường của mọi nhà phố. Tất cả là khối 3D thật:
- **Gờ chia tầng** nhô 0,3 m ở mỗi sàn.
- **Khung cửa sổ** đặt trùng vị trí ô cửa của texture (tính theo số khoang của mặt tiền):
  - bậu cửa dưới, mái che (hood) trên;
  - 25 % nhà có thêm trụ khung hai bên;
  - màu khung tương phản: trắng, kem hoặc xanh nhạt.
- **Cửa chớp** hai cánh màu sơn (xanh lá, xanh dương, nâu đỏ…) ở 40 % nhà có khoang đủ rộng.
- **Trụ tầng trệt** hai bên đóng khung mặt tiền cửa hàng.
- **Ba ngôn ngữ mặt tiền tầng trên**, chọn ngẫu nhiên ổn định cho từng nhà:
  1. ban công liên tục mọi tầng (sàn + lan can thấp + tay vịn mảnh);
  2. khung lô-gia sâu bao cả tầng;
  3. cửa sổ có khung.

**Mới — `roofCanopy`:** mái che sân thượng (4 cột + tấm mái tôn dốc) cho khoảng 30 % nhà mái bằng không có tum thang.

**Sửa:** lan can ban công cũ là một tấm tối cao 0,8 m, nhìn như dải đen. Nay là lan can thấp sáng màu và tay vịn sắt mảnh.

**Giữ từ đợt trước, nay kết hợp với các phần trên:**
- mặt tiền giả (đỉnh bậc / mái ngói giả), tum thang mái ngói;
- mái dốc ngói/tôn hoặc mái bằng có tường chắn, bồn nước inox, khối kỹ thuật, chậu cây mái;
- mái hiên, bảng hiệu, ban công cũ;
- văn phòng có lam đứng, cao ốc giật cấp.

**Biến thể:** mỗi nhà phố kết hợp ngẫu nhiên nhưng ổn định:
- số tầng (từ dữ liệu OSM khi có);
- kiểu mái (ngói, ngói hông, tôn, bằng);
- kiểu mặt tiền tầng trên;
- màu tường (16 màu);
- màu khung, cửa chớp có hay không;
- tum thang hoặc mái che;
- mặt tiền giả, mái hiên, bảng hiệu.

Hai nhà liền kề hiếm khi trùng cả bộ đặc điểm.

**Tối ưu:**
- Toàn bộ chi tiết mới gộp vào bucket `details` có sẵn, không thêm vật liệu hay draw call.
- Chi tiết chỉ vẽ khi camera gần hơn 1 km (trước đây 1,5 km).
- Chi tiết **nhận bóng nhưng không đổ bóng**: tường và mái vẫn tạo hình bóng, còn pass bóng không phải vẽ hàng triệu tam giác nhỏ.

## Phase 3 — Bảng màu và ánh sáng ban ngày

- **Tường:** 16 màu pastel ấm, sáng hơn (kem, mơ, hồng đất, xanh bạc hà, xanh trời nhạt, tím nhạt). Bỏ các tông olive/xám đục. Căn hộ và văn phòng cũng sáng hơn.
- **Mái ngói:** đỏ cam rõ hơn (`#d95a3b`, `#e46c42`…) nhưng không neon. Mái tôn thêm sắc xanh ngọc và cam đất.
- **Kính:**
  - texture kính dùng gradient trời sáng (`#eef8fc` → `#6f9db3`), có thêm vệt phản chiếu chéo;
  - cao ốc dùng bảng màu kính xanh trời sáng;
  - kính không còn đen.
- **Cây:** tán sáng hơn (độ sáng 40–55 %, bão hòa ~0,6), xanh tươi trong.
- **Ánh sáng:**
  - exposure 1,0 → 1,12;
  - mặt trời 2,4 → 2,75;
  - hemisphere 1,05 → 1,2 (trời `#fff6e6`, đất `#c9b48a`);
  - ambient giảm nhẹ 0,3 → 0,28 để mặt đứng vẫn phân biệt sáng/tối.
  - Tone mapping Neutral giữ nguyên; bóng mềm như cũ.

## Phase 4 — Night mode

**Hệ cửa sổ sáng mới** (shader trong `facadeMaterial`):
- Texture phát sáng giờ chỉ là **mặt nạ ô kính**. Việc ô nào sáng do shader quyết định **cho từng ô cửa** (khoang × tầng), theo:
  - một số ngẫu nhiên ổn định của ô đó;
  - "khối nhà": vị trí thế giới (lưới ~11 m) cộng hướng mặt đứng.
- **Không đồng loạt:** mỗi khối nhà có tỷ lệ phòng sáng riêng, 7–35 % (phân bố lệch về thấp). Thỉnh thoảng hai ô liền nhau sáng cùng nhau như một căn hộ.
- **Không đồng cường độ:** mỗi ô sáng có cường độ 35–100 %.
- **Không đồng màu:** vàng ấm 40 %, trắng ấm 32 %, trắng dịu 20 %, cam nhẹ 8 %; không có màu neon.
- **Ổn định:** pattern chỉ phụ thuộc vị trí và chỉ số ô cửa, nên không nhấp nháy và không đổi khi xoay camera.
- **Cường độ tổng** `uWin` = 0,62 (thay cho emissive 1,0 phủ kín trước đây). Không thêm bloom.

**Ánh sáng môi trường đêm:**
- hemisphere xanh đêm 1,15, ambient 0,5, ánh trăng 0,95 `#b3c4ff`;
- nước xanh đậm có phản chiếu nhẹ (shader nước từ đợt trước);
- silhouette công trình đọc được nhờ ánh sáng tổng thể, không chỉ nhờ cửa sổ.

**Đèn đường mới (`StreetLights`):**
- Cột đèn có cần vươn ra lòng đường dọc các trục chính, khoảng 38 m một cột, tối đa 2 200 cột, không đặt trên cầu hay cầu vượt.
- Ban đêm, chóa đèn sáng dịu và mỗi cột hắt một **vũng sáng ấm mờ dần trên mặt đường** (vẽ cộng sáng, không dùng nguồn sáng động).
- Tổng cộng 3 draw call.

## Phase 5 — Kiểm thử

**Trực quan**, so sánh cùng vị trí camera trước/sau:
- ban ngày: phố cận cảnh, dãy phố quận 3, góc trung bình, tổng thể, skyline;
- ban đêm: phố cận cảnh, góc trung bình, tổng thể, skyline;
- phố cận cảnh mức đường (ngày và đêm).

Kết quả:
- **Ban ngày:** màu tươi và sáng hơn, mái đỏ nổi, kính sáng; mặt tiền nhà phố có khung, bậu, cửa chớp, gờ tầng, ban công, mái che sân thượng.
- **Ban đêm:** chỉ một phần nhỏ cửa sổ sáng, phân bố không đều với màu và độ sáng khác nhau. Skyline đọc rõ từng tòa, không còn lưới đèn đồng bộ, không lóa.

**Hiệu năng** (Medium, Chrome headless + GPU; số tuyệt đối dao động do máy đang chạy ứng dụng khác):

| Khung nhìn | Trước | Sau | Tam giác sau |
|---|---|---|---|
| Tổng thể | 20,5 FPS | 20,4–20,9 FPS | 5,8 M |
| Q1 tầm trung | 14,4 FPS | 18,8–20,7 FPS (chi tiết tắt ngoài 1 km) | 5,8 M |
| Cận cảnh phố | 15,3 FPS | 10,7–12 FPS | 10,4 M |

- Lần đo đầu tiên (chi tiết đổ bóng, hiện tới 1,5 km) cho 15,3 M tam giác và 9,6–11 FPS. Sau tối ưu như trên còn 10,4 M.
- **Giới hạn:** ở cận cảnh phố, FPS thấp hơn trước khoảng 20 % vì có nhiều chi tiết mặt tiền hơn. Hướng cải thiện tiếp:
  - tách bucket chi tiết theo ô không gian để frustum culling;
  - dùng hộp chỉ có các mặt nhìn thấy (bỏ mặt áp tường).

**Hệ thống:**
- `vitest` 97/97 đạt;
- `tsc --noEmit` và `eslint` sạch;
- `next build` thành công;
- chuyển bản đồ → Dinh Độc Lập OK (25,8 s);
- nhãn, camera, giao thông, tàu thuyền hoạt động bình thường.

## File chỉnh sửa

- `lib/city/architecture.ts`: bảng màu, `streetFacade`, `roofCanopy`, lan can.
- `lib/city/textures.ts`: kính sáng, mặt nạ cửa sổ, shader cửa sổ đêm, `facadeUniforms`.
- `components/map/CityLayers.tsx`: đèn cửa sổ theo theme, cây tươi hơn, mặt trời, `StreetLights`, chi tiết không đổ bóng và vẽ tới 1 km.
- `components/map/CityScene.tsx`: exposure, hemisphere, ambient, gắn `StreetLights`.
- `docs/screenshots/buildings/*`, báo cáo này.
