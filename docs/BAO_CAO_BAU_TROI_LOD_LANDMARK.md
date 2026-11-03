# Báo cáo: bầu trời ngày/đêm, vùng nền, đường phố, LOD, Dinh Độc Lập, giao thông, cầu Ba Son, landmark

Ngày 30/10/2026. Phạm vi: bản đồ thành phố (`/`).

Các phần sau **không bị chỉnh sửa**:
- scene tham quan Dinh Độc Lập (nội thất, texture);
- camera, nhãn địa điểm, toạ độ;
- Guided Tour, Minh Anh, WASD/F.

Ảnh so sánh: `docs/screenshots/sky_lod/`.
- `truoc_*`: trạng thái cuối lượt trước, cùng vị trí camera.
- `truoc_cau_ba_son.jpg`: cầu Ba Son trước khi sửa.
- `sau_*`: sau lượt này.

## Tình trạng theo hạng mục

| # | Hạng mục | Trước khi tạm dừng | Sau khi tiếp tục | Trạng thái |
|---|---|---|---|---|
| 1 | Vùng tối quanh bản đồ | Bầu trời + biển mây, khung nhìn gần hơn | Kiểm tra lại ảnh ngày/đêm | Hoàn thành, đã kiểm chứng bằng ảnh |
| 2 | Bầu trời & ánh sáng ngày/đêm | Sky dome, nắng sớm, đêm ấm | Sửa màu trời (bỏ chuyển đổi màu thừa), cân lại ánh sáng đêm | Hoàn thành, đã kiểm chứng |
| 3 | Đường, vỉa hè, bó vỉa | Đồng bộ màu, bó vỉa | Kiểm tra ảnh mức đường; test mặt đất đạt | Hoàn thành |
| 4 | LOD theo zoom | Mờ dần chi tiết, bỏ bóng khi xa, giảm xe khi xa | **Sửa tụt FPS ở tầm trung** (dời vùng chuyển tiếp xuống 700–900 m) | Hoàn thành, đã đo |
| 5 | Dinh Độc Lập nhòe | Sửa z-fighting, mặt tiền mới | Kiểm tra ảnh | Hoàn thành |
| 6 | Giao thông | 5 000 xe, thêm xe con/xe lớn | Đo phân bố; test đạt | Hoàn thành |
| 7 | Cầu Ba Son | Trụ cánh buồm nghiêng, dây văng/néo | Kiểm tra ảnh | Hoàn thành (xem giới hạn) |
| 8 | Landmark | Texture mặt tiền cho 8 công trình | Kiểm tra ảnh cận | Hoàn thành |
| — | Báo cáo, test, build | — | Báo cáo này; test/lint/typecheck/build | Hoàn thành |

## 1. Khoảng tối xung quanh bản đồ

**Nguyên nhân:** nền là một màu phẳng (`#26354f` khi đêm). Quanh sa bàn chỉ có màu đó cùng sương mù cùng màu, nên tạo cảm giác khoảng không tối.

**Cách xử lý:**
- **Sky dome mới** (`components/map/Sky.tsx`): một shader, một draw call, không texture, luôn bám theo camera nên không bị cắt. Nó vẽ:
  - bầu trời phía trên đường chân trời;
  - **phía dưới đường chân trời là một biển mây mềm** trôi chậm. Sa bàn trông như đang lơ lửng trên mây, không còn nằm giữa khoảng tối.
- Sương mù lấy đúng màu chân trời (ngày `#f1e6d4`, đêm `#2a2342`), nên rìa bản đồ hoà vào trời.
- Khung nhìn mặc định (và nút "Góc nhìn ban đầu") gần hơn 14 % nên bản đồ chiếm nhiều màn hình hơn.
- Phạm vi địa lý và đế sa bàn giữ nguyên.

## 2. Bầu trời ngày và đêm

**Ban ngày:**
- Gradient từ xanh đỉnh trời xuống chân trời vàng ấm nắng sớm.
- Mặt trời có quầng sáng; mây tích trôi chậm, sáng ấm ở phía mặt trời.
- Ánh nắng đổi sang **nắng sớm từ hướng đông nam**, góc cao khoảng 37°, màu `#ffe2b8`.
  - Hướng sáng khớp với mặt trời vẽ trên trời.
  - Các mặt nhà nhìn thấy từ góc mặc định được chiếu sáng; bóng đổ dài hơn nên khối rõ hơn.

