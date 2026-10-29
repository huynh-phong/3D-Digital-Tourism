# Báo cáo nghiệm thu — Kiểm tra và tái dựng các điểm tham quan Dinh Độc Lập 3D

Ngày: 29/10/2026. Phạm vi: 16 nhóm ảnh P0/P1 trong `DINH_DOC_LAP_TUYEN_CHON_ANH_DUNG_3D_1`.

> **Lượt hoàn thiện (29/10/2026, lần 2):** đóng các hạng mục còn dang dở ở mục E. Kết quả đầy đủ ở **mục F** cuối báo cáo. Khi số liệu ở các mục A–E khác với mục F, mục F là bản mới nhất.

Quy ước mức xác minh:

- **verified:** có nguồn chính thức.
- **estimated:** tên hoặc tầng đã có căn cứ, còn vị trí và kích thước là ước lượng.
- **simulated:** dựng theo ảnh, nhưng tên hoặc vị trí chưa được nguồn chính thức xác nhận.

## Phương pháp

1. **Đọc tư liệu.** Đã đọc `DOC_TRUOC_KHI_DUNG.md` và `THONG_KE_KHONG_GIAN.csv`. Đã xem đủ 90 ảnh của 16 nhóm qua trang ảnh ghép 2×2, mỗi ảnh rộng 760 px. Ảnh mặt tiền DDLP_0153 được cắt ra và đo bằng thước pixel.
2. **Đối chiếu nguồn chính thức** (dinhdoclap.gov.vn):
   - "Kiến trúc Dinh Độc Lập":
     - thảm cỏ oval đường kính 102 m;
     - khu nhà chính hình chữ T, cao 26 m;
     - 03 tầng lầu, 02 gác lửng, 01 tầng nền, 01 tầng hầm.
   - "Di tích lịch sử Dinh Độc Lập":
     - rèm hoa đá hình đốt trúc bao quanh lầu 2;
     - hồ sen bán nguyệt hai bên thềm vào chính điện;
     - các phòng khánh tiết, họp Hội đồng Nội các, làm việc của Tổng thống và Phó Tổng thống, trình ủy nhiệm thư, đại yến.
   - "Những nét vẽ Mai Lan Cúc Trúc trên tủ phòng Tiếp khách Tổng thống": phòng này ở tầng 2 và có hai tủ sơn mài vẽ vàng.
   - Các bài về tranh "Việt Nam Quốc Tổ", "Bình Ngô Đại Cáo" và "Sơn Hà Cẩm Tú" đã dùng từ phiên trước.
   - Bản đồ tham quan trên trang chính thức chỉ là sơ đồ khuôn viên và sơ đồ nhà trưng bày. **Không có sơ đồ mặt bằng chi tiết của Dinh.** Vì vậy mọi kích thước phòng là ước lượng.
3. **Cách tạo hình ảnh.** Không dán ảnh lên bề mặt nào. Hoa văn và vật liệu được vẽ bằng code theo ảnh. Tranh và họa tiết trên tủ là hình minh họa, không sao chép tác phẩm.
4. **Đánh số tầng trong dự án:**
   - `f1` là tầng có Đại sảnh (cửa chính).
   - `f2` là tầng phía trên.
   - `basement` là tầng hầm.
   - `roof` là sân thượng.

   Nguồn gọi tầng có Đại sảnh là "lầu một" hoặc "tầng 1". Nguồn gọi Phòng Tiếp khách Tổng thống là "tầng 2", khớp với `f2`.

## A. Bảng kiểm tra 16 khu vực

