import { describe, expect, it } from "vitest";
import { FACT_BY_ID, FACTS, SOURCE_BY_ID } from "@/data/dinh/sources";
import { KNOWLEDGE, KNOWLEDGE_BY_ID } from "@/data/dinh/knowledge";
import { INTERACTABLES, TOUR_STOPS } from "@/data/dinh/tour";
import { DICTS } from "@/data/i18n";
import { composeOfflineAnswer, detectIntent, fold, retrieve } from "@/lib/knowledge/retrieve";

describe("knowledge base integrity", () => {
  it("every fact cites known sources", () => {
    for (const f of FACTS) {
      expect(f.source_ids.length).toBeGreaterThan(0);
      for (const s of f.source_ids) expect(SOURCE_BY_ID.has(s), `${f.id} -> ${s}`).toBe(true);
      expect(f.text.vi.length).toBeGreaterThan(10);
      expect(f.text.en.length).toBeGreaterThan(10);
    }
  });

  it("conflicting facts explain the conflict", () => {
    for (const f of FACTS.filter((x) => x.confidence_status === "conflicting")) expect(f.note?.vi && f.note?.en).toBeTruthy();
  });

  it("knowledge entries reference existing facts and have sources", () => {
    for (const k of KNOWLEDGE) {
      for (const id of k.facts) expect(FACT_BY_ID.has(id), `${k.id} -> ${id}`).toBe(true);
      expect(k.source_urls.length).toBeGreaterThan(0);
    }
  });

  it("tour stops and interactables reference existing knowledge", () => {
    for (const s of TOUR_STOPS) {
      for (const k of s.knowledge_ids) expect(KNOWLEDGE_BY_ID.has(k), `${s.id} -> ${k}`).toBe(true);
      for (const t of s.timeline) expect(FACT_BY_ID.has(t.fact_id)).toBe(true);
      for (const lang of ["vi", "en"] as const) {
        expect(s.narration.quick[lang].length).toBeGreaterThan(40);
        expect(s.narration.main[lang].length).toBeGreaterThan(300);
        expect(s.narration.deep[lang].length).toBeGreaterThan(40);
      }
    }
    for (const i of INTERACTABLES) expect(KNOWLEDGE_BY_ID.has(i.knowledge_id)).toBe(true);
  });

  it("stops are ordered 1..n", () => {
    expect(TOUR_STOPS.map((s) => s.order)).toEqual(TOUR_STOPS.map((_, i) => i + 1));
  });
});

describe("i18n", () => {
  const keys = (o: unknown, p = ""): string[] =>
    typeof o === "object" && o && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, p + k + ".")) : [p];

  it("vi and en have the same keys", () => {
    expect(keys(DICTS.en).sort()).toEqual(keys(DICTS.vi).sort());
  });
});

describe("retrieval", () => {
  it("folds Vietnamese diacritics", () => {
    expect(fold("Ngô Viết Thụ – Đà Nẵng")).toBe("ngo viet thu da nang");
  });

  it.each([
    ["Ai thiết kế Dinh Độc Lập?", "k-architect"],
    ["Who designed the palace?", "k-architect"],
    ["Điều gì xảy ra tại đây ngày 30/4/1975?", "k-1975"],
    ["Vì sao kiến trúc có hình dáng này?", "k-symbolism"],
    ["Tầng hầm dùng để làm gì?", "k-basement"],
    ["Rèm hoa đá là gì?", "k-stone-curtain"],
  ])("%s -> %s", (q, id) => {
    expect(retrieve(q)[0]?.entry.id).toBe(id);
  });

  it("detects navigation intents", () => {
    expect(detectIntent("Điểm tiếp theo của hành trình nằm ở đâu?")).toBe("next_stop");
    expect(detectIntent("Tôi có thể tự do khám phá thay vì theo tour không?")).toBe("free_explore");
    expect(detectIntent("Phòng này được dùng để làm gì?")).toBe("this_place");
  });

  it("admits when there is no verified answer", () => {
    const a = composeOfflineAnswer("Tổng thống thích ăn món gì nhất?", "vi", {});
    expect(a.entries).toHaveLength(0);
    expect(a.answer).toMatch(/chưa có thông tin đã được xác minh/);
  });

  it("answers 'this room' from the current stop", () => {
    const a = composeOfflineAnswer("Phòng này được dùng để làm gì?", "en", { currentStopId: "stop-cabinet" });
    expect(a.entries[0]?.id).toBe("k-cabinet");
  });

  it("points to the next stop", () => {
    const a = composeOfflineAnswer("Where is the next stop?", "en", { nextStopId: "stop-basement" });
    expect(a.answer).toContain("The basement");
  });
});