**Ban đêm:**
- Đỉnh trời xanh thẫm, chân trời tím có ánh cam của đèn đô thị.
- Sao lấp lánh; mặt trăng có quầng ở hướng đông bắc; mây mỏng được trăng soi.

**Sửa lỗi màu:** lần đầu màu trời bị nhạt vì shader cộng thêm một bước đổi màu tuyến tính → sRGB. Đã bỏ bước đó: màu trong shader là màu hiển thị.

## 3. Nguồn sáng ban đêm (ấm hơn)

- **Cửa sổ:** vẫn mỗi ô một quyết định riêng, ổn định, không đồng bộ (đã làm ở lượt trước).
  - Tỷ lệ sáng tăng từ 7–35 % lên **10–44 %** mỗi tòa; cường độ chung 0,62 → 0,85.
  - Màu đèn vẫn trộn vàng ấm, trắng ấm, trắng dịu và cam nhẹ.
- **Đèn đường:**
  - đặt thêm trên cả **đường thường**, không chỉ trục chính: tối đa 4 200 cột, mỗi 36 m trên trục chính, 46 m trên đường thường;
  - vũng sáng trên mặt đường màu cam ấm `#ffb46a`, đậm hơn (0,42).
- **Đèn xe:** đèn pha/hậu phát sáng ban đêm (đã có từ lượt giao thông).
- **Chiếu sáng công trình:** tường đá, vữa, gạch và các mặt tiền landmark được hắt sáng ấm nhẹ (`#ffb878`, 0,16) khi đêm.
- **Ánh sáng môi trường:**
  - trời xanh nhạt hơn (hemisphere 1,15 → 0,9);
  - **ánh phản ấm từ mặt đường lên** (màu đất `#7a5236`);
  - ambient ấm `#ffd9b5`.
  - Kết quả: thành phố bớt lạnh và nhợt, ánh đèn nổi hơn.
- **Mặt sông** phản chiếu trời đêm tím ấm thay vì xanh lạnh.
- Không dùng bloom, không đổi tone mapping.

## 4. Đường, vỉa hè, bó vỉa (`lib/city/buildCity.ts`)

- **Đồng bộ màu:** bỏ ba tông xám chênh nhau. Còn một họ nhựa đường: trục chính `#686e72`, đường thường `#737a7e`. Phân cấp đường thể hiện bằng bề rộng, bó vỉa và vạch sơn.
- **Bó vỉa:** một đường sáng `#efebe2` rộng 0,45 m dọc **hai mép** mọi lòng đường.
  - Ngắt tại giao lộ (theo mặt nạ giao lộ) và trên mặt nước.
  - Chỉ sinh điểm ở đỉnh và chỗ ngắt, nên số tam giác tương đương chính con đường.
- Vỉa hè, vạch tim đường và thứ tự vẽ các lớp mặt đất (không z-fighting) giữ nguyên.
- Test "mọi tam giác mặt đất hướng lên" vẫn đạt.

## 5. LOD / chi tiết theo zoom

Các cơ chế có sẵn được mở rộng, không tạo hệ song song:

| Thành phần | Cơ chế | Ngưỡng |
|---|---|---|
| Chi tiết mặt tiền, ban công, đồ trên mái | mờ dần (dithered alpha-hash: không cần sắp xếp, không bật/tắt đột ngột), sau đó không vẽ | 700 → 900 m |
| Cây nhỏ / bụi | mờ dần theo độ cao camera | 900 → 1 300 m |
| Cột và chóa đèn đường | mờ dần; vũng sáng ban đêm vẫn giữ | 900 → 1 300 m |
| Bóng đổ | bóng đã mờ hết từ 1,5 km; **bỏ hẳn bước tính bóng** | > 1 600 m |
| Xe cộ | chỉ vẽ một nửa cố định (xe số chẵn), không nhấp nháy | > 2 600 m |
| Bánh xe, người đi bộ, chim, đồ đường phố | giữ ngưỡng sẵn có | 650 m / 1,3 km / … |
| Mô phỏng xe | bước cố định 30 Hz; chỉ cập nhật tư thế xe gần tầm nhìn (lượt giao thông) | — |

**Lỗi đã sửa sau khi tiếp tục:** với vùng chuyển tiếp 850–1 050 m, góc nhìn tầm trung (~1 km) nằm đúng vùng chi tiết đang mờ dần nên vẫn vẽ toàn bộ: 10,6 triệu tam giác, 10,2 FPS. Dời về 700–900 m: 6,0 triệu tam giác, 19,5 FPS.

