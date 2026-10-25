# Sài Gòn 3D — Hành trình khám phá di sản
### Saigon 3D — Immersive Heritage Explorer

Bản đồ Sài Gòn 3D dựng từ dữ liệu OpenStreetMap thật, và một chuyến tham quan **Dinh Độc Lập** có thể đi bộ, với hướng dẫn viên AI **Minh Anh** — một NPC thật sự trong thế giới 3D, thuyết minh song ngữ có phụ đề, giọng nói và hỏi đáp dựa trên tư liệu đã kiểm chứng.

> MVP: chỉ Dinh Độc Lập được đầu tư hoàn chỉnh. Các địa điểm khác trên bản đồ ở trạng thái “Sắp ra mắt”.

---

## Chạy dự án

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # kiểm thử nội dung + mô phỏng vật lý Rapier
npm run lint
npm run build        # build production
```

Node.js ≥ 20 (đã kiểm tra trên Node 24). Không cần khóa API: thiếu khóa thì ứng dụng chạy **chế độ demo** — trả lời từ kho tư liệu, đọc bằng giọng của trình duyệt (nếu có giọng tiếng Việt) hoặc hiển thị phụ đề.

### Biến môi trường (`.env.local`, xem `.env.example`)

| Biến | Dùng cho |
|---|---|
| `ANTHROPIC_API_KEY`, `AI_MODEL` | Hỏi đáp AI (mặc định `claude-opus-5-5`), chỉ gọi phía server |
| `TTS_PROVIDER`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` | Giọng đọc Azure (mặc định `vi-VN-HoaiMyNeural`) |
| `GOOGLE_TTS_API_KEY` | Giọng đọc Google Cloud (tự chọn giọng nữ vi-VN) |
| `TTS_VOICE_VI`, `TTS_VOICE_EN` | Ghi đè tên giọng |

Tên giọng thay đổi theo thời gian — hãy đối chiếu danh sách giọng hiện hành của nhà cung cấp khi triển khai.

## Triển khai lên Vercel

1. Đẩy thư mục `saigon3d/` lên một repository GitHub (hoặc đặt **Root Directory** = `saigon3d` khi import).
2. Vercel → **Add New Project** → chọn repository. Framework được nhận diện là Next.js; giữ lệnh build mặc định `next build`.
3. **Settings → Environment Variables**: thêm các biến ở bảng trên (tùy chọn). Không đặt khóa trong mã frontend.
4. Deploy. Các route `/api/ask`, `/api/tts`, `/api/status` chạy dưới dạng serverless function; `/`, `/dinh-doc-lap`, `/sources` là trang tĩnh.

Ghi chú serverless: giới hạn tần suất trong `lib/server/rateLimit.ts` chỉ là bộ nhớ trong của từng instance (chặn spam theo đợt). Muốn giới hạn chặt trên nhiều instance, thay bằng kho chia sẻ (ví dụ Upstash Redis). Ứng dụng không ghi file cục bộ; tiến độ tham quan lưu ở `localStorage` của trình duyệt.

## Điều khiển

| Phím | Chức năng |
|---|---|
| W A S D / mũi tên | Di chuyển |
| Chuột (nhấn vào cảnh để khóa con trỏ) | Nhìn quanh — hoặc kéo chuột nếu không khóa |
| Shift | Chạy |
| E | Tương tác / đóng bảng thông tin |
| V | Góc nhìn thứ nhất ↔ thứ ba |
| Space | Nhảy |
| M | Sơ đồ tầng |
| G | Gọi Minh Anh lại gần |
| Enter | Hỏi Minh Anh |
| H | Ẩn/hiện hướng dẫn |
| Esc | Tạm dừng, cài đặt |

Mọi phím (trừ Esc) đổi được trong Cài đặt. Thiết bị cảm ứng có cần điều khiển ảo, nút E/chạy/đổi góc nhìn và kéo để nhìn.

## Kiến trúc

```
app/                    route: / (bản đồ), /dinh-doc-lap (tham quan), /sources, /api/{ask,tts,status}
components/map/         cảnh thành phố: CityScene, Traffic (xe theo làn, nhường nhau ở giao lộ), LandmarkModels
components/game/        DinhScene (Canvas + Rapier), Palace (render + collider từ cùng dữ liệu), DinhExperience (HUD)
components/player/      Humanoid (nhân vật dựng & hoạt ảnh bằng mã), Player (character controller, camera 1st/3rd)
components/guide/       GuideNPC (state machine FOLLOW/LEAD/WAIT/EXPLAIN/POINT/LISTEN/REJOIN, A* + raycast), GuideCard
components/tour/        StopList, InfoPanel, FloorMap, Overlays (chọn chế độ, tạm dừng, cảm ứng)
components/ui/          Providers (theme/lang), primitives, SettingsDialog, SourcesView, WebGLGate
data/dinh/              sources.ts (dữ kiện + nguồn + mức tin cậy), knowledge.ts, tour.ts, layout.ts (số đo đã xác minh vs ước lượng)
data/                   landmarks.ts (tọa độ OSM), i18n.ts (toàn bộ chuỗi giao diện vi/en), assets.ts (giấy phép)
lib/                    city/ (dựng hình học từ OSM), dinh/ (palaceModel, nav), knowledge/ (truy xuất), audio/ (narrator),
                        server/ (adapter AI & TTS, rate limit), store/ (zustand), tour/ (điều phối tour)
scripts/fetch-osm.mjs   tải & tiền xử lý dữ liệu OSM → public/data/city.json
tests/                  vitest: toàn vẹn kho tri thức, i18n, truy xuất, đồ thị điều hướng, mô phỏng vật lý đi bộ
```