| ID | Khu vực | Vị trí thực tế (theo nguồn) | Mức xác minh | Chất lượng ban đầu | Đã sửa | Còn thiếu |
|---|---|---|---|---|---|---|
| 01 | Sân cỏ, đài phun nước | Thảm cỏ oval 102 m trước Dinh (verified) | verified (kích thước), estimated (đài phun) | Bồn tròn và nón nước đơn giản | Đài phun dựng lại theo 0074/0189/0194: viền cây cắt xén, bồn, khối trống trắng cắt mặt kim cương, 40 tia nước vòm, cột nước giữa. Thêm cây tạo dáng chóp dọc chân nhà và cây cắt tầng hai bên thềm (0153/0071/0299) | Cây cổ thụ vẫn dạng khối, đặt quá dày ở hai bên hông. Cổng sắt và đèn cổng (0192) chưa nâng cấp |
| 02 | Mặt tiền tổng thể | Mặt chính hướng Nam Kỳ Khởi Nghĩa (verified) | estimated (tỉ lệ đo trên ảnh) | Dải cửa phẳng, rèm đá quá dày đặc | Đo trên ảnh 0153: 23 nhịp, 4 cột lam đứng (fin) liên tục, dải ban công, gờ, mái đua sâu, dải cửa tầng 2 và tầng trên. Bao lơn danh dự ở giữa có 3 cửa khung gỗ. Ốp đá chẻ ở bệ và tầng trệt có cửa sổ khung kem. Trên mái: cọ trồng chậu, đèn, cột ăng-ten, lầu Tứ phương với diềm dày và lan can | Chiều cao các dải được giãn ×1,16 để khớp tầng nội thất (ghi trong code). Cột cờ và các tầng lầu chưa có nội thất |
| 03 | Lam che nắng, mặt bên | Rèm hoa đá quanh lầu 2 (verified) | verified (hình đốt trúc), estimated (nhịp) | Viên đá nhỏ, 8 hàng | Rèm đá: 3 hàng đốt trúc mỗi nhịp, 3 ô thấu kính giữa các cột lam. Phủ mặt tiền, hai mặt bên, mặt sau khối trước và khối sau (0072/0073/0287). Đầu hồi có cửa sổ kèm 2 tấm phù điêu (0191, texture `relief` có normal map) | Phù điêu là hoa văn mây đối xứng minh họa, không sao chép mẫu thật |
| 04 | Sân trong, giếng trời | Chưa có nguồn chính thức về vị trí | — | Chưa có | **Chưa dựng.** Đã tạo sẵn texture `mosaicBlue`, `slate`, `granitePink` theo 0039/0171 | Cần chọn vị trí trong khối sau, khoét sàn tầng 2 và mái, thêm một không gian mới |
| 05 | Sân thượng, bãi đáp | Sân thượng, bãi trực thăng (verified) | verified (có tồn tại), estimated (bố trí) | Mặt mái phẳng, có cờ | Lát gạch `roofPaver`. Trực thăng UH-1 giản lược (rotor 14,6 m, thân rằn ri), 2 vòng tròn đỏ trên sàn, chậu dương xỉ dọc lan can, 2 khối nhỏ màu trắng ở góc sau (0106/0246) | Chưa chụp kiểm tra cảnh bên trong không gian sân thượng. Trực thăng là mô hình đơn giản |
| 06 | Cầu thang chính | Trước mặt sảnh, dẫn lên lầu 2 (verified) | verified (vị trí tương đối) | Một vế thang thẳng, thảm đỏ | Thêm thanh đồng chặn thảm ở mũi mỗi bậc (0239) | Ảnh 0066 cho thấy cầu thang tách đôi lên hai vế bên, bậc hở. **Chưa dựng lại hình học này** |
| 07 | Phòng họp Nội các | Bên phải sảnh (verified) | estimated | Màu sửa đúng, rèm liền một tấm | Từng cặp rèm gấm ô liu kèm voan ở mỗi cửa (lối ra hiên phía sau có ánh sáng), đèn ống đồng gắn tường giữa các cửa. Trần: ô trần dài có 6 vòm nông, 2 hàng đèn hộp, 3 đèn chùm hai tầng. Bàn: mặt kem, viền gỗ, lòng bàn để lộ thảm xanh ở mặt sàn, chân thép vòng elip, micro cổ ngỗng ở từng chỗ ngồi. Ghế da xanh lưng cao, hàng ghế gỗ chạm bọc gấm xanh sát tường | Cột dây chắn khách không dựng (là vật dụng bảo tàng, không có va chạm) |
| 08 | Phòng Đại yến | Bên trái sảnh (verified) | estimated | Mốc chất lượng | Giữ nguyên | — |
| 09 | Phòng Trình Quốc thư | Trung tâm Dinh (verified); tầng 2 (estimated) | estimated | Mốc chất lượng | Giữ nguyên | Tầng của phòng chưa kiểm chứng |
| 10 | Phòng Khánh tiết | Sau cầu thang trung tâm (verified) | estimated | Mốc chất lượng | Giữ nguyên | — |
| 11 | Phòng tiếp khách nghi lễ | Gồm 2 phòng khác nhau trong ảnh: (a) 0015/0081/0297 là **Phòng Tiếp khách Tổng thống**, tầng 2 (verified qua tủ Mai Lan Cúc Trúc); (b) 0013/0076 là phòng ghế bọc kem | (a) estimated; (b) simulated | Chưa có | (a) `pres_reception`: thảm đỏ chữ Thọ có viền mây xanh và hoa cúc, sofa và ghế bành gấm vàng, khám gỗ khung vàng có đôi ngà voi và ghế chạm, 2 tủ sơn mài đỏ vẽ vàng, bình men lam, bàn chân ba nhánh. (b) `cream_reception`: thảm đỏ sẫm có viền khóa chữ Vạn (meander), 3 thảm kem chữ Thọ xanh, hàng ghế bành kem, vách rèm cuối phòng | Tên phòng (b) chưa xác minh |
| 12 | Phòng tiếp khách ghế gỗ đỏ | Ảnh 0048 thuộc phòng (11a); 0003/0286 là phòng khác | simulated | Chưa có | `red_reception`: ghế gỗ chạm bọc gấm đỏ chấm tròn, bàn tròn mặt kính, bàn giấy viền hoa văn khóa trước tấm vách gỗ soi chỉ cao, bình men lam | Tên và vị trí chưa xác minh. Cửa lớn sang (11a) là ước lượng theo 0003 |
| 13 | Phòng tiếp khách Phó Tổng thống | Tên chỉ lấy theo cách phân loại của bộ ảnh | simulated | Chưa có | `vp_reception`: thảm đỏ sẫm và 3 thảm kem chữ Thọ, hai dãy ghế gỗ chạm đệm đỏ quay mặt vào nhau, bàn sơn mài, vách rèm vàng cuối phòng, bình lam trắng, 2 đèn chùm, viền trần gỗ soi chỉ (0044/0049/0050/0218/0082) | Tên phòng chưa xác minh. HUD hiện "Phòng tiếp khách (nhóm ảnh 13)" |
| 14 | Phòng làm việc, bàn giấy | Nguồn có nhắc phòng làm việc của Tổng thống và Phó Tổng thống, nhưng chưa rõ ảnh thuộc phòng nào | simulated | Chưa có | `office2`: ván ốp chân tường gỗ soi chỉ, tranh phong cảnh sơn dầu (minh họa), đèn ống, bàn gỗ có tấm lót, 3 điện thoại, ghế chạm, quạt đứng, thảm đỏ, rèm đỏ (0055/0122) | Tên chưa xác minh. Tranh không phải bản sao |
| 15 | Hầm tác chiến, phòng bản đồ | Tầng hầm (verified: có tầng hầm) | simulated | Mốc chất lượng | Giữ nguyên | — |
| 16 | Hầm, phòng truyền tin | Tầng hầm | simulated | Có bàn điện tín, máy vô tuyến | Vách ván sơn nâu đỏ (`boardsRust`, theo 0129/0146/0225). Thêm bàn tổng đài vỏ đỏ, khối máy, hai tủ hồ sơ thép xám (0226) | Phòng chiếu phim (0147/0148) chưa dựng |