**Đo** (Chrome headless + GPU, mức Medium; số tuyệt đối dao động do máy chạy song song ứng dụng khác):

| Khung nhìn | Lượt trước | Sau | Tam giác sau |
|---|---|---|---|
| Tổng thể (mặc định) | 20,5–20,9 FPS | **86 FPS** | 3,0 M (trước 5,8 M) |
| Zoom xa tối đa | — | 47 FPS | 2,7 M |
| Q1 tầm trung | 18,8–20,7 FPS | 19,5 FPS | 6,0 M |
| Cận cảnh phố | 10,7–12 FPS | 12,4 FPS | 10,7 M |

Một lần đo trước khi sửa cho 127 FPS ở góc tổng thể. Con số đó không lặp lại được; lần đo lại là 86 FPS và báo cáo dùng con số này.

## 6. Dinh Độc Lập trên bản đồ

**Nguyên nhân nhòe:** sân cỏ, vòng đường, bãi cỏ tròn và hồ là các mặt phẳng chồng lên nhau chỉ cách **2–4 cm** (0,07 / 0,11 / 0,13 / 0,16 m). Ở khoảng cách bản đồ, độ chính xác chiều sâu không phân biệt được nên chúng tranh nhau hiển thị (z-fighting), tạo vệt sọc như ảnh hiện trạng.

**Sửa:**
- Các lớp cách nhau rõ: 0,08 / 0,22 / 0,36 / 0,5 m.
- Thêm polygon offset theo thứ tự lớp; tăng số cạnh của vòng tròn (64).
- Toà nhà dùng texture mặt tiền: tường trắng + **dải kính tối** sau "rèm hoa đá", nên dễ nhận ra hơn; thêm lá cờ.
- Ảnh: `sau_day_palace.jpg`, `sau_night_palace.jpg`.

Scene tham quan bên trong không bị động tới.

## 7. Giao thông

- Mức Medium: **5 031 xe, 17 loại, 27 tàu** (lượt trước 3 616 xe; trước nữa 900).
  - Low: 2 000 xe; High: 7 600 xe.
- Tăng trọng số **xe con và xe lớn**:
  - trục chính: sedan 9→12, hatchback 4→6, SUV 4→5, taxi 6→7, buýt 4→5, minibus 2→3, van 4→5, tải nhỏ 2→3, tải lớn 2→3;
  - đường thường tăng tương tự.
  - Tỷ lệ xe hai bánh toàn mạng: 67 % → 62 %.
- Luật cũ giữ nguyên: đi đúng lane graph OSM (tôn trọng một chiều, đi bên phải), giao lộ có đèn, giữ khoảng cách, không chồng nhau, tốc độ vào cua theo kích thước xe. Đã kiểm chứng bằng test:
  - không rời mặt đường, không chồng, không dịch chuyển tức thời;
  - không kẹt cứng;
  - buýt không vào hẻm; xe tải lớn không vào lõi di sản.

## 8. Cầu Ba Son

**Kiểm tra:**
- Vị trí và hướng lấy từ **tuyến "Cầu Ba Son" trong dữ liệu OSM** (`baSonGeometry`).
- Trụ đặt tại điểm đầu tiên trên đất liền phía bờ Thủ Thiêm, theo đúng tuyến đó.
- Mặt cầu là đường nâng của OSM (cao 11 m qua sông), nối với đường dẫn hai đầu.
- **Không phát hiện sai vị trí** so với dữ liệu, nên **không dịch chuyển cầu**.

**Phần sai là hình dạng trụ:** trước là hai cột thẳng đứng + khối đỉnh. Nay là:
- trụ **cao 113 m hình cánh buồm**: hai chân nghiêng về phía bờ Thủ Thiêm, hợp lại ở đỉnh;
- **12 cặp dây văng** toả ra phía sông, **7 cặp dây néo** về phía bờ;
- dầm ngang dưới mặt cầu và bệ trụ.

Ảnh: `truoc_cau_ba_son.jpg` → `sau_day_basonbridge.jpg`, `sau_night_basonbridge.jpg`.

**Giới hạn:** không có bản vẽ kết cấu chính thức. Số dây và độ nghiêng (10 m) là mô hình hoá theo hình dáng nhận diện; chiều cao 113 m theo thông tin công bố của công trình.

