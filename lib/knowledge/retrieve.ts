import { KNOWLEDGE } from "@/data/dinh/knowledge";
import { FACT_BY_ID } from "@/data/dinh/sources";
import { STOP_BY_ID, TOUR_STOPS } from "@/data/dinh/tour";
import type { KnowledgeEntry, Lang } from "@/types";

/** Lowercase, strip Vietnamese diacritics, collapse punctuation. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9/:\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOP = new Set(
  (
    "la cua va co nhung cac mot nay do the nao gi duoc khong toi ban minh o tai voi cho ve thi ma de khi nao dau sao vay a nhe " +
    "the a an of and is are was were what who why how where when this that to in on for it be do does did i you me can my " +
    // words shared by nearly every entry carry no signal
    "dinh doc lap palace independence"
  ).split(" "),
);

export function tokens(s: string): string[] {
  return fold(s)
    .split(" ")
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export interface Hit {
  entry: KnowledgeEntry;
  score: number;
}

/** Small lexical retriever — the archive is tiny, so this is enough and fully offline. */
export function retrieve(question: string, currentStopId?: string | null, limit = 4): Hit[] {
  const q = fold(question);
  const qt = new Set(tokens(question));
  const hits: Hit[] = KNOWLEDGE.map((entry) => {
    let score = 0;
    for (const k of entry.keywords) {
      const fk = fold(k);
      if (fk && q.includes(fk)) score += 3 + fk.split(" ").length;
    }
    const bag = new Set(
      tokens(
        [entry.name_vi, entry.name_en, entry.description_vi, entry.description_en, entry.historical_context_vi, entry.historical_context_en]
          .concat(entry.facts.map((id) => FACT_BY_ID.get(id)!.text.vi + " " + FACT_BY_ID.get(id)!.text.en))
          .join(" "),
      ),
    );
    // Token overlap as a share of the question, so long questions don't win by volume.
    let overlap = 0;
    for (const t of qt) if (bag.has(t)) overlap += 1;
    if (qt.size) score += (overlap / qt.size) * 4;
    if (currentStopId && entry.tour_stop_id === currentStopId) score += 1.5;
    return { entry, score };
  });
  return hits.filter((h) => h.score > 0).sort((a, b) => b.score - a.score).slice(0, limit);
}

export type Intent = "next_stop" | "free_explore" | "this_place" | "general";

export function detectIntent(question: string): Intent {
  const q = fold(question);
  if (/(diem|cho|stop) (tiep theo|ke tiep|sau)|next stop|where (is|do i go) next|di dau tiep|tiep theo/.test(q)) return "next_stop";
  if (/tu do|free(ly)?|explore (on my own|freely)|khong theo tour|instead of the tour/.test(q)) return "free_explore";
  if (/phong nay|cho nay|o day|noi nay|this room|this place|here|dang dung/.test(q)) return "this_place";
  return "general";
}

export interface TourContext {
  currentStopId?: string | null;
  nextStopId?: string | null;
}

/** Deterministic answer used in demo mode and as a guard when the AI fails. */
export function composeOfflineAnswer(question: string, lang: Lang, ctx: TourContext): { answer: string; entries: KnowledgeEntry[] } {
  const intent = detectIntent(question);
  if (intent === "next_stop") {
    const next = ctx.nextStopId ? STOP_BY_ID.get(ctx.nextStopId) : undefined;
    if (!next) {
      return {
        answer: lang === "vi"
          ? "Bạn đã đi hết các điểm dừng trong hành trình. Bạn có thể tiếp tục tự do khám phá hoặc quay về bản đồ thành phố."
          : "You've visited every stop on the journey. Keep exploring freely or return to the city map.",
        entries: [],
      };
    }
    return {
      answer: lang === "vi"
        ? `Điểm tiếp theo là “${next.title.vi}”. Bấm “Dẫn đường” trong danh sách hành trình, mình sẽ đi trước dẫn bạn tới đó.`
        : `The next stop is “${next.title.en}”. Press “Guide me” in the journey list and I'll lead the way.`,
      entries: [],
    };
  }
  if (intent === "free_explore") {
    return {
      answer: lang === "vi"
        ? "Tất nhiên! Chọn “Tự do khám phá” ở menu tạm dừng (Esc). Bạn có thể đi đến mọi khu vực đã mở, nhấn F gần các điểm thông tin, và gọi mình bằng phím G khi cần."
        : "Of course! Choose “Free exploration” in the pause menu (Esc). Walk anywhere that's open, press F near info points, and call me with G whenever you like.",
      entries: [],
    };
  }

  let hits = retrieve(question, ctx.currentStopId);
  if (intent === "this_place" && ctx.currentStopId) {
    const stop = STOP_BY_ID.get(ctx.currentStopId);
    const local = stop ? KNOWLEDGE.filter((k) => stop.knowledge_ids.includes(k.id)) : [];
    if (local.length) hits = [{ entry: local[0], score: 99 }, ...hits.filter((h) => h.entry.id !== local[0].id)];
  }
  const top = hits[0];
  if (!top || top.score < 3.2) {
    return {
      answer: lang === "vi"
        ? "Mình chưa có thông tin đã được xác minh để trả lời câu này, nên không muốn đoán. Bạn có thể xem trang “Nguồn tư liệu” hoặc dinhdoclap.gov.vn để tìm hiểu thêm."
        : "I don't have verified information to answer that, so I won't guess. See the “Sources” page or dinhdoclap.gov.vn to learn more.",
      entries: [],
    };
  }
  const e = top.entry;
  const answer = lang === "vi" ? `${e.description_vi} ${e.historical_context_vi}` : `${e.description_en} ${e.historical_context_en}`;
  return { answer, entries: [e] };
}

export function nextStopAfter(completed: string[]): string | null {
  return TOUR_STOPS.find((s) => !completed.includes(s.id))?.id ?? null;
}