## B. Chi tiết từng phần mới hoặc đã sửa

### Ngoại thất (01, 02, 03, 05)
- **Mã nguồn:** `components/game/PalaceExterior.tsx` (`Elevations`, `LawnFountain`, `Topiary`, `Roofline`, `Helipad`).
- **Gắn vào scene:** qua `Facade` và `Grounds` trong `Palace.tsx`. Decor mới `roofline` và `helipad` được khai báo trong `data/dinh/spaces.ts`.
- **Dữ liệu mặt đứng `RUNS`:** 8 mặt đứng, mỗi mặt gồm danh sách đoạn (đầu hồi / rèm đá / giữa) và số nhịp.
- **Cao độ `FY`:** đo từ ảnh 0153.
- **Hiệu năng:**
  - Mọi chi tiết lặp lại dùng instancing, tổng cộng 7 lô vẽ (draw call).
  - Đốt trúc là LatheGeometry 3 hàng, khoảng 190 instance.
- **Texture mới:** `stoneRubble` (Voronoi, mạch vữa lõm, normal mạnh), `relief`, `roofPaver`, `camo`.
- **Vật liệu mới:** `hedge`, `fountainWhite` (flat shading), `jet`, `winPane`, `palm`, `terracotta`.
- **Mức khớp ảnh:**
  - Nhịp và cấu trúc mặt tiền khớp ảnh 0153.
  - Rèm đá khớp tốt khi nhìn gần.
  - Cây và cổng vẫn còn đơn giản.
- **Không gian `exterior`** nay xem được mái và lầu Tứ phương (thêm `viewRegion`).

### Phòng Nội các (07)
- `CabinetDecor` trong `Palace.tsx` được viết lại hoàn toàn.
- Dữ liệu ghế và bàn giữ nguyên, nên va chạm và đường đi không đổi.

### Tầng 2: nhóm 11–14
- **Dữ liệu chung:** `data/dinh/rooms2.ts`, gồm khung phòng, cửa và vị trí nội thất. Mô hình va chạm và phần trang trí dùng chung dữ liệu này.
- **Hình học trong `lib/dinh/palaceModel.ts`:**
  - tường và trần;
  - cửa trong tường sảnh tầng 2;
  - va chạm cho nội thất;
  - nút điều hướng có đường vòng tránh giếng thang và các dãy ghế.