## 9. Landmark

Mặt tiền vẽ bằng canvas, ánh xạ theo mét (`components/map/landmarkTextures.ts` → `facadeBox`) nên cửa giữ đúng kích thước trên mọi mặt:

| Landmark | Nâng cấp |
|---|---|
| Dinh Độc Lập | mặt tiền trắng + dải kính tối, cờ, nền sân rõ nét |
| Nhà thờ Đức Bà | gạch đỏ có mạch vữa, cửa sổ nhọn khung đá; gian bên, hậu cung bán nguyệt, gờ đá trên tháp, thánh giá, cửa sổ hoa hồng |
| Bưu điện Trung tâm | tường vàng đất, trụ và gờ trắng, cửa vòm cao; hai khối đầu hồi cao hơn, mái vòm, mặt đồng hồ |
| Chợ Bến Thành | tường kem, vòm cửa lớn, dải gờ mái; tháp đồng hồ có gờ, mặt đồng hồ hai phía |
| Bảo tàng Chứng tích | khối trắng với dải cửa kính ngang |
| Bến Nhà Rồng | tường kem kiểu thuộc địa, cửa vòm, cửa chớp xanh |
| Bitexco | kính có khung và vạch tầng (~3,8 m), vòng tròn trên sân đỗ trực thăng |
| Landmark 81 | 9 khối kính với lam trắng dọc |
| Cầu Ba Son | trụ cánh buồm, dây văng (mục 8) |
| Thảo Cầm Viên | giữ cổng và chuồng thú; cây theo cụm từ lượt trước |

Tất cả landmark được chiếu sáng ấm nhẹ ban đêm.

Ảnh: `sau_day_cathedral_post.jpg`, `sau_day_market.jpg`, `sau_day_l81.jpg`.

## 10. File chỉnh sửa (lượt này)

- **Mới:**
  - `components/map/Sky.tsx`: bầu trời, biển mây, hướng mặt trời/mặt trăng;
  - `components/map/landmarkTextures.ts`: texture mặt tiền, `facadeBox`, chiếu sáng đêm.
- **Sửa:**
  - `components/map/CityScene.tsx`: sky, sương, ánh sáng ngày/đêm, khung nhìn, chiếu sáng landmark, phản chiếu sông;
  - `components/map/CityLayers.tsx`: hướng/màu nắng, bỏ bóng khi xa, LOD mờ dần, đèn đường mở rộng, cửa sổ đêm;
  - `components/map/LandmarkModels.tsx`: mặt tiền landmark, sân Dinh, cầu Ba Son;
  - `components/map/LivingCity.tsx`: giảm số xe vẽ khi xa;
  - `lib/city/buildCity.ts`: màu đường, bó vỉa;
  - `lib/city/textures.ts`: tỷ lệ cửa sổ sáng;
  - `lib/sim/config.ts`, `lib/sim/traffic.ts`: mật độ, phân bố xe.

## 11. Kiểm thử

- `vitest`: **97/97 đạt**.
- `tsc --noEmit`: sạch. `eslint`: sạch.
- `next build`: thành công.
- Chuyển bản đồ → Dinh Độc Lập: OK (18 s).
- Kiểm tra trực quan (ảnh trong `docs/screenshots/sky_lod/`): ngày/đêm tổng thể, skyline ngày/đêm, mức đường ngày/đêm, Dinh, Nhà thờ + Bưu điện, chợ Bến Thành, cầu Ba Son, Landmark 81.

## 12. Chưa thể kiểm chứng / giới hạn

- FPS đo trong Chrome headless trên máy đang chạy ứng dụng khác. Cần đo lại trên trình duyệt thật của người dùng.
- Chưa đo riêng thời gian GPU của shader bầu trời/nước (không có công cụ đo theo bước vẽ trong môi trường này).
- Mờ dần bằng alpha-hash có thể thấy hạt nhiễu nhẹ trong khoảng ~200 m chuyển tiếp. Đây là đánh đổi để không bật/tắt đột ngột.
- Kết cấu chi tiết của cầu Ba Son (số dây, góc nghiêng) là mô hình hoá, không phải bản vẽ kỹ thuật.
- Landmark vẫn là mô hình cách điệu theo footprint OSM, không phải dựng lại kiến trúc chính xác.

---

# Phần bổ sung (lượt tiếp theo): vùng đen, Landmark 81, đèn đêm, đèn toà nhà theo loại, chi tiết theo chunk

