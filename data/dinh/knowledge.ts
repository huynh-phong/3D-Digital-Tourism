import type { KnowledgeEntry } from "@/types";
import { FACT_BY_ID, SOURCE_BY_ID } from "./sources";

type Draft = Omit<KnowledgeEntry, "source_urls">;

/** source_urls are derived from the facts, so they can never drift. */
const entry = (d: Draft): KnowledgeEntry => {
  const urls = new Set<string>();
  for (const id of d.facts) {
    const fact = FACT_BY_ID.get(id);
    if (!fact) throw new Error(`Unknown fact ${id} in knowledge entry ${d.id}`);
    for (const s of fact.source_ids) urls.add(SOURCE_BY_ID.get(s)!.url);
  }
  return { ...d, source_urls: [...urls] };
};

export const KNOWLEDGE: KnowledgeEntry[] = [
  entry({
    id: "k-overview",
    name_vi: "Tổng quan Dinh Độc Lập",
    name_en: "Independence Palace overview",
    description_vi:
      "Dinh Độc Lập tại số 135 Nam Kỳ Khởi Nghĩa, TP. Hồ Chí Minh, là Di tích quốc gia đặc biệt. Khuôn viên rộng 12 ha, được bao bởi bốn tuyến đường Nam Kỳ Khởi Nghĩa, Huyền Trân Công Chúa, Nguyễn Thị Minh Khai và Nguyễn Du.",
    description_en:
      "The Independence Palace at 135 Nam Kỳ Khởi Nghĩa, Ho Chi Minh City, is a Special National Relic. Its 12-hectare grounds are bounded by Nam Kỳ Khởi Nghĩa, Huyền Trân Công Chúa, Nguyễn Thị Minh Khai and Nguyễn Du streets.",
    historical_context_vi:
      "Trải qua hơn 150 năm, nơi đây lần lượt là Dinh Norodom thời thuộc địa, Dinh Độc Lập thời Việt Nam Cộng hòa và là nơi ghi dấu thời khắc 30/4/1975. Di tích còn được gọi là Hội trường Thống Nhất.",
    historical_context_en:
      "Over more than 150 years the site was the colonial Norodom Palace, then the Independence Palace of the Republic of Vietnam, and witnessed the events of 30 April 1975. It is also called Reunification Hall.",
    facts: ["site-address", "site-area", "site-streets", "site-names", "special-2009", "relic-1976"],
    tour_stop_id: "stop-gate",
    floor: "grounds",
    spatial_reference: "Cổng chính trên đường Nam Kỳ Khởi Nghĩa",
    confidence_status: "verified",
    keywords: ["dinh doc lap", "tong quan", "o dau", "dia chi", "hoi truong thong nhat", "di tich", "overview", "where", "address"],
  }),
  entry({
    id: "k-norodom",
    name_vi: "Dinh Norodom (1868–1962)",
    name_en: "Norodom Palace (1868–1962)",
    description_vi:
      "Dinh Norodom khởi công ngày 23/02/1868 theo đồ án của kiến trúc sư Hermite, có mặt tiền rộng 80 m và phòng khách chứa được 800 người.",
    description_en:
      "Norodom Palace was begun on 23 February 1868 to a scheme by architect Hermite, with an 80 m façade and a reception hall for 800 people.",
    historical_context_vi:
      "Dinh mang tên Quốc vương Campuchia Norodom. Từ 1887 đến 1945 là nơi làm việc của Toàn quyền Đông Dương; năm 1945 Nhật tiếp quản rồi Pháp trở lại; ngày 07/9/1954 được bàn giao cho chính quyền Ngô Đình Diệm và đổi tên thành Dinh Độc Lập.",
    historical_context_en:
      "It was named after King Norodom of Cambodia. From 1887 to 1945 it housed the Governors-General of Indochina; Japan seized it in 1945 before the French returned; on 7 September 1954 it was handed to Ngô Đình Diệm's government and renamed the Independence Palace.",
    facts: ["norodom-start", "norodom-complete", "norodom-facade", "norodom-name", "governor-general", "japan-1945", "handover-1954", "rename-doc-lap"],
    tour_stop_id: "stop-gate",
    floor: "grounds",
    spatial_reference: "Dinh cũ nằm trên cùng khu đất với dinh hiện nay",
    confidence_status: "verified",
    keywords: ["norodom", "thong doc", "toan quyen", "phap", "1868", "dinh cu", "hermite", "lich su", "history", "french", "colonial"],
  }),
  entry({
    id: "k-bombing-1962",
    name_vi: "Vụ ném bom năm 1962 và quyết định xây dinh mới",
    name_en: "The 1962 bombing and the new palace",
    description_vi:
      "Ngày 27/02/1962, hai phi công Nguyễn Văn Cử và Phạm Phú Quốc ném bom làm dinh cũ hư hại nặng. Do không thể khôi phục, dinh cũ bị san bằng để xây dinh mới trên nền đất cũ.",
    description_en:
      "On 27 February 1962 pilots Nguyễn Văn Cử and Phạm Phú Quốc bombed the old palace, damaging it severely. It could not be restored, so it was levelled and the new palace built on the same site.",
    historical_context_vi:
      "Vì vậy công trình bạn thấy hôm nay không mang dấu vết của vụ ném bom 1962 — đó là dinh mới, khởi công ngày 01/7/1962.",
    historical_context_en:
      "So the building you see today does not bear marks of the 1962 bombing — it is the new palace, begun on 1 July 1962.",
    facts: ["bombing-1962", "rebuild-decision", "construction-start", "helipad-bomb-circles", "rooftop-uh1"],
    tour_stop_id: "stop-roof",
    floor: null,
    spatial_reference: "Sự kiện liên quan đến dinh cũ",
    confidence_status: "verified",
    keywords: ["1962", "nem bom", "bom", "phi cong", "nguyen van cu", "pham phu quoc", "bombing", "destroyed", "rebuild"],
  }),
  entry({
    id: "k-architect",
    name_vi: "Kiến trúc sư Ngô Viết Thụ và quá trình xây dựng",
    name_en: "Architect Ngô Viết Thụ and the construction",
    description_vi:
      "Dinh mới do Kiến trúc sư Ngô Viết Thụ – người Việt Nam đầu tiên đạt giải Khôi nguyên La Mã về kiến trúc – thiết kế; khởi công 01/7/1962, khánh thành 31/10/1966.",
    description_en:
      "The new palace was designed by Ngô Viết Thụ, the first Vietnamese to win the Grand Prix de Rome in architecture; begun 1 July 1962, inaugurated 31 October 1966.",
    historical_context_vi:
      "Trong lúc thi công, Ngô Đình Diệm bị lật đổ và qua đời ngày 02/11/1963. Lễ khánh thành do Nguyễn Văn Thiệu chủ trì; ông sống và làm việc tại đây từ tháng 10/1967 đến ngày 21/4/1975.",
    historical_context_en:
      "During construction Ngô Đình Diệm was overthrown and killed on 2 November 1963. Nguyễn Văn Thiệu presided over the inauguration and lived and worked here from October 1967 to 21 April 1975.",
    facts: ["architect", "construction-start", "inauguration", "diem-1963", "gia-long-temp", "thieu-residence"],
    tour_stop_id: "stop-facade",
    floor: "grounds",
    spatial_reference: "Mặt tiền chính",
    confidence_status: "verified",
    keywords: ["ngo viet thu", "kien truc su", "ai thiet ke", "thiet ke", "khoi nguyen la ma", "1966", "khanh thanh", "architect", "designed", "who designed", "built"],
  }),
  entry({
    id: "k-symbolism",
    name_vi: "Triết lý chữ Hán trong kiến trúc",
    name_en: "Chinese-character symbolism in the design",
    description_vi:
      "Mặt bằng tổng thể theo hình chữ CÁT (吉). Lầu thượng hình chữ KHẨU (口), cùng cột cờ tạo chữ TRUNG (中). Mái hiên, ban công tạo chữ TAM (三), nối nét sổ thành VƯƠNG (王), thêm kỳ đài thành CHỦ (主). Toàn bộ mặt tiền tạo thành chữ HƯNG (興).",
    description_en:
      "The plan follows CÁT (吉, good fortune). The rooftop pavilion is KHẨU (口); with the flagpole it becomes TRUNG (中). Eaves and balconies form TAM (三), with a vertical stroke VƯƠNG (王), with the flag platform CHỦ (主). The whole façade forms HƯNG (興, prosperity).",
    historical_context_vi:
      "Kiến trúc sư lấy ý tưởng từ triết lý phương Đông và bản sắc văn hóa dân tộc, kết hợp với kiến trúc hiện đại — giải thích vì sao Dinh có hình dáng như hiện nay.",
    historical_context_en:
      "The architect drew on Eastern philosophy and national identity, combined with modern architecture — which explains the palace's distinctive shape.",
    facts: ["style", "char-cat", "char-khau-trung", "char-tam-vuong-chu", "char-hung"],
    tour_stop_id: "stop-facade",
    floor: "grounds",
    spatial_reference: "Mặt tiền và lầu thượng",
    confidence_status: "verified",
    keywords: ["chu han", "chu cat", "chu hung", "chu trung", "chu khau", "chu tam", "y nghia", "hinh dang", "vi sao", "tai sao", "kien truc", "symbol", "shape", "why", "character", "meaning"],
  }),
  entry({
    id: "k-stone-curtain",
    name_vi: "Rèm hoa đá",
    name_en: "The stone curtain",
    description_vi:
      "Rèm hoa đá bao quanh tầng 2 mô phỏng đốt trúc, cách điệu từ “cửa bàn khoa” của cung điện Huế; vừa trang trí vừa điều hòa ánh sáng tự nhiên.",
    description_en:
      "The stone curtain around the 2nd floor imitates bamboo segments, stylised from the “bàn khoa” doors of Huế's palaces; it decorates and filters daylight.",
    historical_context_vi: "Đây là một chi tiết nhận diện nổi bật của mặt tiền Dinh.",
    historical_context_en: "It is one of the most recognisable details of the façade.",
    facts: ["stone-curtain"],
    tour_stop_id: "stop-facade",
    floor: "grounds",
    spatial_reference: "Mặt ngoài tầng 2",
    confidence_status: "verified",
    keywords: ["rem hoa da", "rem da", "dot truc", "truc", "ban khoa", "hue", "stone curtain", "bamboo", "facade"],
  }),
  entry({
    id: "k-lawn-pond",
    name_vi: "Thảm cỏ oval và hồ bán nguyệt",
    name_en: "Oval lawn and half-moon pond",
    description_vi:
      "Phía trước Dinh là thảm cỏ oval đường kính 102 m. Chạy dọc chiều ngang đại sảnh là hồ nước bán nguyệt thả sen và súng.",
    description_en:
      "In front of the palace is an oval lawn 102 m across. A half-moon pond with lotus and water lilies runs along the width of the main hall.",
    historical_context_vi:
      "Hồ nước gợi nhớ những hồ nước thanh bình ở đình, chùa cổ Việt Nam; thảm cỏ tạo cảm giác thoáng đãng khi nhìn về mặt tiền.",
    historical_context_en:
      "The pond recalls the calm ponds of old Vietnamese communal houses and pagodas; the lawn gives an open view toward the façade.",
    facts: ["lawn-oval", "pond-crescent", "garden"],
    tour_stop_id: "stop-lawn",
    floor: "grounds",
    spatial_reference: "Giữa cổng chính và mặt tiền",
    confidence_status: "verified",
    keywords: ["thảm cỏ", "tham co", "oval", "102", "ho nuoc", "ban nguyet", "sen", "lawn", "pond", "garden", "san vuon"],
  }),
  entry({
    id: "k-building",
    name_vi: "Khối nhà chính",
    name_en: "The main building",
    description_vi:
      "Khu nhà chính hình chữ T, diện tích mặt bằng 4.500 m², cao 26 m; gồm 3 tầng lầu, 2 gác lửng, sân thượng, tầng nền và tầng hầm; tổng diện tích sử dụng 20.000 m² với gần 100 phòng.",
    description_en:
      "The T-shaped main building has a 4,500 m² footprint and is 26 m tall, with 3 upper floors, 2 mezzanines, a rooftop terrace, a ground floor and a basement — 20,000 m² of usable space and nearly 100 rooms.",
    historical_context_vi: "Nội thất dùng đường nét thẳng, mạch lạc, thể hiện quan niệm “chính đại quang minh”; các phòng có tranh sơn mài, sơn dầu chủ đề “non sông cẩm tú”.",
    historical_context_en: "Interiors use straight, clear lines (“chính đại quang minh”); rooms hold lacquer and oil paintings on the theme of a beautiful homeland.",
    facts: ["building-size", "building-levels", "interior-lines", "artworks"],
    tour_stop_id: "stop-facade",
    floor: null,
    spatial_reference: "Toàn bộ khối nhà",
    confidence_status: "verified",
    keywords: ["bao nhieu phong", "so phong", "100 phong", "tang", "chieu cao", "26", "dien tich", "how many rooms", "floors", "height", "size"],
  }),
  entry({
    id: "k-credentials",
    name_vi: "Phòng Trình Quốc thư",
    name_en: "Credentials Presentation Room",
    description_vi:
      "Phòng Trình Quốc thư là trung tâm của Dinh theo mặt bằng hình chữ Cát. Phòng trưng bày bức sơn mài “Bình Ngô Đại Cáo” (8,20 m × 4,70 m) của họa sĩ Nguyễn Văn Minh.",
    description_en:
      "The Credentials Presentation Room is the centre of the palace's 吉-shaped plan. It displays the lacquer painting “Bình Ngô Đại Cáo” (8.20 m × 4.70 m) by Nguyễn Văn Minh.",
    historical_context_vi:
      "Như tên gọi, đây là không gian nghi lễ. Kích thước, vị trí cụ thể và đồ nội thất trong mô phỏng là ước lượng vì trang chính thức không công bố bản vẽ chi tiết.",
    historical_context_en:
      "As the name says, this is a ceremonial space. Its size, exact position and furnishing in this simulation are estimates, as no detailed drawings are published.",
    facts: ["center-credentials", "char-cat", "route-panels", "binh-ngo-painting", "binh-ngo-subject"],
    tour_stop_id: "stop-credentials",
    floor: "f2",
    spatial_reference: "Trung tâm mặt bằng, đặt ở tầng 2 trong mô phỏng (tầng là ước lượng)",
    confidence_status: "estimated",
    keywords: ["trinh quoc thu", "quoc thu", "dai su", "nghi le", "credentials", "ambassador", "ceremonial", "phong nay"],
  }),
  entry({
    id: "k-dai-yen",
    name_vi: "Phòng Đại yến",
    name_en: "State Banquet Room",
    description_vi: "Phòng Đại yến nằm bên trái sảnh lầu một. Phòng được trang trí bằng bức sơn dầu “Sơn Hà Cẩm Tú” của kiến trúc sư Ngô Viết Thụ.",
    description_en: "The Banquet Room is to the left of the entrance hall. It is decorated with the oil painting “Sơn Hà Cẩm Tú” by the architect Ngô Viết Thụ.",
    historical_context_vi: "Kiến trúc sư Ngô Viết Thụ hoàn thành bức tranh trong mười ngày để kịp lễ khánh thành Dinh ngày 31/10/1966; trong diễn văn khánh thành, ông gọi phòng này là “phòng ăn lớn”. Kích thước phòng và vị trí bàn ghế trong mô phỏng là ước lượng từ ảnh.",
    historical_context_en: "Ngô Viết Thụ finished the painting in ten days for the inauguration on 31 October 1966; in his inauguration speech he called this room “the large dining room”. The room size and furniture positions here are estimated from photos.",
    facts: ["layout-floor1", "son-ha-painting"],
    tour_stop_id: "stop-dai-yen",
    floor: "f1",
    spatial_reference: "Bên trái sảnh lầu một (theo trang chính thức)",
    confidence_status: "estimated",
    keywords: ["dai yen", "phong an", "yen tiec", "son ha cam tu", "banquet", "dining", "ngo viet thu tranh"],
  }),
  entry({
    id: "k-khanh-tiet",
    name_vi: "Phòng Khánh tiết",
    name_en: "Khánh tiết (Ceremonial) Room",
    description_vi: "Phòng Khánh tiết nằm phía sau cầu thang trung tâm. Ở phía đầu phòng treo bức tranh thủy mặc “Việt Nam Quốc Tổ” dài 5,6 m, ghép từ 8 tấm, của họa sĩ Trọng Nội.",
    description_en: "The Khánh tiết Room lies behind the central staircase. At the head of the room hangs the 5.6 m ink painting “Việt Nam Quốc Tổ” in 8 panels by Trọng Nội.",
    historical_context_vi: "Ngày 22/10/1966, họa sĩ Trọng Nội viết thư xin tặng tác phẩm cho Dinh và từ chối nhận thù lao. Tranh vẽ Quốc Tổ Hùng Vương cầm bút viết hai chữ “Văn Lang”. Kích thước phòng trong mô phỏng là ước lượng từ ảnh.",
    historical_context_en: "On 22 October 1966 Trọng Nội offered the work to the palace as a gift, declining any fee. It shows the Hùng King writing the words “Văn Lang”. The room size here is estimated from photos.",
    facts: ["layout-floor1", "quoc-to-painting", "quoc-to-gift"],
    tour_stop_id: "stop-khanh-tiet",
    floor: "f1",
    spatial_reference: "Phía sau cầu thang trung tâm (theo trang chính thức)",
    confidence_status: "estimated",
    keywords: ["khanh tiet", "quoc to", "hung vuong", "trong noi", "van lang", "ceremonial", "reception hall"],
  }),
  entry({
    id: "k-cabinet",
    name_vi: "Phòng họp Hội đồng Nội các",
    name_en: "Cabinet Meeting Room",
    description_vi:
      "Phòng họp Hội đồng Nội các là một trong những phòng tiêu biểu được giới thiệu trên trang chính thức của di tích.",
    description_en:
      "The Cabinet Meeting Room is one of the representative rooms presented on the site's official website.",
    historical_context_vi:
      "Tên phòng cho thấy đây là nơi họp của nội các. Minh Anh chưa có tư liệu đã xác minh về các cuộc họp cụ thể diễn ra tại đây, nên không kể chi tiết. Bố cục bàn ghế trong mô phỏng là minh họa.",
    historical_context_en:
      "The name indicates the cabinet met here. Minh Anh has no verified record of specific meetings, so she does not tell stories about them. The furniture here is illustrative.",
    facts: ["cabinet-room", "interior-lines"],
    tour_stop_id: "stop-cabinet",
    floor: "f1",
    spatial_reference: "Cánh trái tầng nền (vị trí trong mô phỏng là ước lượng)",
    confidence_status: "estimated",
    keywords: ["noi cac", "hoi dong", "phong hop", "hop", "cabinet", "meeting", "phong nay"],
  }),
  entry({
    id: "k-basement",
    name_vi: "Tầng hầm",
    name_en: "The basement",
    description_vi:
      "Tầng hầm của Dinh chịu được oanh kích của bom lớn và pháo. Công trình có các hệ thống phụ trợ hiện đại như điều hòa không khí, phòng chống cháy, thông tin liên lạc và nhà kho.",
    description_en:
      "The palace basement could withstand heavy bombs and artillery. The building had modern support systems — air conditioning, fire protection, communications and storage.",
    historical_context_vi:
      "Trong mô phỏng, các phòng tầng hầm chỉ được thể hiện khái quát; vị trí phòng và thiết bị không phải bản sao của hiện trạng.",
    historical_context_en:
      "In this simulation the basement rooms are only generalised; room positions and equipment are not a replica of the real layout.",
    facts: ["basement", "building-levels"],
    tour_stop_id: "stop-basement",
    floor: "basement",
    spatial_reference: "Tầng hầm (bố trí mô phỏng)",
    confidence_status: "verified",
    keywords: ["tang ham", "ham", "bunker", "basement", "bom", "phao", "thong tin lien lac", "chiu bom", "underground"],
  }),
  entry({
    id: "k-1975",
    name_vi: "Ngày 30/4/1975",
    name_en: "30 April 1975",
    description_vi:
      "10 giờ 45 phút ngày 30/4/1975, xe tăng 843 húc cổng phụ, xe tăng 390 húc tung cổng chính và tiến vào sân Dinh. 11 giờ 30 phút, Trung úy Bùi Quang Thận kéo lá cờ Mặt trận Dân tộc Giải phóng miền Nam Việt Nam lên nóc Dinh. Tổng thống Dương Văn Minh tuyên bố đầu hàng vô điều kiện.",
    description_en:
      "At 10:45 on 30 April 1975, tank 843 rammed the side gate and tank 390 smashed through the main gate into the courtyard. At 11:30, First Lieutenant Bùi Quang Thận raised the flag of the National Liberation Front of South Vietnam on the roof. President Dương Văn Minh announced unconditional surrender.",
    historical_context_vi:
      "Sự kiện đánh dấu thời khắc chấm dứt chiến tranh, thống nhất đất nước. Lưu ý: hai trang chính thức ghi khác nhau về số hiệu lữ đoàn của xe 843 (203 và 230).",
    historical_context_en:
      "The event marked the end of the war and the country's reunification. Note: two official pages differ on tank 843's brigade number (203 vs 230).",
    facts: ["tanks-1975", "tank-unit", "flag-1975", "surrender-1975", "reunification-conf"],
    tour_stop_id: "stop-roof",
    floor: "roof",
    spatial_reference: "Cổng chính, sân Dinh và nóc Dinh",
    confidence_status: "verified",
    keywords: ["30/4", "30 4", "1975", "xe tang", "843", "390", "bui quang than", "co", "duong van minh", "dau hang", "giai phong", "thong nhat", "tank", "flag", "surrender", "april"],
  }),
  entry({
    id: "k-f5e-1975",
    name_vi: "Vụ ném bom ngày 8/4/1975",
    name_en: "The bombing of 8 April 1975",
    description_vi:
      "Ngày 8/4/1975, máy bay F5E do Nguyễn Thành Trung lái, xuất phát từ Biên Hòa, ném bom vào Dinh nhưng gây hư hại không đáng kể.",
    description_en:
      "On 8 April 1975 an F-5E flown by Nguyễn Thành Trung from Biên Hòa bombed the palace, causing only minor damage.",
    historical_context_vi: "Sơ đồ tham quan chính thức có đánh dấu máy bay F5E trưng bày trong khuôn viên.",
    historical_context_en: "The official visitor map marks an F-5E on display in the grounds.",
    facts: ["f5e-1975", "outdoor-exhibits"],
    tour_stop_id: "stop-roof",
    floor: null,
    spatial_reference: "Khu trưng bày ngoài trời",
    confidence_status: "verified",
    keywords: ["f5e", "f-5e", "nguyen thanh trung", "8/4", "may bay", "aircraft", "plane", "jet"],
  }),
  entry({
    id: "k-grounds-features",
    name_vi: "Các công trình trong khuôn viên",
    name_en: "Other structures in the grounds",
    description_vi:
      "Khuôn viên còn có nhà bát giác đường kính 4 m ở góc Nguyễn Thị Minh Khai – Nam Kỳ Khởi Nghĩa, tòa nhà 2 tầng kiểu Pháp đang trưng bày “Từ Dinh Norodom đến Dinh Độc Lập”, 4 sân quần vợt phía sau và khu trưng bày xe tăng, máy bay F5E.",
    description_en:
      "The grounds also hold a 4 m octagonal pavilion at the Nguyễn Thị Minh Khai – Nam Kỳ Khởi Nghĩa corner, a two-storey French-style building with the exhibition “From Norodom Palace to Independence Palace”, four tennis courts at the back, and displays of tanks and an F-5E.",
    historical_context_vi: "Tòa nhà kiểu Pháp được xây cùng thời với Dinh Norodom.",
    historical_context_en: "The French-style building dates from the Norodom Palace era.",
    facts: ["octagon-house", "exhibition-house", "garden", "outdoor-exhibits"],
    tour_stop_id: null,
    floor: "grounds",
    spatial_reference: "Các góc khuôn viên",
    confidence_status: "verified",
    keywords: ["nha bat giac", "bat giac", "trung bay", "nha trung bay", "quan vot", "tennis", "octagon", "exhibition"],
  }),
  entry({
    id: "k-visiting",
    name_vi: "Tham quan Dinh Độc Lập ngoài đời thực",
    name_en: "Visiting the real palace",
    description_vi:
      "Du khách có thể tự tham quan qua hệ thống pano, bảng chỉ dẫn; thuê máy thuyết minh tự động 10 ngôn ngữ; đăng ký thuyết minh viên; hoặc đi xe điện quanh khuôn viên khoảng 10 phút.",
    description_en:
      "Visitors can explore on their own with panels and signs, rent a 10-language audio guide, book a human guide, or ride an electric shuttle around the grounds for about 10 minutes.",
    historical_context_vi: "Giờ mở cửa và giá vé có thể thay đổi — hãy kiểm tra trang dinhdoclap.gov.vn trước khi đến.",
    historical_context_en: "Opening hours and prices may change — check dinhdoclap.gov.vn before you go.",
    facts: ["visiting-today", "site-address"],
    tour_stop_id: null,
    floor: null,
    spatial_reference: "—",
    confidence_status: "verified",
    keywords: ["tham quan", "ve", "gio mo cua", "audio", "xe dien", "huong dan vien", "visit", "ticket", "opening", "hours"],
  }),
  entry({
    id: "k-pres-reception",
    name_vi: "Phòng Tiếp khách Tổng thống",
    name_en: "President's Reception Room",
    description_vi:
      "Phòng Tiếp khách Tổng thống ở tầng 2. Trong phòng có hai chiếc tủ sơn mài đỏ thẫm, bốn cánh tủ vẽ vàng đề tài “Mai – Lan” và “Cúc – Trúc” của trang trí gia Nguyễn Văn Triêm (1966–1967).",
    description_en:
      "The President's Reception Room is on floor 2. It holds two deep-red lacquer cabinets whose four doors are painted in gold with Plum–Orchid and Chrysanthemum–Bamboo by the decorator Nguyễn Văn Triêm (1966–1967).",
    historical_context_vi:
      "Bộ sofa bọc gấm vàng, thảm đỏ có chữ Thọ, khám gỗ với đôi ngà voi được dựng theo ảnh tham chiếu; vị trí và kích thước phòng là ước lượng; họa tiết trên cánh tủ trong mô phỏng là minh họa, không sao chép tác phẩm.",
    historical_context_en:
      "The gold damask sofas, the red carpet with the longevity character and the wood niche with elephant tusks follow the reference photos; the room's position and size are estimates; the cabinet painting here is illustrative, not a copy.",
    facts: ["pres-reception-cabinets", "pres-reception-chairs"],
    tour_stop_id: "stop-pres-reception",
    floor: "f2",
    spatial_reference: "Tầng 2 (theo trang chính thức); vị trí trong tầng là ước lượng",
    confidence_status: "estimated",
    keywords: ["tiep khach tong thong", "phong tiep khach", "tu son mai", "mai lan cuc truc", "nga voi", "reception room", "lacquer cabinet"],
  }),
];

export const KNOWLEDGE_BY_ID = new Map(KNOWLEDGE.map((k) => [k.id, k]));