- **Trang trí** trong `components/game/PalaceRoomsF2.tsx`:
  - Thảm và cánh tủ vẽ trên canvas 2048 px (thảm) và 1024 px (cánh tủ), không lặp, không kéo giãn: thảm chữ Thọ đỏ, thảm kem chữ Thọ xanh, nền thảm đỏ sẫm viền khóa chữ Vạn, cánh tủ sơn mài vẽ vàng.
  - Texture lặp mới: `damaskYellow`, `damaskRoundel`, `carpetPlain`.
  - Nội thất (ghế chạm, ghế bành, sofa, bàn thấp, bàn ba chân, bình) là hình học gộp và instancing.
- **Hệ thống:**
  - 5 không gian mới trong `SPACES`, mỗi không gian tải và giải phóng độc lập;
  - 5 cửa có cánh, 10 điểm F;
  - 5 phòng trong `ROOMS` có ghi chú nguồn;
  - điểm dừng tour mới `stop-pres-reception`, mục tri thức `k-pres-reception`, 2 nguồn và 3 dữ kiện mới.

### Cầu thang (06), truyền tin (16)
- Thanh đồng ở mũi bậc thang.
- `BasementShell` nhận tham số vật liệu tường.
- `CommsDecor` có thêm bàn tổng đài và tủ hồ sơ.

## C. Lộ trình và đồ thị phòng

**Trước:**

```
exterior ─ hall ┬─ cabinet
                ├─ dai_yen
                ├─ khanh_tiet ─ corridor ┬─ stair_basement ─ b_corridor ┬─ b_comms
                │                        │                              └─ b_maps
                │                        └─ stair_roof ─ roof
                └─(cầu thang F)─ f2_lobby ─ credentials
```

**Sau** (thêm 5 nhánh từ sảnh tầng 2; đồ thị vẫn là cây, mỗi cửa đi được hai chiều):

```
f2_lobby ┬─ credentials
         ├─ pres_reception ─ red_reception
         ├─ vp_reception ─ cream_reception
         └─ office2
```

**Thứ tự tour (10 điểm):**
1. cổng
2. thảm cỏ
3. mặt tiền
4. Nội các (`f1`)
5. Đại yến (`f1`)
6. Khánh tiết (`f1`)
7. Trình Quốc thư (`f2`)
8. **Phòng Tiếp khách Tổng thống** (`f2`, mới)
9. phòng bản đồ (`basement`)
10. sân thượng (`roof`)

Các phòng nhóm 12–14 chưa đưa vào tour vì tên chưa xác minh. Vẫn tham quan tự do được qua cửa F.

**Cửa và điểm xuất hiện:**

| Cửa | Tọa độ | Mức tin cậy |
|---|---|---|
| sảnh tầng 2 ↔ Tiếp khách Tổng thống | x −10, z −31 | estimated |
| Tiếp khách Tổng thống ↔ phòng ghế đỏ | x −29, z −20,5 | simulated |
| sảnh tầng 2 ↔ phòng nhóm 13 | x 10, z −31 | simulated |
| phòng nhóm 13 ↔ phòng ghế kem | x 29, z −28 | simulated |
| sảnh tầng 2 ↔ phòng làm việc | x 0, z −46 | simulated |

**Kiểm tra trong Chrome headless (WebGL phần mềm SwiftShader):**
- Đi qua 7 cửa mới: nhân vật xuất hiện đúng điểm khai báo (lệch 0 m), không gian đích được kích hoạt.
- Cửa hồi về sảnh từ phòng Tiếp khách Tổng thống và phòng ghế đỏ chưa được chạy riêng. Các cửa này nằm trong dữ liệu đối xứng đã kiểm thử tự động.

## D. Hiệu năng

- **Số liệu đo bằng `renderer.info` trong Chrome headless (WebGL phần mềm):**

  | Không gian | Draw call | Tam giác | Texture | Program |
  |---|---|---|---|---|
  | `office2` | 39 | 3.144 | 81 | 45 |
  | `red_reception` (phòng trước đó vẫn trong cache) | 38 | 10.618 | 76 | 44 |

- **FPS:** thời gian khung hình đo được (530–770 ms) là của trình kết xuất phần mềm, **không đại diện cho GPU thật**. Chưa có số FPS trên máy thật.
- **Tối ưu đã áp dụng:**
  - instancing cho mọi chi tiết lặp;
  - vật liệu dùng chung;
  - canvas không lặp chỉ dùng cho mặt lớn và duy nhất;
  - texture lặp ở mức 1024 px khi chất lượng cao;
  - mỗi phòng là một không gian tải và giải phóng riêng.
- **Giới hạn:**
  - Khi vào một phòng lần đầu, toàn bộ shader của vật liệu mới phải biên dịch. Trên WebGL phần mềm việc này vượt 8 s, nên `LOAD_TIMEOUT` đã nâng lên 15 s (`lib/world/streaming.ts`).
  - Sau khi nâng, phòng Tiếp khách Tổng thống tải thành công.
  - Trên GPU thật thời gian biên dịch ngắn hơn nhiều, nhưng chưa đo.