Ảnh: `docs/screenshots/night_l81/`.
- `truoc_*`: trạng thái cuối phần trên.
- `giua_dem_vinhomes.jpg`: đã phân loại đèn nhưng chưa làm tối kính.
- `sau_*`: kết quả cuối.

**Sửa lỗi phát sinh trước lượt này:** lúc mới vào web, bản đồ không hiện cho tới khi zoom.
- Nguyên nhân: tối ưu "bỏ cập nhật bóng đổ khi xa" khiến shadow map chưa từng được tạo. Trên GPU của người dùng, các vật liệu nhận bóng không vẽ được.
- Cách sửa: shadow map luôn được tạo ít nhất một lần (`CityLayers.tsx`, `CitySun`).

## A. Vùng đen quanh map

- **Nguyên nhân còn lại:** ban đêm, biển mây dưới sa bàn có màu xanh đen (0,07–0,2); khung nhìn mặc định xa (2,9 km); người dùng zoom ra tới 4,6 km.
- **Hậu cảnh:** biển mây đêm nay là **mây tím ấm được đèn thành phố hắt sáng** (0,27–0,47), quanh mép sa bàn có quầng cam hồng. Không còn mảng đen.
- **Đế sa bàn ban đêm:** sáng hơn (`#b08a66`, trước `#7d6a55`).
- **Khung nhìn mặc định:** gần hơn và dốc hơn: vị trí `(−1550·0,9; 2350·0,98; 2750·0,9)` quanh tâm `(1250, −640)`. Bản đồ chiếm phần lớn màn hình.
  - Đã kiểm tra bằng đếm toạ độ: **10/10 nhãn nằm trọn trong màn hình** ở 1600×900, cả ngày lẫn đêm.
  - Khung chặt hơn (0,72–0,84) làm nhãn Landmark 81 hoặc Bến Thành/Nhà Rồng ra ngoài màn hình, nên không dùng.
- **Zoom ra tối đa:** 4 600 → 3 700 m, không còn lùi tới chỗ thấy khoảng trống lớn.
- **Cột nhãn hai toà tháp cao** (Landmark 81, Bitexco): rút từ 70 m xuống 25 m để nhãn không vượt khung.

## B. Landmark 81

| | Trước | Sau |
|---|---|---|
| Mặt bằng | 9 ống, cạnh 15–23 m theo footprint | 9 ống cạnh 19 m, bó ~57 m vuông (cao/rộng ≈ 8, thanh mảnh) |
| Đỉnh các ống | 300 / 350 / 400 m: dừng sớm, trông như chồng hộp | góc 338–352, cạnh 376–392, giữa 414 m: thân **gần như thẳng tới ~3/4 chiều cao**, giật cấp ở phần ngọn |
| Đốt tre | không có | dải ngang trắng mỗi 45 m trên mọi ống |
| Đầu ống | tấm phẳng | mũ vát 4 cạnh |
| Vương miện / chóp | khối nón + cột | đèn lồng 18 m trên ống giữa, mũ vát, chóp mảnh tới **461 m** |
| Mặt tiền | kính trơn | kính có lam dọc trắng |
| Đế | khối 24 m | khối thương mại 87×76 m cao 22 m có dải kính |
| Ban đêm | màu cam nâu (hắt sáng như tường đá) | kính chỉ hắt trắng rất nhẹ; **vương miện và chóp sáng làm điểm nhấn** |

- Các đốt tre và mũ ống được gộp thành 2 mesh (trước ~80 draw call).
- Ảnh: `truoc_l81.jpg` → `sau_l81.jpg`, `sau_dem_l81.jpg`.
- Đây là mô hình cách điệu theo hình dáng công bố, không phải bản vẽ.

## C. Đèn đường và đèn xe

- **Đèn đường:**
  - trục chính mỗi 30 m (trước 36), đường thường mỗi 42 m (trước 46);
  - chóa đèn phát sáng 2,4 (trước 1,1);
  - vũng sáng bán kính 8 m (trước 6), độ đậm 0,6 (trước 0,42), màu cam ấm.
- **Đèn xe:** đèn pha (3,0; 2,6; 1,8) và đèn hậu (2,6; 0,3; 0,15), gần gấp đôi trước.
- **Mới — vệt đèn pha trên mặt đường:**
  - mỗi xe đang trong khung hình có một quạt sáng ấm dài 11 m phía trước (xe hai bánh nhỏ hơn);
  - vẽ cộng sáng, 1 draw call, tối đa 3 000 vệt;
  - chỉ ban đêm và khi camera gần hơn 2,2 km.
