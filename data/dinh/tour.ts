import type { Interactable, Localized, TourStop } from "@/types";
import { FLAG_POLE, LEVEL } from "./layout";

const SIM: Localized = {
  vi: "Vị trí điểm dừng trong mô phỏng là ước lượng để phục vụ trải nghiệm, không phải bản đồ chính xác.",
  en: "The stop position in the simulation is an estimate for the experience, not an exact plan.",
};
const OFFICIAL_MAP: Localized = {
  vi: "Bố cục khuôn viên tham chiếu sơ đồ tham quan chính thức (dạng sơ đồ, không theo tỷ lệ).",
  en: "Grounds layout follows the official visitor map (schematic, not to scale).",
};

/**
 * Guided tour. Order follows a natural walk: gate → lawn → façade → the floor-1
 * rooms in the official order around the hall (Cabinet right, Banquet left,
 * Khánh tiết behind the staircase) → floor 2 (Credentials Room) → basement → roof. Every sentence here is backed by a fact in sources.ts.
 */
export const TOUR_STOPS: TourStop[] = [
  {
    id: "stop-gate",
    order: 1,
    title: { vi: "Cổng chính và khuôn viên", en: "Main gate and grounds" },
    floor: "grounds",
    position: [0, 0, 136],
    guideSpot: [3.2, 0, 133],
    lookAt: [0, 12, -20],
    radius: 9,
    knowledge_ids: ["k-overview", "k-norodom"],
    narration: {
      quick: {
        vi: "Chào mừng bạn đến Dinh Độc Lập! Chúng ta đang đứng ở cổng chính trên đường Nam Kỳ Khởi Nghĩa — mặt chính của Dinh. Khuôn viên rộng khoảng 12 héc-ta, được bao bởi bốn tuyến đường.",
        en: "Welcome to the Independence Palace! We are at the main gate on Nam Kỳ Khởi Nghĩa street — the palace's main front. The grounds cover about 12 hectares, bounded by four streets.",
      },
      main: {
        vi: "Khuôn viên rộng 120 nghìn mét vuông, khoảng 300 nhân 400 mét. Phía trước là đường Nam Kỳ Khởi Nghĩa, phía sau là Huyền Trân Công Chúa, bên trái Dinh là Nguyễn Thị Minh Khai và bên phải là Nguyễn Du. Lịch sử nơi này bắt đầu từ ngày 23 tháng 2 năm 1868, khi Thống đốc Nam Kỳ La Grandière đặt viên đá đầu tiên xây Dinh Norodom. Từ năm 1887 đến 1945, dinh là nơi làm việc của các Toàn quyền Đông Dương. Ngày 7 tháng 9 năm 1954, dinh được bàn giao cho chính quyền Ngô Đình Diệm và sau đó mang tên Dinh Độc Lập. Công trình bạn thấy phía trước là dinh mới, xây trên nền dinh cũ. Ngày nay, đây là Di tích quốc gia đặc biệt, còn được gọi là Hội trường Thống Nhất.",
        en: "The grounds cover 120,000 square metres — about 300 by 400 metres. In front is Nam Kỳ Khởi Nghĩa street, behind is Huyền Trân Công Chúa, to the palace's left is Nguyễn Thị Minh Khai and to its right Nguyễn Du. The story begins on 23 February 1868, when Cochinchina Governor La Grandière laid the first stone of Norodom Palace. From 1887 to 1945 it housed the Governors-General of Indochina. On 7 September 1954 it was handed over to Ngô Đình Diệm's government and later became the Independence Palace. The building ahead is the new palace, built on the site of the old one. Today it is a Special National Relic, also known as Reunification Hall.",
      },
      deep: {
        vi: "Dinh Norodom có mặt tiền rộng 80 mét và phòng khách chứa được 800 người. Tên Norodom lấy theo Quốc vương Campuchia đương thời. Hai trang chính thức ghi năm hoàn thành khác nhau: 1871 và 1873 — nên mình ghi nhận cả hai.",
        en: "Norodom Palace had an 80-metre façade and a reception hall for 800 people. It was named after the then King of Cambodia. Two official pages give different completion years — 1871 and 1873 — so I note both.",
      },
    },
    timeline: [
      { date: "23/02/1868", label: { vi: "Khởi công Dinh Norodom", en: "Norodom Palace begun" }, fact_id: "norodom-start" },
      { date: "1887–1945", label: { vi: "Dinh Toàn quyền Đông Dương", en: "Governor-General's Palace" }, fact_id: "governor-general" },
      { date: "07/09/1954", label: { vi: "Bàn giao cho chính quyền Ngô Đình Diệm", en: "Handed to Ngô Đình Diệm" }, fact_id: "handover-1954" },
      { date: "12/08/2009", label: { vi: "Di tích quốc gia đặc biệt", en: "Special National Relic" }, fact_id: "special-2009" },
    ],
    media: [
      { id: "m-norodom-1874", caption: { vi: "Dinh Thống Đốc mới ở Sài Gòn – ảnh M. Gsell, L’Illustration, 1874", en: "The new Governor's Palace in Saigon – photo by M. Gsell, L’Illustration, 1874" }, page_url: "https://dinhdoclap.gov.vn/lich-su-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-ddl-1956", caption: { vi: "Dinh Độc Lập Tết Bính Thân, 1956", en: "Independence Palace, Lunar New Year 1956" }, page_url: "https://dinhdoclap.gov.vn/lich-su-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: OFFICIAL_MAP,
  },
  {
    id: "stop-lawn",
    order: 2,
    title: { vi: "Thảm cỏ oval và sân trước", en: "Oval lawn and forecourt" },
    floor: "grounds",
    position: [-34, 0, 124],
    guideSpot: [-30, 0, 126],
    lookAt: [0, 2, 80],
    radius: 10,
    knowledge_ids: ["k-lawn-pond", "k-grounds-features"],
    narration: {
      quick: {
        vi: "Trước mặt chúng ta là thảm cỏ hình oval rất lớn — đường kính tới 102 mét. Đây là khoảng không gian mở giữa cổng và mặt tiền của Dinh.",
        en: "In front of us is a huge oval lawn — 102 metres across. It is the open space between the gate and the palace façade.",
      },
      main: {
        vi: "Thảm cỏ oval đường kính 102 mét mang lại cảm giác thoáng đãng, êm dịu; từ đây tầm nhìn mở thẳng về mặt tiền. Xung quanh Dinh là hệ thống thảm cỏ, vườn cây cổ thụ và cây kiểng quý; phía sau khu nhà chính còn có bốn sân quần vợt. Khi đến gần mặt tiền, bạn sẽ thấy một hồ nước hình bán nguyệt chạy dọc chiều ngang đại sảnh, trong hồ thả sen và súng — gợi nhớ hồ nước thanh bình ở đình, chùa cổ Việt Nam. Sơ đồ tham quan chính thức cũng đánh dấu khu trưng bày xe tăng và máy bay F5E ở bên phải thảm cỏ khi nhìn từ cổng. Bạn có thể lại gần để xem thông tin.",
        en: "The 102-metre oval lawn gives a calm, open feel, framing the view straight to the façade. Around the palace are lawns, old trees and ornamental plants, and behind the main building there are four tennis courts. Near the façade you'll see a half-moon pond running along the width of the main hall, planted with lotus and water lilies — recalling the peaceful ponds of old Vietnamese communal houses and pagodas. The official visitor map also marks a display of tanks and an F-5E aircraft to the right of the lawn as seen from the gate. Walk over to read more.",
      },
      deep: {
        vi: "Ở góc đường Nguyễn Thị Minh Khai giao Nam Kỳ Khởi Nghĩa có nhà bát giác đường kính 4 mét, mái ngói cong, không tường bao. Phía Nguyễn Du có tòa nhà hai tầng kiểu Pháp, nay trưng bày chuyên đề “Từ Dinh Norodom đến Dinh Độc Lập”. Lưu ý: trong mô phỏng, thảm cỏ được dựng thành hình tròn và vị trí các công trình phụ là ước lượng.",
        en: "At the Nguyễn Thị Minh Khai – Nam Kỳ Khởi Nghĩa corner is a 4-metre octagonal pavilion with a curved tiled roof and no walls. Toward Nguyễn Du stands a two-storey French-style building, now housing the exhibition “From Norodom Palace to Independence Palace”. Note: in the simulation the lawn is drawn as a circle and the side buildings' positions are estimates.",
      },
    },
    timeline: [],
    media: [
      { id: "m-lawn", caption: { vi: "Bồn cỏ phía trước Dinh", en: "The lawn in front of the palace" }, page_url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-sitemap", caption: { vi: "Sơ đồ tham quan khuôn viên", en: "Official grounds visitor map" }, page_url: "https://dinhdoclap.gov.vn/visit/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: OFFICIAL_MAP,
  },
  {
    id: "stop-facade",
    order: 3,
    title: { vi: "Mặt tiền và kiến trúc", en: "Façade and architecture" },
    floor: "grounds",
    position: [0, 0, 16],
    guideSpot: [3.5, 0, 13],
    lookAt: [0, 12, -10],
    radius: 9,
    knowledge_ids: ["k-architect", "k-symbolism", "k-stone-curtain", "k-building"],
    narration: {
      quick: {
        vi: "Đây là mặt tiền của Dinh mới, do Kiến trúc sư Ngô Viết Thụ thiết kế. Công trình khởi công ngày 1 tháng 7 năm 1962 và khánh thành ngày 31 tháng 10 năm 1966.",
        en: "This is the façade of the new palace, designed by architect Ngô Viết Thụ. Work began on 1 July 1962 and it was inaugurated on 31 October 1966.",
      },
      main: {
        vi: "Ngô Viết Thụ là người Việt Nam đầu tiên đạt giải Khôi nguyên La Mã về kiến trúc. Ông kết hợp phong cách hiện đại với tinh thần kiến trúc truyền thống Á Đông. Toàn bộ mặt bằng được bố trí theo hình chữ Cát, nghĩa là tốt lành. Lầu trên cùng hình chữ Khẩu; cùng cột cờ ở giữa tạo thành chữ Trung. Các đường mái hiên và ban công tạo chữ Tam, nối với nét sổ dọc thành chữ Vương, thêm kỳ đài phía trên thành chữ Chủ — tượng trưng cho chủ quyền quốc gia. Cả mặt tiền với ban công tầng 2, tầng 3, mái hiên và hai cột gỗ tạo thành chữ Hưng, cầu chúc đất nước hưng thịnh. Hãy để ý rèm hoa đá bao quanh tầng 2: những đốt trúc cách điệu từ cửa bàn khoa của cung điện Huế, vừa đẹp vừa điều hòa ánh sáng tự nhiên. Khối nhà chính hình chữ T, rộng 4.500 mét vuông mặt bằng và cao 26 mét.",
        en: "Ngô Viết Thụ was the first Vietnamese to win the Grand Prix de Rome in architecture. He combined modern style with the spirit of traditional East Asian architecture. The whole plan follows the character Cát — good fortune. The top pavilion forms Khẩu; with the central flagpole it becomes Trung. Eaves and balconies form Tam, joined by a vertical stroke into Vương, and with the flag platform above into Chủ — national sovereignty. The whole façade, with its 2nd- and 3rd-floor balconies, eaves and two wooden columns, forms Hưng — prosperity. Notice the stone curtain around the 2nd floor: bamboo-like segments stylised from the bàn khoa doors of Huế's palaces, both beautiful and filtering daylight. The T-shaped main building has a 4,500 square-metre footprint and is 26 metres tall.",
      },
      deep: {
        vi: "Công trình gồm 3 tầng lầu, 2 gác lửng, sân thượng, tầng nền và tầng hầm, tổng diện tích sử dụng 20.000 mét vuông với gần 100 phòng. Trong lúc thi công, Tổng thống Ngô Đình Diệm bị lật đổ và qua đời ngày 2 tháng 11 năm 1963; lễ khánh thành do Nguyễn Văn Thiệu chủ trì. Lưu ý: mô hình mặt tiền trong mô phỏng là khái quát hóa, chưa phải bản tái tạo chính xác.",
        en: "The building has 3 upper floors, 2 mezzanines, a rooftop terrace, a ground floor and a basement — 20,000 square metres and nearly 100 rooms. During construction President Ngô Đình Diệm was overthrown and killed on 2 November 1963; Nguyễn Văn Thiệu presided over the inauguration. Note: the façade in this simulation is a generalised model, not an exact reconstruction.",
      },
    },
    timeline: [
      { date: "27/02/1962", label: { vi: "Dinh cũ bị ném bom", en: "Old palace bombed" }, fact_id: "bombing-1962" },
      { date: "01/07/1962", label: { vi: "Khởi công dinh mới", en: "New palace begun" }, fact_id: "construction-start" },
      { date: "02/11/1963", label: { vi: "Ngô Đình Diệm bị lật đổ", en: "Ngô Đình Diệm overthrown" }, fact_id: "diem-1963" },
      { date: "31/10/1966", label: { vi: "Khánh thành", en: "Inauguration" }, fact_id: "inauguration" },
    ],
    media: [
      { id: "m-sketch", caption: { vi: "Phác thảo của KTS Ngô Viết Thụ năm 1962", en: "Ngô Viết Thụ's 1962 sketch" }, page_url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-curtain", caption: { vi: "Rèm hoa đá xung quanh tầng 2", en: "The stone curtain around the 2nd floor" }, page_url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-1966", caption: { vi: "Cắt băng khánh thành ngày 31/10/1966", en: "Ribbon cutting, 31 October 1966" }, page_url: "https://dinhdoclap.gov.vn/lich-su-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-cabinet",
    order: 4,
    title: { vi: "Phòng họp Hội đồng Nội các", en: "Cabinet Meeting Room" },
    floor: "f1",
    position: [24, LEVEL.f1, -22],
    guideSpot: [24, LEVEL.f1, -18.5],
    lookAt: [32, LEVEL.f1 + 1, -23],
    radius: 6,
    knowledge_ids: ["k-cabinet"],
    narration: {
      quick: {
        vi: "Đây là Phòng họp Hội đồng Nội các, một trong những phòng tiêu biểu của Dinh.",
        en: "This is the Cabinet Meeting Room, one of the palace's representative rooms.",
      },
      main: {
        vi: "Phòng họp Hội đồng Nội các được giới thiệu trên trang chính thức của di tích như một không gian tiêu biểu. Tên phòng cho biết đây là nơi nội các họp bàn. Giống các phòng khác, nội thất dùng đường nét thẳng, mạch lạc theo tinh thần chính đại quang minh. Bàn ghế bạn thấy được bố trí để minh họa công năng phòng họp; đây không phải bản sao chính xác của hiện vật. Nếu bạn có câu hỏi về căn phòng, cứ hỏi mình — mình sẽ trả lời dựa trên tư liệu đã kiểm chứng, và nói rõ khi chưa có thông tin.",
        en: "The official site presents the Cabinet Meeting Room as one of the palace's representative spaces. Its name tells us the cabinet met here. Like the other rooms, its interior uses straight, clear lines in the spirit of “chính đại quang minh”. The table and chairs you see illustrate the room's function; they are not an exact replica. If you have questions about this room, ask me — I'll answer from verified sources and tell you when information is missing.",
      },
      deep: {
        vi: "Mình chưa có tư liệu đã xác minh về nội dung các cuộc họp cụ thể tại phòng này, nên không kể chi tiết để tránh sai lệch.",
        en: "I have no verified records of specific meetings in this room, so I won't add details that could be wrong.",
      },
    },
    timeline: [],
    media: [
      { id: "m-cabinet", caption: { vi: "Phòng họp Hội đồng Nội các", en: "Cabinet Meeting Room" }, page_url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-dai-yen",
    order: 5,
    title: { vi: "Phòng Đại yến", en: "State Banquet Room" },
    floor: "f1",
    position: [-24, LEVEL.f1, -20.2],
    guideSpot: [-27, LEVEL.f1, -19.2],
    lookAt: [-44.8, LEVEL.f1 + 2.6, -23],
    radius: 6,
    knowledge_ids: ["k-dai-yen"],
    narration: {
      quick: {
        vi: "Đây là Phòng Đại yến, bên trái sảnh lầu một.",
        en: "This is the State Banquet Room, to the left of the entrance hall.",
      },
      main: {
        vi: "Theo trang chính thức, bước vào sảnh, bên trái là phòng Đại yến. Ở cuối phòng là bức sơn dầu “Sơn Hà Cẩm Tú”. Điều thú vị là tác giả chính là kiến trúc sư Ngô Viết Thụ — người thiết kế Dinh. Ông hoàn thành bức tranh chỉ trong mười ngày để kịp lễ khánh thành ngày 31 tháng 10 năm 1966, và dùng chất liệu sơn dầu phương Tây để nói lên một tâm hồn Việt Nam. Bàn tiệc dài, ghế tựa cao và những bình gốm trên bệ gỗ bạn thấy được dựng theo ảnh tư liệu; kích thước và vị trí là ước lượng, bề mặt tranh chỉ là minh họa.",
        en: "According to the official site, entering the hall, the Banquet Room is on the left. At the end of the room hangs the oil painting “Sơn Hà Cẩm Tú”. Remarkably, its author is the architect Ngô Viết Thụ — the palace's designer. He finished it in only ten days for the inauguration on 31 October 1966, using Western oil painting to express a Vietnamese soul. The long table, high-backed chairs and vases on wooden pedestals were modelled from reference photos; sizes and positions are estimates and the painted surface is only illustrative.",
      },
      deep: {
        vi: "Trong diễn văn khánh thành, kiến trúc sư gọi nơi này là “phòng ăn lớn” và nói bức tranh tóm tắt những khuôn phép ông dùng khi thiết kế Dinh.",
        en: "In his inauguration speech the architect called this room “the large dining room” and said the painting summed up the principles he used in designing the palace.",
      },
    },
    timeline: [],
    media: [
      { id: "m-dai-yen", caption: { vi: "Sơn Hà Cẩm Tú", en: "Sơn Hà Cẩm Tú" }, page_url: "https://dinhdoclap.gov.vn/son-ha-cam-tu-loi-gui-gam-trong-thiet-ke-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-khanh-tiet",
    order: 6,
    title: { vi: "Phòng Khánh tiết", en: "Khánh tiết Room" },
    floor: "f1",
    position: [0, LEVEL.f1, -48.2],
    guideSpot: [3, LEVEL.f1, -49],
    lookAt: [0, LEVEL.f1 + 2.4, -44],
    radius: 6,
    knowledge_ids: ["k-khanh-tiet"],
    narration: {
      quick: {
        vi: "Chúng ta đang ở Phòng Khánh tiết, phía sau cầu thang trung tâm.",
        en: "We are in the Khánh tiết Room, behind the central staircase.",
      },
      main: {
        vi: "Trang chính thức mô tả: phía trước sảnh là cầu thang trung tâm dẫn lên lầu hai, và phía sau cầu thang là không gian gần như ẩn mình của phòng Khánh tiết. Ở phía đầu phòng là bức tranh thủy mặc “Việt Nam Quốc Tổ” của họa sĩ Trọng Nội, dài 5,6 mét, ghép từ 8 tấm. Giữa tranh là Quốc Tổ Hùng Vương ngồi giữa hai hàng bá quan, tay cầm bút viết hai chữ “Văn Lang”. Ngày 22 tháng 10 năm 1966, họa sĩ viết thư xin tặng tác phẩm và từ chối nhận thù lao. Thảm đỏ hoa văn, cột gỗ, trần ô và đèn pha lê được dựng theo ảnh; kích thước phòng là ước lượng.",
        en: "The official site describes it: ahead of the hall the central staircase leads up, and behind it lies the almost hidden Khánh tiết Room. At the head of the room is the ink painting “Việt Nam Quốc Tổ” by Trọng Nội, 5.6 metres long in 8 panels. At its centre the Hùng King sits between two rows of mandarins, writing the words “Văn Lang”. On 22 October 1966 the painter offered the work as a gift and declined any fee. The patterned red carpet, wooden pilasters, coffered ceiling and crystal chandeliers follow the photos; the room's size is an estimate.",
      },
      deep: {
        vi: "Ban Trang trí đã xin ý kiến kiến trúc sư Ngô Viết Thụ và kỹ sư Phan Văn Điển về việc treo tác phẩm tại phòng Khánh tiết. Bề mặt tranh trong mô phỏng chỉ là minh họa thủy mặc, không phải bản sao.",
        en: "The decoration committee consulted the architect Ngô Viết Thụ and engineer Phan Văn Điển about hanging the work in this room. The surface here is only an ink-wash illustration, not a copy.",
      },
    },
    timeline: [],
    media: [
      { id: "m-khanh-tiet", caption: { vi: "Việt Nam Quốc Tổ", en: "Việt Nam Quốc Tổ" }, page_url: "https://dinhdoclap.gov.vn/hanh-trinh-60-nam-cua-buc-tranh-thuy-mac-viet-nam-quoc-to/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-credentials",
    order: 7,
    title: { vi: "Phòng Trình Quốc thư", en: "Credentials Presentation Room" },
    floor: "f2",
    position: [0, LEVEL.f2, -24],
    guideSpot: [-3.2, LEVEL.f2, -22.8],
    lookAt: [0, LEVEL.f2 + 2.9, -12],
    radius: 6,
    knowledge_ids: ["k-credentials", "k-symbolism"],
    narration: {
      quick: {
        vi: "Đây là Phòng Trình Quốc thư — trang chính thức gọi đây là trung tâm của Dinh.",
        en: "This is the Credentials Presentation Room — the official site calls it the centre of the palace.",
      },
      main: {
        vi: "Mặt bằng Dinh theo hình chữ Cát, và trung tâm của Dinh là Phòng Trình Quốc thư. Bức sơn mài lớn trước mặt bạn là “Bình Ngô Đại Cáo” của họa sĩ Nguyễn Văn Minh, rộng 8,20 mét, cao 4,70 mét, do công ty Mỹ nghệ Mê Linh thực hiện giữa năm 1966. Tranh thể hiện buổi đại lễ sau thắng lợi khởi nghĩa Lam Sơn: các hàng người, cờ xí ở trung tâm, dãy Trường Sơn trải dài phía sau và ruộng đồng, nhà cửa phía dưới. Mình cần nói rõ: bề mặt tranh trong mô phỏng chỉ là minh họa đúng chất liệu và kích thước, không phải bản sao tác phẩm; vị trí của phòng trên tầng 2 cũng là ước lượng.",
        en: "The palace plan follows the character Cát, and its centre is the Credentials Presentation Room. The great lacquer painting before you is “Bình Ngô Đại Cáo” by Nguyễn Văn Minh, 8.20 metres wide and 4.70 metres tall, made by the Mê Linh fine-arts company in mid-1966. It shows the ceremony after the Lam Sơn uprising's victory: ranks of people and banners in the centre, the Trường Sơn range behind and fields and houses below. To be clear: the painted surface here only illustrates the medium and size, it is not a copy of the work; the room's position on floor 2 is also an estimate.",
      },
      deep: {
        vi: "“Bình Ngô Đại Cáo” của Nguyễn Trãi thường được gọi là bản tuyên ngôn độc lập thứ hai của dân tộc. Theo hồ sơ lưu trữ, bức tranh được xếp vào nhóm công trình mỹ thuật “dành riêng”, không đấu giá như một số thiết bị nội thất khác.",
        en: "Nguyễn Trãi's “Bình Ngô Đại Cáo” is often called the nation's second declaration of independence. According to the archives, the painting was listed among the works of art “reserved” for the palace, not auctioned like some furnishings.",
      },
    },
    timeline: [],
    media: [
      { id: "m-credentials", caption: { vi: "Bình Ngô Đại Cáo – sơn mài", en: "Bình Ngô Đại Cáo – lacquer" }, page_url: "https://dinhdoclap.gov.vn/binh-ngo-dai-cao-tu-ang-hung-van-den-sac-voc-son-mai/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-pres-reception",
    order: 8,
    title: { vi: "Phòng Tiếp khách Tổng thống", en: "President's Reception Room" },
    floor: "f2",
    position: [-18, LEVEL.f2, -19],
    guideSpot: [-14.6, LEVEL.f2, -20.6],
    lookAt: [-18, LEVEL.f2 + 2.2, -31],
    radius: 6,
    knowledge_ids: ["k-pres-reception"],
    narration: {
      quick: {
        vi: "Đây là Phòng Tiếp khách Tổng thống ở tầng 2.",
        en: "This is the President's Reception Room on floor 2.",
      },
      main: {
        vi: "Theo trang chính thức của Dinh, trong phòng Tiếp khách Tổng thống có hai chiếc tủ sơn mài đỏ thẫm. Bốn cánh tủ được vẽ vàng đề tài “Mai – Lan” và “Cúc – Trúc” bởi trang trí gia Nguyễn Văn Triêm, theo phiếu đặt hàng ngày 4 tháng 1 năm 1967; dưới cánh tủ bên trái còn dấu triện “Triêm – Trang trí gia – 1966”. Bộ sofa gấm vàng, tấm thảm đỏ có chữ Thọ và khám gỗ với đôi ngà voi được dựng theo ảnh chụp. Mình nói rõ: vị trí phòng trong tầng là ước lượng, và họa tiết trên cánh tủ ở đây chỉ là minh họa.",
        en: "According to the palace's official site, the President's Reception Room holds two deep-red lacquer cabinets. Their four doors were painted in gold with Plum–Orchid and Chrysanthemum–Bamboo by the decorator Nguyễn Văn Triêm, ordered on 4 January 1967; under the left door his seal still reads “Triêm – decorator – 1966”. The gold damask sofas, the red carpet with the longevity character and the wood niche with elephant tusks follow the photographs. To be clear: the room's position on the floor is an estimate, and the cabinet painting here is only illustrative.",
      },
      deep: {
        vi: "Mai, Lan, Cúc, Trúc là bộ tứ quân tử trong mỹ thuật phương Đông, tượng trưng cho bốn mùa và phẩm chất người quân tử.",
        en: "Plum, orchid, chrysanthemum and bamboo are the “four gentlemen” of East Asian art, standing for the four seasons and a noble character.",
      },
    },
    timeline: [],
    media: [
      { id: "m-pres-reception", caption: { vi: "Tủ sơn mài phòng Tiếp khách Tổng thống", en: "Lacquer cabinets of the President's Reception Room" }, page_url: "https://dinhdoclap.gov.vn/nhung-net-ve-mai-lan-cuc-truc-tren-tu-phong-tiep-khach-tong-thong/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
  {
    id: "stop-basement",
    order: 9,
    title: { vi: "Tầng hầm", en: "The basement" },
    floor: "basement",
    position: [7, LEVEL.basement, -45.5],
    guideSpot: [4.2, LEVEL.basement, -46.5],
    lookAt: [12.5, LEVEL.basement + 1.5, -40.2],
    radius: 7,
    knowledge_ids: ["k-basement"],
    narration: {
      quick: {
        vi: "Chúng ta đã xuống tầng hầm. Theo hồ sơ di tích, tầng hầm này chịu được oanh kích của bom lớn và pháo.",
        en: "We're now in the basement. According to the relic dossier, it could withstand heavy bombs and artillery.",
      },
      main: {
        vi: "Dinh Độc Lập có một tầng hầm nằm dưới tầng nền. Hồ sơ di tích ghi tầng hầm chịu được oanh kích của bom lớn và pháo. Công trình được trang bị các hệ thống phụ trợ rất hiện đại thời bấy giờ: điều hòa không khí, phòng chống cháy, thông tin liên lạc và nhà kho. Trong bối cảnh chiến tranh, một không gian như vậy có vai trò bảo vệ và duy trì liên lạc cho bộ máy làm việc trong Dinh. Mình phải lưu ý bạn: các phòng và thiết bị ở đây chỉ được dựng khái quát để minh họa; vị trí và cách bố trí không phải bản sao của hiện trạng tầng hầm.",
        en: "The Independence Palace has a basement beneath the ground floor. The relic dossier says it could withstand heavy bombs and artillery. The building had support systems that were very modern for the time: air conditioning, fire protection, communications and storage. In wartime, such a space served to protect and keep communications running for those working in the palace. I must point out: the rooms and equipment here are only generalised illustrations; their positions and layout are not a replica of the real basement.",
      },
      deep: {
        vi: "Nếu muốn xem tầng hầm thật, bạn có thể tham quan trực tiếp hoặc dùng trải nghiệm 360 độ trên trang chính thức của Dinh.",
        en: "To see the real basement, visit in person or try the 360° experience on the palace's official website.",
      },
    },
    timeline: [],
    media: [],
    spatial_confidence: "simulated",
    spatial_note: {
      vi: "Bố trí tầng hầm trong mô phỏng là minh họa; nguồn chính thức chỉ mô tả khả năng chịu bom và các hệ thống phụ trợ.",
      en: "The basement layout is illustrative; official sources only describe its bomb resistance and support systems.",
    },
  },
  {
    id: "stop-roof",
    order: 10,
    title: { vi: "Sân thượng và dấu mốc lịch sử", en: "Rooftop and historic moments" },
    floor: "roof",
    position: [0, LEVEL.roof, -26.5],
    guideSpot: [3.2, LEVEL.roof, -25],
    lookAt: [FLAG_POLE[0], FLAG_POLE[1] + 6, FLAG_POLE[2]],
    radius: 7,
    knowledge_ids: ["k-1975", "k-bombing-1962", "k-f5e-1975", "k-symbolism"],
    narration: {
      quick: {
        vi: "Chúng ta đang ở sân thượng. Lầu trên cùng được gọi là Tứ phương vô sự lầu — nghĩa là bốn phương thanh bình.",
        en: "We're on the rooftop. The top pavilion is called Tứ phương vô sự lầu — “peace in the four directions”.",
      },
      main: {
        vi: "Nơi đây gắn với nhiều dấu mốc. Ngày 27 tháng 2 năm 1962, dinh cũ bị hai phi công Nguyễn Văn Cử và Phạm Phú Quốc ném bom hư hại nặng — chính sự kiện này dẫn đến việc xây dinh mới mà ta đang đứng, nên công trình hôm nay không mang dấu vết của vụ ném bom ấy. Ngày 8 tháng 4 năm 1975, máy bay F5E do Nguyễn Thành Trung lái ném bom vào Dinh nhưng gây hư hại không đáng kể. Và lúc 10 giờ 45 phút ngày 30 tháng 4 năm 1975, xe tăng 843 húc cổng phụ, xe tăng 390 húc tung cổng chính tiến vào sân Dinh. 11 giờ 30 phút, Trung úy Bùi Quang Thận kéo lá cờ Mặt trận Dân tộc Giải phóng miền Nam Việt Nam lên nóc Dinh. Tổng thống Dương Văn Minh tuyên bố đầu hàng vô điều kiện — thời khắc chấm dứt chiến tranh, thống nhất đất nước.",
        en: "This place is tied to many milestones. On 27 February 1962 pilots Nguyễn Văn Cử and Phạm Phú Quốc bombed the old palace, damaging it badly — which led to building the new palace we're standing on, so today's building carries no marks of that bombing. On 8 April 1975 an F-5E flown by Nguyễn Thành Trung bombed the palace, causing only minor damage. And at 10:45 on 30 April 1975 tank 843 rammed the side gate and tank 390 smashed through the main gate into the courtyard. At 11:30 First Lieutenant Bùi Quang Thận raised the flag of the National Liberation Front of South Vietnam on the palace roof. President Dương Văn Minh announced unconditional surrender — the moment the war ended and the country was reunified.",
      },
      deep: {
        vi: "Từ ngày 16 đến 21 tháng 11 năm 1975, Dinh là nơi tổ chức Hội nghị Hiệp thương chính trị thống nhất hai miền, sau đó được đổi tên thành Hội trường Thống Nhất. Về số hiệu lữ đoàn của xe tăng 843, hai trang chính thức ghi khác nhau (203 và 230), nên mình không khẳng định con số này.",
        en: "From 16 to 21 November 1975 the palace hosted the political consultative conference on reunification, and was later renamed Reunification Hall. Two official pages differ on tank 843's brigade number (203 vs 230), so I don't assert either.",
      },
    },
    timeline: [
      { date: "27/02/1962", label: { vi: "Dinh cũ bị ném bom", en: "Old palace bombed" }, fact_id: "bombing-1962" },
      { date: "08/04/1975", label: { vi: "Máy bay F5E ném bom Dinh", en: "F-5E bombs the palace" }, fact_id: "f5e-1975" },
      { date: "30/04/1975 10:45", label: { vi: "Xe tăng húc cổng", en: "Tanks break the gates" }, fact_id: "tanks-1975" },
      { date: "30/04/1975 11:30", label: { vi: "Cắm cờ trên nóc Dinh", en: "Flag raised on the roof" }, fact_id: "flag-1975" },
      { date: "16–21/11/1975", label: { vi: "Hội nghị Hiệp thương", en: "Reunification conference" }, fact_id: "reunification-conf" },
    ],
    media: [
      { id: "m-1962", caption: { vi: "Dinh sau vụ ném bom 27/2/1962", en: "The palace after the 27 Feb 1962 bombing" }, page_url: "https://dinhdoclap.gov.vn/lich-su-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-tank", caption: { vi: "Xe tăng húc cổng Dinh ngày 30/4/1975", en: "Tank breaking the gate, 30 April 1975" }, page_url: "https://dinhdoclap.gov.vn/lich-su-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
      { id: "m-roof", caption: { vi: "Tứ phương vô sự lầu", en: "Tứ phương vô sự lầu" }, page_url: "https://dinhdoclap.gov.vn/kien-truc-dinh-doc-lap/", credit: "dinhdoclap.gov.vn" },
    ],
    spatial_confidence: "estimated",
    spatial_note: SIM,
  },
];

export const INTERACTABLES: Interactable[] = [
  {
    id: "i-tanks", floor: "grounds", position: [80, 0, 112], radius: 7, knowledge_id: "k-1975", confidence_status: "simulated",
    title: { vi: "Khu trưng bày xe tăng", en: "Tank display" },
    body: {
      vi: "Sơ đồ tham quan chính thức đánh dấu khu trưng bày xe tăng tại khu vực này. Lúc 10 giờ 45 phút ngày 30/4/1975, xe tăng 843 húc cổng phụ và xe tăng 390 húc tung cổng chính của Dinh. Mô hình trong mô phỏng chỉ là minh họa, không phải bản sao của hiện vật.",
      en: "The official visitor map marks a tank display in this area. At 10:45 on 30 April 1975, tank 843 rammed the side gate and tank 390 smashed the main gate. The models here are illustrations, not replicas of the exhibits.",
    },
  },
  {
    id: "i-f5e", floor: "grounds", position: [106, 0, 88], radius: 8, knowledge_id: "k-f5e-1975", confidence_status: "simulated",
    title: { vi: "Máy bay F5E", en: "F-5E aircraft" },
    body: {
      vi: "Sơ đồ chính thức đánh dấu máy bay F5E trưng bày tại đây. Ngày 8/4/1975, máy bay F5E do Nguyễn Thành Trung lái, xuất phát từ Biên Hòa, ném bom vào Dinh nhưng gây hư hại không đáng kể. Mô hình là minh họa.",
      en: "The official map marks an F-5E on display here. On 8 April 1975 an F-5E flown by Nguyễn Thành Trung from Biên Hòa bombed the palace, causing only minor damage. The model is illustrative.",
    },
  },
  {
    id: "i-octagon", floor: "grounds", position: [176, 0, 126], radius: 7, knowledge_id: "k-grounds-features", confidence_status: "verified",
    title: { vi: "Nhà bát giác", en: "Octagonal pavilion" },
    body: {
      vi: "Nhà bát giác đường kính 4 m, xây trên gò đất cao, không xây tường bao, mái ngói cong cổ kính — một không gian nghỉ mát, thư giãn ở góc Nguyễn Thị Minh Khai – Nam Kỳ Khởi Nghĩa.",
      en: "A 4 m octagonal pavilion on a raised mound, open-sided with a curved tiled roof — a place to rest at the Nguyễn Thị Minh Khai – Nam Kỳ Khởi Nghĩa corner.",
    },
  },
  {
    id: "i-exhibition", floor: "grounds", position: [-160, 0, 58], radius: 9, knowledge_id: "k-norodom", confidence_status: "verified",
    title: { vi: "Nhà trưng bày “Từ Dinh Norodom đến Dinh Độc Lập”", en: "Exhibition “From Norodom Palace to Independence Palace”" },
    body: {
      vi: "Tòa nhà 2 tầng phong cách Pháp, xây cùng thời với Dinh Norodom, nay trưng bày chuyên đề “Từ Dinh Norodom đến Dinh Độc Lập 1868–1966”. Trong mô phỏng, tòa nhà chỉ được thể hiện khái quát và chưa mở cửa.",
      en: "A two-storey French-style building from the Norodom era, now home to the exhibition “From Norodom Palace to Independence Palace 1868–1966”. In the simulation it is only a generalised, closed model.",
    },
  },
  {
    id: "i-pond", floor: "grounds", position: [-20, 0, 4], radius: 6, knowledge_id: "k-lawn-pond", confidence_status: "verified",
    title: { vi: "Hồ nước bán nguyệt", en: "Half-moon pond" },
    body: {
      vi: "Hồ nước hình bán nguyệt chạy dọc chiều ngang đại sảnh, thả sen và súng, gợi nhớ hồ nước thanh bình tại các đình, chùa cổ Việt Nam.",
      en: "The half-moon pond runs along the width of the main hall, planted with lotus and water lilies, recalling the ponds of old Vietnamese communal houses and pagodas.",
    },
  },
  {
    id: "i-curtain", floor: "grounds", position: [22, 0, 4], radius: 6, knowledge_id: "k-stone-curtain", confidence_status: "verified",
    title: { vi: "Rèm hoa đá", en: "Stone curtain" },
    body: {
      vi: "Nhìn lên tầng 2: rèm hoa đá mô phỏng những đốt trúc, cách điệu từ “cửa bàn khoa” của cung điện Huế, vừa tạo điểm nhấn vừa điều hòa ánh sáng tự nhiên.",
      en: "Look up at the 2nd floor: the stone curtain imitates bamboo segments, stylised from the “bàn khoa” doors of Huế's palaces — decorative and filtering daylight.",
    },
  },
  {
    id: "i-artwork", floor: "f1", position: [0, LEVEL.f1, -56], radius: 4, knowledge_id: "k-building", confidence_status: "simulated",
    title: { vi: "Tranh trang trí (mô phỏng)", en: "Decorative artwork (simulated)" },
    body: {
      vi: "Các phòng của Dinh được trang trí bằng nhiều tranh sơn mài, sơn dầu với chủ đề “non sông cẩm tú”. Tấm tranh trong mô phỏng chỉ là khung minh họa, không tái hiện tác phẩm thật.",
      en: "The palace rooms are decorated with lacquer and oil paintings on the theme of a beautiful homeland. The panel here is only a placeholder and does not reproduce a real artwork.",
    },
  },
  {
    id: "i-cabinet-table", floor: "f1", position: [32, LEVEL.f1, -23], radius: 5, knowledge_id: "k-cabinet", confidence_status: "simulated",
    title: { vi: "Bàn họp (minh họa)", en: "Meeting table (illustrative)" },
    body: {
      vi: "Bàn ghế được bố trí để minh họa công năng phòng họp Hội đồng Nội các; không phải bản sao hiện vật.",
      en: "The furniture illustrates the function of the Cabinet Meeting Room; it is not a replica of the original pieces.",
    },
  },
  {
    id: "i-comms", floor: "basement", position: [-15, LEVEL.basement, -47], radius: 5, knowledge_id: "k-basement", confidence_status: "simulated",
    title: { vi: "Khu thông tin liên lạc (mô phỏng)", en: "Communications area (simulated)" },
    body: {
      vi: "Hồ sơ di tích ghi Dinh có hệ thống thông tin liên lạc hiện đại. Thiết bị ở đây là minh họa khái quát, không phải bản sao hiện vật.",
      en: "The relic dossier says the palace had a modern communications system. The equipment here is a generic illustration, not a replica.",
    },
  },
  {
    id: "i-flag", floor: "roof", position: [FLAG_POLE[0], FLAG_POLE[1], FLAG_POLE[2] + 2.5], radius: 4, knowledge_id: "k-1975", confidence_status: "verified",
    title: { vi: "Cột cờ và chữ Trung", en: "The flagpole and the character Trung" },
    body: {
      vi: "Lầu thượng hình chữ Khẩu (口) cùng cột cờ chính giữa tạo thành chữ Trung (中). 11 giờ 30 phút ngày 30/4/1975, Trung úy Bùi Quang Thận kéo lá cờ Mặt trận Dân tộc Giải phóng miền Nam Việt Nam lên nóc Dinh. Vị trí cột cờ trong mô phỏng là ước lượng.",
      en: "The rooftop pavilion shaped like Khẩu (口), with the central flagpole, forms Trung (中). At 11:30 on 30 April 1975, First Lieutenant Bùi Quang Thận raised the National Liberation Front flag on the palace roof. The flagpole position in the simulation is an estimate.",
    },
  },
];

export const STOP_BY_ID = new Map(TOUR_STOPS.map((s) => [s.id, s]));