## E. Triển khai

**File mới:**
- `components/game/PalaceExterior.tsx`
- `components/game/PalaceRoomsF2.tsx`
- `data/dinh/rooms2.ts`
- `docs/BAO_CAO_NGHIEM_THU_DINH_DOC_LAP.md`

**File sửa:**
- `components/game/Palace.tsx`
- `lib/dinh/textures.ts`
- `lib/dinh/palaceModel.ts`
- `lib/world/streaming.ts`
- `data/dinh/spaces.ts`
- `data/dinh/layout.ts`
- `data/dinh/interactions.ts`
- `data/dinh/tour.ts`
- `data/dinh/knowledge.ts`
- `data/dinh/sources.ts`

**Tài nguyên mới:**
- 13 bộ texture sinh bằng code: `stoneRubble`, `relief`, `roofPaver`, `mosaicBlue`, `slate`, `damaskYellow`, `damaskRoundel`, `carpetPlain`, `boardsRust`, `granitePink`, `camo`, cùng hàm Voronoi dùng chung.
- 5 bộ canvas không lặp.
- Không có file ảnh hay mô hình tải từ ngoài.

**Kiểm thử:**
- `vitest`: 92/92 đạt. Trong lúc làm có sửa 3 cạnh đồ thị đi bộ và mở cửa trong tường sảnh tầng 2.
- `eslint`: sạch.
- `tsc`: sạch.
- `next build`: thành công.
- Ảnh trước và sau chụp từ cùng góc camera: lưu ngoài repo, trong thư mục scratchpad của phiên làm việc (`before/`, `after/`).

**Chưa hoàn thành:**

| Hạng mục | Lý do |
|---|---|
| 04 Giếng trời | Cần thiết kế lại khối sau và thêm không gian mới |
| 06 Cầu thang tách đôi, bậc hở | Phải dựng lại hình học cầu thang và đường lên tầng 2 |
| Phòng chiếu phim dưới hầm | Chưa làm |
| Cổng và cây khuôn viên | Chưa nâng cấp |
| Chụp kiểm tra bên trong không gian sân thượng | Chưa chạy |
| Đo FPS trên GPU thật | Chưa có máy để đo |
| Tên phòng nhóm 12–14 và vị trí mọi phòng tầng 2 | Cần sơ đồ hoặc biển tên phòng chính thức |

## F. Hoàn thiện các hạng mục còn dang dở (29/10/2026, lần 2)

Phạm vi lượt này: chỉ các hạng mục chưa xong ở mục E. Không sửa bốn phòng mốc 08, 09, 10, 15. Không viết lại camera, bộ điều khiển, Guided Tour hay Scene Manager.

### F.1 Bảng tổng kết

| Hạng mục | Trạng thái trước | Công việc đã làm | Trạng thái sau | Đã kiểm thử |
|---|---|---|---|---|
| 04 Giếng trời | Chưa dựng | Xem chi tiết ở F.2 | Đã dựng, vị trí là ước lượng (`simulated`) | Đi qua cửa F; chụp 3 góc (lối vào, góc hành lang, nhìn lên trời); 92/92 test, kể cả kiểm tra các cạnh đường đi |
| 06 Cầu thang chính | Một vế thẳng; lên tầng 2 bằng F (teleport) | Xem chi tiết ở F.3 | Đi bộ bằng WASD, không teleport | Đi bộ thật trong Chrome headless (F.3); chụp 3 góc |
| 05 Sân thượng | Chưa kiểm tra từ bên trong | Vào không gian sân thượng bằng cầu thang thật và chụp ảnh. Dời trực thăng và hai vòng đỏ ra khỏi miệng giếng trời mới. Thêm lan can 1,1 m quanh miệng giếng (không rơi được). Thêm dữ kiện chính thức về hai vòng đỏ và trực thăng UH-1 | Đã kiểm tra từ bên trong | Chụp 4 góc (trực thăng, lầu Tứ phương, vòng đỏ, miệng giếng) |
| Phòng chiếu phim | Chưa dựng, vị trí chưa xác minh | Tra trên dinhdoclap.gov.vn (tìm "chiếu phim", "phim", "rạp", "Phòng Giải trí", "lầu 3"; đọc các bài kiến trúc, di tích, tham quan): chỉ thấy tên "Phòng Giải trí" làm chú thích ảnh, **không có tầng, vị trí hay mô tả Phòng chiếu phim**. Trang chính thức không công bố sơ đồ các tầng của Dinh | **Không dựng**, theo yêu cầu "không tự sáng tạo". Ảnh 0147/0148 (máy chiếu, biển "Phòng chiếu phim") giữ trong danh mục, không gán cho phòng nào; không đặt phòng này dưới hầm | Không áp dụng |
| Cổng và hàng rào | Song sắt đơn giản; mặt trước là tường đá đặc | Xem chi tiết ở F.4 | Đã nâng cấp | Chụp từ ngoài đường và cận cảnh |
| Cây xanh khuôn viên | Cây dày đặc sát hai bên hông Dinh | Mở rộng vùng không trồng cây ngẫu nhiên quanh Dinh (\|x\| < 88 m, từ z = −104 đến 34). Đặt 4 cây cổ thụ lớn ở hai góc trước theo ảnh 0068/0153/0187. Cây vẫn tránh lối đi, đường vòng và công trình như cũ (instancing, 2 loài) | Mặt bên đã thông thoáng | Chụp góc chéo bên hông, so với ảnh "trước" |
| Phòng tầng 2 nhóm 12–14 | Tên chưa xác minh | Xem chi tiết ở F.5 | Nhóm 11a/0048 đã xác minh. Nhóm 12 (0003/0286), 13, 14 vẫn chưa xác minh | 92/92 test |
| Hiệu năng GPU | Chưa đo trên GPU thật | Xem chi tiết ở F.6 | Đã đo trên GPU tích hợp | Số liệu đo thực ở F.6 |