- Không dùng bloom; không màu neon.

## D. Đèn cửa sổ mới, phân loại theo công trình

Mỗi kiểu mặt tiền là một material riêng, nên shader nhận **loại công trình** (`uKind`) và áp logic khác nhau. Pattern vẫn ổn định: chỉ phụ thuộc vị trí thế giới và chỉ số ô cửa, không đổi theo khung hình. "Một toà nhà" là ô ~11 m với nhà thấp, ~30 m với cao ốc/văn phòng.

| Loại | Áp dụng cho | Logic |
|---|---|---|
| 0 Nhà phố (tầng trên) | `shop` | 45 % nhà **tối hẳn**; nhà có người chỉ sáng 1–2 ô (10–32 %), **tầng 1 dễ sáng gấp ~2,5 lần tầng trên** |
| 1 Mặt tiền cửa hàng | `shopfront` | khoảng một nửa cửa hàng mở và sáng |
| 2 Trung tầng (căn hộ, nhà thuộc địa) | `apartment`, `colonial` | mật độ vừa, **khác nhau từng tầng** (×0,3–1,6), đôi khi hai ô liền nhau sáng như một căn hộ |
| 3 Văn phòng | `office` | sáng **theo tầng đang dùng** (~36 % số tầng), trong mỗi tầng sáng theo **dải 4 khoang**; vài tầng sáng kín |
| 4 Cao ốc kính | `glass` | như văn phòng nhưng dịu hơn (×0,7); **không còn kiểu "muối tiêu"** |
| Landmark | mô hình riêng | tường đá/vữa hắt sáng ấm 0,16; kính hắt trắng rất nhẹ 0,07; đỉnh Landmark 81 sáng 0,75 |

- **Màu:** trắng ấm 45 %, trắng dịu ấm 35 %, trắng mềm 15 %, vàng cam nhẹ 5 %. Bỏ tông trắng xanh lạnh của lần trước.
- **Cường độ:** 45–85 % mỗi ô.
- **Kính về đêm:** mặt kính cao ốc tối đi 45 %, văn phòng 25 %. Dải đèn nổi rõ hơn và khối nhà bớt màu xanh lạnh.
- **Hiệu năng:** ban ngày toàn bộ logic đèn cửa sổ bị bỏ qua (`if (uWin > 0)`).

Ảnh: `truoc_dem_skyline.jpg` → `sau_dem_skyline.jpg`; `giua_dem_vinhomes.jpg` → `sau_dem_vinhomes.jpg`; `truoc_dem_pho.jpg` → `sau_dem_pho.jpg`.

## E. Chi tiết theo chunk, theo zoom và theo khung hình

- **Chia chunk khi dựng** (trong Web Worker, `buildCity.ts` → `splitChunks`):
  - mesh tường/mái chia theo ô **1,8 km**, mesh chi tiết (khung cửa, gờ tầng, ban công, đồ trên mái…) theo ô **400 m**;
  - **125 chunk chi tiết**;
  - chia bằng hai lượt vào mảng `Float32Array` đúng kích thước, rồi giải phóng mảng gốc. Phiên bản đầu dùng `number[]` gây hết bộ nhớ khi chạy test; đã sửa.
- **Mỗi khung hình** (`CityBuildings` trong `CityLayers.tsx`), với từng chunk chi tiết:
  - **Ngoài khung hình hoặc sau camera:** không vẽ. Tường/mái cũng bị three.js loại theo từng chunk.
  - **Trong khung hình và gần:** điểm gần nhất của chunk cách camera < 450 m thì hiện đủ; từ 450 đến 650 m thì **mờ dần** (dithered alpha-hash, không pop-in, không cần sắp xếp).
  - **Trong khung hình nhưng xa** (> 650 m): chỉ tường/mái và texture, không có chi tiết hình học.
  - Mỗi chunk có material riêng (cùng shader) nên mờ dần độc lập.
- **Các lớp khác dùng chung cơ chế:**
  - cây nhỏ và cột đèn mờ dần theo độ cao camera;
  - xe: chỉ vẽ xe trong khung hình; xa hơn 1,8 km vẽ ½, xa hơn 3 km vẽ ¼ (cố định, không nhấp nháy); mô phỏng 30 Hz, chỉ cập nhật tư thế xe gần khung hình;
  - bóng đổ: bỏ cập nhật khi xa hơn 1,6 km (sau khi đã tạo lần đầu).

