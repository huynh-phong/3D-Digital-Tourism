import { describe, expect, it } from "vitest";
import { directSpeech, stripTags, tagFor } from "@/lib/server/expressive";

describe("Vietnamese voice direction", () => {
  it("tags only sentences that call for it", () => {
    expect(tagFor("Chào bạn, mình là Minh Anh.")).toBe("cheerfully");
    expect(tagFor("Bạn có biết vì sao mặt tiền có rèm hoa đá không?")).toBe("curious");
    expect(tagFor("Ngày 27/2/1962, dinh cũ bị ném bom.")).toBe("softly");
    expect(tagFor("Đây là Di tích quốc gia đặc biệt.")).toBe("excited");
    expect(tagFor("Công trình cao 26 mét.")).toBeNull();
    expect(tagFor("Khuôn viên rộng 120.000 mét vuông.")).toBeNull();
  });

  it("never changes the words, only prefixes a few tags", () => {
    const answer = "Chào bạn! Dinh do kiến trúc sư Ngô Viết Thụ thiết kế. Công trình cao 26 mét. Bạn muốn xem phòng nào trước?";
    const spoken = directSpeech(answer);
    expect(stripTags(spoken)).toBe(answer);
    const tags = spoken.match(/\[[a-z]+\]/g) ?? [];
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.length).toBeLessThanOrEqual(Math.ceil(4 / 2)); // at most every other sentence
  });

  it("does not repeat a tag on consecutive sentences or tag plain facts", () => {
    const spoken = directSpeech("Thật đặc biệt! Thật ấn tượng! Thật độc đáo!");
    expect((spoken.match(/\[excited\]/g) ?? []).length).toBe(1);
    expect(directSpeech("Công trình khánh thành năm 1966. Cao 26 mét.")).not.toMatch(/\[/);
  });

  it("removes stray directions so they are never read aloud", () => {
    expect(stripTags("[excited] Xin chào [whispers] bạn")).toBe("Xin chào bạn");
    expect(directSpeech("[laughs] Công trình cao 26 mét.")).toBe("Công trình cao 26 mét.");
  });
});