### F.2 Giếng trời (nhóm 04)

Dựng theo các ảnh 0039, 0051, 0171.

- **Vị trí:** phần sau của khối nhà sau, z −88…−64, giữa hai giếng thang. Đây là ước lượng.
- **Lối vào:** cửa mới trong tường hành lang cầu thang tại x = 0.
- **Kết cấu:**
  - khoét lỗ trời ở sàn tầng 2 và mái;
  - hành lang hai tầng: cột vuông bằng đá ở tầng 1, cột trắng và lan can đặc màu trắng ở tầng 2;
  - dầm viền mép sàn ở cả hai tầng;
  - tường hành lang có cửa đóng (các phòng phía sau chưa dựng);
  - dầm thưa màu xanh đậm quanh miệng giếng.
- **Vườn:** lối đi đá phiến (`slate`), hồ lót mosaic xanh (`mosaicBlue`) có mặt nước, đá viền hồ, hòn non bộ đá sẫm với tháp nhỏ nhiều tầng, cây bụi, cây cắt tỉa, cây cau, đèn đá.
- **Hệ thống:** không gian `courtyard` riêng, 2 cổng F, nút điều hướng, va chạm. Mái quanh miệng giếng chỉ hiển thị khi nhìn từ dưới lên.
- **Chưa có:** cột tầng trệt chưa dùng texture granite hồng đã tạo sẵn, vì vật liệu dạng hộp của mô hình chưa có loại này. Cây là khối đơn giản.

### F.3 Cầu thang chính (nhóm 06)

- **Hình học (theo ảnh 0239):**
  - vế giữa rộng 4,4 m, đi từ đại sảnh lên chiếu nghỉ ở độ cao +2,5 m;
  - hai vế bên rộng 2,4 m quay ngược lên tầng 2;
  - mỗi vế 15 bậc, bậc cao 16,7 cm, mặt bậc 30 cm, độ dốc khoảng 29°;
  - bậc hở bằng gỗ sẫm, có thảm đỏ và thanh đồng ở mũi bậc;
  - dầm đỡ hai bên, tay vịn gỗ trên song mảnh, đầu tay vịn uốn cuộn ở chân thang;
  - lan can quanh giếng thang ở tầng 2; chiếu nghỉ đặc bên dưới, tựa vào tường Phòng Khánh tiết.
- **Va chạm:** mặt dốc cho từng vế, chắn hai bên, chắn quanh chiếu nghỉ và giếng thang. Bỏ dây chắn ở chân thang.
- **Liên kết đi bộ:**
  - trường mới `sharedRegions`: đại sảnh và sảnh tầng 2 cùng sở hữu va chạm của giếng thang;
  - `tickPassages()`: khi vị trí người chơi thuộc không gian kia, không gian đó được tải và kích hoạt ngay tại chỗ, không mờ màn hình, không teleport;
  - liên kết `stair-main-up/down` thành `walk: true`: dùng cho tìm đường, không hiện lời nhắc F, có gợi ý "cứ đi lên…".
  - Minh Anh có tuyến đi trên vế giữa, qua chiếu nghỉ, lên hai vế bên.