**Đo:**

| Góc nhìn | Chunk chi tiết đang bật | Tam giác | FPS |
|---|---|---|---|
| Tổng thể | 0/125 | 2,9 M | 31,1 |
| Q1 tầm trung | 6/125 | 5,7 M | 20,3 |
| Cận cảnh phố | 7/125 | 5,9 M (trước **10,7 M**) | 22,0 (trước 12,4) |
| Zoom xa tối đa | 0/125 | 2,7 M | 42,5 |

- Lần đo 86 FPS ở góc tổng thể trong phần trên không lặp lại được trong các lần đo sau (26–31 FPS với cùng cấu hình trước khi tối ưu xe). Nên coi con số 86 là sai số đo.
- Phép tách lớp (ẩn từng lớp rồi đo) cho thấy giao thông là phần tốn nhất ở góc tổng thể. Đã xử lý bằng ngưỡng ½ / ¼ ở trên.
- Draw call tăng từ ~300 lên ~360 do chia chunk.

## F. File đã sửa (lượt này)

- `lib/city/buildCity.ts`: `splitChunks`, `CHUNK`, `DETAIL_CHUNK`.
- `components/map/CityLayers.tsx`: LOD theo chunk; đèn đường sáng hơn; bóng đổ luôn tạo lần đầu.
- `lib/city/textures.ts`: đèn cửa sổ theo loại công trình; làm tối kính về đêm; bỏ qua logic ban ngày.
- `components/map/LandmarkModels.tsx`: Landmark 81 mới; hắt sáng theo loại vật liệu.
- `components/map/landmarkTextures.ts`: `floodlit(màu, cường độ)` theo từng vật liệu.
- `components/map/LivingCity.tsx`: vệt đèn pha; ngưỡng giảm xe ½ / ¼.
- `lib/city/waterMaterial.ts`: đèn xe sáng hơn.
- `components/map/Sky.tsx`: biển mây đêm ấm.
- `components/map/CityScene.tsx`: khung nhìn mặc định; giới hạn zoom; đế sa bàn; cột nhãn tháp cao.
- `tests/sim.test.ts`: nới timeout cho test vào cua (5 000 xe).

## G. Kiểm thử

- `vitest`: 97/97 đạt (82 test ở lần chạy toàn bộ cuối; 15 test mô phỏng chạy lại sau khi nới timeout).
- `tsc --noEmit`, `eslint`: sạch.
- `next build`: thành công.
- Chuyển bản đồ → Dinh Độc Lập: OK (23,7 s).
- Trực quan: màn hình đầu ngày/đêm (không chạm camera), skyline đêm, cụm cao ốc đêm, phố đêm, Landmark 81 ngày/đêm, cận cảnh phố (chunk).

## H. Giới hạn còn lại

- Cây xanh chưa chia chunk: mỗi loài vẫn là một InstancedMesh cho toàn thành phố. Chia chunk sẽ làm tăng mạnh số draw call. Cây có LOD theo độ cao camera.
- FPS đo trong Chrome headless trên máy đang chạy ứng dụng khác; cần đo lại trên trình duyệt thật.
- Khung nhìn mặc định được kiểm tra ở tỷ lệ 16:9 (1600×900). Màn hình hẹp hơn có thể đẩy nhãn ra ngoài.
- Không có tham chiếu chính thức cho mức độ sáng đèn; các tỷ lệ cửa sổ sáng là ước lượng nghệ thuật.

---

# Phần bổ sung: cắt bản đồ thành hình chữ nhật nhỏ hơn

Ảnh: `docs/screenshots/cat_ban_do/`.
- `truoc_*`: trước khi cắt.
- `sau_*`: sau khi cắt, gồm ảnh từ trên xuống, toàn cảnh xiên và màn hình đầu, ngày và đêm.

**Ghi chú quá trình:** lần cắt đầu tiên dùng một đa giác 9 cạnh để bỏ bán đảo Thủ Thiêm. Kết quả bị khuyết góc và có cạnh xiên, không đúng yêu cầu. Lần này đã thay bằng **một hình chữ nhật duy nhất**; không còn đa giác nào trong mã.

## Ranh giới mới

