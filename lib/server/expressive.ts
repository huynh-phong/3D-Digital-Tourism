/**
 * Voice direction for Vietnamese speech (ElevenLabs v3 audio tags).
 *
 * Works on a COPY of the text that goes to TTS only — the answer shown on
 * screen is never touched, and the words are never changed: at most one tag is
 * put in front of a sentence. Tags are used sparingly:
 *
 *   greeting            → [cheerfully]
 *   question            → [curious]
 *   remarkable fact     → [excited]   (an exclamation, or "đặc biệt / độc đáo / nổi bật …")
 *   sad / painful event → [softly]    (bombing, death, war loss …)
 *
 * Everything else is read with the voice's normal intonation. No laughs,
 * sighs, whispers or sound effects are ever inserted.
 */
export type Tag = "cheerfully" | "curious" | "excited" | "softly";

const GREETING = /^(xin chào|chào (bạn|các bạn|mừng)|chào!?$|rất vui)/i;
const SAD = /(ném bom|bị bom|hy sinh|thiệt mạng|tử vong|qua đời|đau thương|mất mát|tàn phá|bị phá hủy|chiến tranh|lật đổ|đổ nát|tiếc)/i;
const NOTABLE = /(đặc biệt|độc đáo|nổi bật|tuyệt|ấn tượng|lớn nhất|đầu tiên|di tích quốc gia đặc biệt|khôi nguyên)/i;

/** The tag (if any) that suits a single sentence. */
export function tagFor(sentence: string): Tag | null {
  const s = sentence.trim();
  if (!s) return null;
  if (GREETING.test(s)) return "cheerfully";
  if (SAD.test(s)) return "softly";
  if (/\?\s*$/.test(s)) return "curious";
  if (/!\s*$/.test(s) || NOTABLE.test(s)) return "excited";
  return null;
}

/** Remove anything that looks like a voice direction, so it can never be spoken or doubled. */
export const stripTags = (text: string) => text.replace(/\[[^\]\n]{1,30}\]/g, "").replace(/\s{2,}/g, " ").trim();

/**
 * Text to send to TTS for one chunk (the narrator sends one sentence at a time,
 * so `text` is usually a single sentence). Within a longer chunk, a tag is
 * never repeated on consecutive sentences and at most every other sentence
 * gets one.
 */
export function directSpeech(text: string): string {
  const clean = stripTags(text);
  const sentences = clean.split(/(?<=[.!?…])\s+/);
  let last: Tag | null = null;
  let since = 2;
  return sentences
    .map((s) => {
      const tag = tagFor(s);
      since++;
      if (!tag || tag === last || since < 2) return s;
      last = tag;
      since = 0;
      return `[${tag}] ${s}`;
    })
    .join(" ");
}