- **Đi bộ bằng phím W trong Chrome headless:**
  - Đi lên: (0; 1,54; −34,6) → chiếu nghỉ (y 4,04) → vế bên → sảnh tầng 2 (y 6,54, z −31,5). Không gian tự chuyển `hall` → `f2_lobby`.
  - Đi xuống: từ đầu vế bên tới chiếu nghỉ (y 4,04), rồi đi lên lại theo vế kia.
  - **Chưa chạy riêng:** đi xuống theo vế giữa, đối xứng với đi lên.
- **Hạn chế:** bố cục chia đôi dựng theo ảnh 0239. Kích thước và vị trí là ước lượng. Bom ngày 8/4/1975 "nổ phía trên cầu thang trung tâm" (nguồn chính thức), nhưng chi tiết này không thể hiện trong mô hình.

### F.4 Cổng và hàng rào

Dựng lại theo ảnh 0074, 0189, 0192.

- **Hàng rào:**
  - song sắt đầu giáo vàng trên bệ thấp màu sáng, có hai thanh ngang;
  - trụ đá mỗi 9 m, bụi cây chóp nón dọc chân hàng rào;
  - chỉ dựng phía mặt trước đến ±120 m; va chạm tường cũ vẫn giữ.
- **Cổng đôi:** đỉnh song sắt nhô cao thành vòm, dải hoa văn vòng tròn, trụ giữa.
- **Hai trụ cổng:** bằng đá, mang cột đèn đen với cụm 3 bóng.
- Toàn bộ là hình học dùng instancing, không dùng ảnh cắt.

### F.5 Xác minh các phòng tầng 2

Nguồn mới: bài "Ảnh Dinh Độc Lập – nơi lưu giữ dấu ấn sau 50 năm giải phóng" trên dinhdoclap.gov.vn.

- **Mô tả trong nguồn:** "Phòng khách của Tổng thống": ghế Tổng thống đặt cao hơn, phía sau là tấm gỗ lớn tượng trưng quốc kỳ, đối diện là ghế thượng khách; hai ghế này chạm đầu rồng, các ghế khác chạm đầu phụng hoặc chữ Thọ.
- **Khớp với mô hình:** ảnh 0048 (tấm gỗ cao sau ghế chạm, có ngà voi) và khám gỗ của `pres_reception`. Đã thêm dữ kiện `pres-reception-chairs`.
- **Ảnh 0003/0286 (nhóm 12):** ghế chạm bọc đỏ có thể cùng dãy phòng, hoặc là "Phòng làm việc của Tổng thống" (phòng này có trong nguồn, nhưng không có mô tả để đối chiếu). **Chưa xác minh**, giữ tên mô tả.
- **Nhóm 13 và 14:** không có nguồn mới, giữ tên mô tả.
- **Trạng thái:** cả ba phòng có trạng thái `simulated`, là giá trị trong `ConfidenceStatus` của dự án tương ứng với "unverified" (kiểu dữ liệu không có giá trị `unverified`). Không phòng nào được thêm vào tour.
- **Rà soát:**
  - không phòng nào bị tạo trùng;
  - `REFERENCE_PHOTOS` nay ghi rõ ảnh nào thuộc phòng nào; nhóm 11 tách thành 11a (0015/0081/0297 + 0048) và 11b (0013/0076).

### F.6 Hiệu năng (đo thực)

- **Môi trường đo:**
  - Chrome headless dùng ANGLE D3D11 trên **Intel(R) UHD Graphics (0x4626)**, là GPU tích hợp của máy phát triển;
  - cửa sổ 1280×800, đo trong 5 giây sau khi cảnh ổn định;
  - số liệu từ `requestAnimationFrame` và `renderer.info`.

  | Không gian | FPS | Draw call | Tam giác | Geometry | Texture | Shader program | JS heap |
  |---|---|---|---|---|---|---|---|
  | exterior (bãi cỏ) | 61,4 | 301 | 309.040 | 269 | 52 | 32 | 80 MB |
  | hall + cầu thang mới | 101,6 | 166 | 138.416 | 348 | 55 | 43 | 97 MB |
  | cabinet (Nội các) | 85,1 | 208 | 142.246 | 223 | 54 | 46 | 108 MB |
  | dai_yen (phòng mốc) | 86,9 | 172 | 21.920 | 219 | 61 | 47 | 119 MB |
  | pres_reception | 92,4 | 113 | 18.788 | 209 | 74 | 47 | 64 MB |
  | vp_reception | 92,0 | 108 | 22.554 | 154 | 76 | 45 | 54 MB |

- **Thời gian tải một phòng lần đầu trên GPU này** (từ `LOADING_TARGET_ROOM` đến `TARGET_ROOM_ACTIVE`):

  | Phòng | Thời gian |
  |---|---|
  | hall | 516 ms |
  | cabinet | 285 ms |
  | dai_yen | 611 ms |
  | pres_reception | 539 ms |
  | red_reception | 129 ms |
  | f2_lobby | 79 ms |
  | office2 | 97 ms |