| | Trước | Sau |
|---|---|---|
| Vùng dựng | x −860…3 400, z −2 500…1 260 (4,26 × 3,76 km) **+ dải đệm 240 m** mỗi phía (tổng 4,74 × 4,24 km ≈ 20,1 km²) | `MAP_RECT` x −650…3 250, z −2 345…1 240: **3,90 × 3,59 km ≈ 14,0 km²** (−30 %) |
| Hình dạng | chữ nhật | chữ nhật: 4 cạnh thẳng, 4 góc vuông, mặt bên sa bàn liền trên cả 4 cạnh |

**Cách chọn:** hộp bao 10 địa điểm (x −351…2 917, z −2 015…976) cộng khoảng đệm.
- Tây: 300 m từ Bảo tàng Chứng tích.
- Đông: 333 m từ Landmark 81.
- Bắc: 330 m từ Landmark 81.
- Nam: 264 m từ Bitexco.

Mọi địa điểm cách cạnh gần nhất ≥ 250 m; điều này được kiểm tra bằng test. Toạ độ landmark không đổi.

## Cắt đồng bộ mọi lớp (`lib/city/buildCity.ts`)

- **Đường:** cắt đường thẳng theo hình chữ nhật (Cyrus–Beck); quảng trường cắt đa giác (Sutherland–Hodgman). Làn xe, giao lộ, vỉa hè, bó vỉa và đường đi bộ đều sinh từ đường đã cắt, nên dừng đúng tại cạnh.
- **Nước, công viên, đất sử dụng:** đa giác cắt theo hình chữ nhật. Đường cắt không bị vẽ thành bờ kè.
- **Mesh mặt đất** (đường, vỉa hè, vạch sơn, nước, bờ, cỏ): từng tam giác được cắt chính xác tại cạnh, nên tất cả kết thúc trên cùng một đường thẳng.
- **Nhà:**
  - nhà OSM chỉ dựng khi footprint nằm **trọn** trong hình chữ nhật;
  - nhà sinh tự động phải có điểm gốc cách cạnh ≥ 40 m.
  - Test xác nhận không đỉnh nào của nhà vượt cạnh quá 1 m (mái hiên, gờ). Trước khi sửa có nhà vắt qua cạnh khoảng 10 m.
- **Cây:** chỉ giữ cây trong hình chữ nhật.
- **Làn xe:** chỉ trong hình chữ nhật (lề 15 m).
- **Dải đệm ngoài** (`outskirts.json`): không còn tải và không còn vẽ, vì nằm ngoài ranh giới mới.
- **Đế sa bàn** (`MapBase` trong `CityScene.tsx`): mặt đất và hai lớp mặt bên (viền mực + thân) dựng theo đúng hình chữ nhật mới. Không đổi thiết kế viền.

Camera, nhãn, landmark, giao thông, ánh sáng không đổi. Ở góc mặc định, **10/10 nhãn** nằm trọn trong màn hình (1600×900), ngày và đêm.

## Kiểm thử

- `vitest`: **98/98 đạt**. Thay test "thưa dần theo đường lượn sóng ở mép khung cũ" bằng hai test mới:
  - bản đồ là một hình chữ nhật chứa đủ 10 địa điểm (≥ 250 m tới cạnh), nhà dày đặc tới gần cạnh và không có gì ngoài cạnh;
  - mọi lớp mặt đất kết thúc tại cạnh (≤ 1 cm), không nhà nào vượt cạnh quá 1 m, mọi cây nằm trong.
- `tsc --noEmit`, `eslint`: sạch.
- `next build`: thành công.

## File đã sửa

- `lib/city/buildCity.ts`: `MAP_RECT`, `REGION_OUTLINE`, `regionDepth`, các hàm cắt; cắt đường, nước, công viên, mặt đất, nhà, cây, làn xe.
- `components/map/CityScene.tsx`: đế sa bàn theo `REGION_OUTLINE`; bỏ dải đệm ngoài.
- `tests/landmarks.test.ts`: test ranh giới mới.

## Giới hạn

- Hình chữ nhật vẫn chứa bán đảo Thủ Thiêm (bờ đông sông). Đây là địa lý thật nằm giữa Landmark 81 (đông bắc) và Bitexco (nam), nên không thể bỏ mà vẫn giữ hình chữ nhật và đủ 10 địa điểm.
- Đường lượn của sông tại cạnh được cắt thẳng theo cạnh sa bàn.