Các điểm thiết kế chính:

- **Một nguồn dữ liệu cho hình, va chạm và đường đi.** `lib/dinh/palaceModel.ts` sinh hộp hiển thị, collider Rapier và đồ thị điều hướng của Minh Anh từ `data/dinh/layout.ts`. Kiểm thử `tests/palace.test.ts` cho một capsule đi bằng character controller của Rapier từ cổng vào đại sảnh, leo 8 vế cầu thang lên sân thượng tới cột cờ, xuống tầng hầm, và xác nhận tường chặn được.
- **Kiến thức nằm trong dữ liệu, không nằm trong component.** Mỗi câu thuyết minh dựa trên một `Fact` có nguồn; dữ kiện mâu thuẫn giữa các trang chính thức được đánh dấu `conflicting` và nêu rõ.
- **AI bị ràng buộc vào kho tư liệu.** `/api/ask` truy xuất mục liên quan rồi gửi kèm cho mô hình với chỉ dẫn chỉ trả lời từ đó; không có khóa hoặc AI lỗi → câu trả lời trích nguyên văn từ kho, và giao diện ghi rõ đó là chế độ demo/dự phòng.
- **Âm thanh không bao giờ chồng nhau và không làm hỏng tour.** `lib/audio/narrator.ts` phát theo từng câu (phụ đề đồng bộ), tự hạ cấp: TTS đám mây → giọng trình duyệt → chỉ phụ đề.

## Độ chính xác — những gì là thật, những gì là mô phỏng

| Thành phần | Trạng thái |
|---|---|
| Mạng lưới đường, sông Sài Gòn, công viên, 2.400 đường bao công trình | Dữ liệu OSM thật (ODbL) |
| Nhà phố lấp đầy dãy phố | **Sinh tự động**, chú thích rõ trên bản đồ |
| Vị trí địa danh | Tâm đối tượng OSM (ID ghi trong `data/landmarks.ts`) |
| Mô hình địa danh trên bản đồ | Hình khối cách điệu theo đường bao OSM |
| Khuôn viên 300×400 m, thảm cỏ 102 m, khối nhà 4.500 m², cao 26 m, các đường bao quanh | Theo dinhdoclap.gov.vn |
| Cách chia khối chữ T, chiều cao tầng, vị trí phòng, nội thất, tầng hầm | **Ước lượng / mô phỏng** — trang chính thức không công bố mặt bằng chi tiết |
| Xe tăng, F‑5E, nhà bát giác, nhà trưng bày | Vị trí theo sơ đồ tham quan chính thức (dạng sơ đồ); mô hình là minh họa |

Sơ đồ “Tầng 1 / Tầng 2” trên trang /visit thuộc **Nhà trưng bày “Từ Dinh Norodom đến Dinh Độc Lập”**, không phải khối nhà chính, nên không được dùng làm mặt bằng của Dinh.

Ảnh tư liệu không được nhúng lại (bản quyền thuộc Di tích); ứng dụng dẫn liên kết tới trang nguồn kèm chú thích.

## Giới hạn hiện tại và hướng mở rộng

- Nhân vật và kiến trúc được dựng bằng mã; nên thay bằng GLB có giấy phép (nhân vật rig + hoạt ảnh, mô hình Dinh từ bản vẽ đo đạc) — giao diện `HumanoidAnim` và `palaceModel` đã tách sẵn để thay.
- Chỉ tầng nền, tầng hầm và sân thượng đi được; các tầng lầu có cửa đóng ở giếng thang (“chưa mô hình hóa”). Có lối tắt cầu thang (E) để bỏ qua đoạn leo 8 vế.
- Hỏi đáp AI và TTS đám mây đã được kiểm tra kiểu và luồng lỗi, nhưng chưa chạy với khóa thật trong môi trường phát triển này.
- Hiệu năng cần đo trên máy thật: có ba mức đồ họa (Thấp/Trung bình/Cao) điều chỉnh bóng đổ, mật độ cây, số xe và độ phân giải.
- Chưa có nhận dạng giọng nói (nhập câu hỏi bằng văn bản).

Cập nhật dữ liệu bản đồ: `npm run data:osm` (cần mạng; kết quả thô được cache trong `scripts/.osm-cache/`).