- **Về `LOAD_TIMEOUT` 15 s:** trên GPU thật, thời gian tải thấp hơn mức này 25–190 lần, nên giữ 15 s làm lưới an toàn cho máy phải dùng WebGL phần mềm. Trên SwiftShader, phòng có nhiều vật liệu mới (`pres_reception`) từng vượt mốc 8 s cũ. Chưa áp dụng biên dịch shader trước, vì chưa cần trên GPU thật.
- **Không đo được:** dung lượng bộ nhớ GPU. Trình duyệt không cung cấp API đọc; mục JS heap ở trên là bộ nhớ JavaScript, không phải bộ nhớ GPU.
- **Không đại diện cho GPU thật:** số liệu SwiftShader dùng trong lúc kiểm thử, khoảng 1–2 FPS.
- **Chưa đo:** GPU rời và thiết bị di động.
- **Quan sát:** khi người chơi đứng trong một phòng, số draw call và tam giác thấp hơn ngoài trời nhiều, do mỗi phòng chỉ gắn không gian của chính nó (và một phòng trong cache).

### F.7 File đã thay đổi trong lượt này

- `lib/dinh/palaceModel.ts`: cầu thang chia đôi, lỗ giếng thang, lan can tầng 2, giếng trời (lỗ sàn và mái, cột, lan can, dầm, cửa hành lang), nút điều hướng mới, hàng rào trước chỉ còn va chạm, vùng cây.
- `lib/dinh/spaceModel.ts`: hỗ trợ `sharedRegions`.
- `lib/tour/director.ts`: `tickPassages`, bỏ qua điểm `walk` khi chọn lời nhắc F.
- `lib/tour/navigator.ts`: tìm đường qua liên kết đi bộ.
- `components/game/DinhScene.tsx`: gọi `tickPassages()` mỗi khung hình.
- `components/game/Palace.tsx`: `Gate` mới (hàng rào, cổng, cột đèn, cây chóp), chân cầu thang, lỗ sàn sảnh tầng 2, decor `courtyard`.
- `components/game/PalaceRoomsF2.tsx`: `CourtyardDecor`.
- `components/game/PalaceExterior.tsx`: vị trí trực thăng và hai vòng đỏ.
- `data/dinh/spaces.ts`: `STAIRWELL`, `sharedRegions`, không gian `courtyard`, cửa, `REFERENCE_PHOTOS` đầy đủ.
- `data/dinh/interactions.ts`: liên kết `walk`, gợi ý cầu thang, cửa giếng trời, điểm cửa phòng làm việc.
- `data/dinh/layout.ts`: phòng `courtyard`.
- `data/dinh/rooms2.ts`: `COURT`.
- `data/dinh/sources.ts`: 2 nguồn mới, 4 dữ kiện mới; xóa một dữ kiện `stone-curtain` bị trùng do lượt trước thêm.
- `data/dinh/knowledge.ts`: gắn các dữ kiện mới.

### F.8 Kết quả kiểm thử và build

| Kiểm tra | Kết quả |
|---|---|
| `tsc --noEmit` | Sạch |
| `eslint .` | Sạch |
| `vitest` | 92/92 đạt |
| `next build` | Thành công |

Kiểm tra trong trình duyệt headless:
- đi qua mọi cửa F của các phòng mới (lệch 0 m);
- đi bộ trên cầu thang;
- tự chuyển không gian giữa đại sảnh và sảnh tầng 2;
- vào sân thượng bằng cầu thang thật.

Bộ đệm chỉ giữ thêm một không gian bên cạnh phòng đang đứng (`CACHE_MAX = 1`), và các không gian bị đẩy ra được giải phóng.

### F.9 Hạn chế thực sự còn tồn tại

- **Thiếu sơ đồ tầng:** trang chính thức không có sơ đồ tầng của Dinh. Vì vậy vị trí và kích thước của mọi phòng tầng 2, giếng trời và cầu thang chia đôi là ước lượng.
- **Phòng chiếu phim:** chưa dựng, vì không có nguồn xác minh.
- **Tên phòng chưa xác minh:** nhóm 12 (0003/0286), 13, 14.
- **Kiểm thử chưa chạy:** đi xuống theo vế giữa cầu thang chưa chạy riêng.
- **Góc nhìn sân thượng:** lan can 1,1 m quanh miệng giếng che phần lớn tầm nhìn xuống vườn.
- **Mức chi tiết mô hình:**
  - trực thăng UH-1 vẫn là mô hình giản lược;
  - cây là khối đơn giản, chưa có LOD;
  - cột tầng trệt giếng trời chưa dùng texture granite hồng.
- **Phạm vi đo hiệu năng:** mới đo trên một GPU tích hợp; chưa đo bộ nhớ GPU.
