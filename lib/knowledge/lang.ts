import type { Lang } from "@/types";

const VI_MARKS = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i;
const VI_WORDS = /\b(la|cua|nhung|khong|duoc|nay|trong|nam|nguoi|phong|dinh|ai|gi|sao|bao|nhieu|toi|ban)\b/i;
const EN_WORDS = /\b(the|what|who|when|where|why|how|is|are|was|were|did|does|can|this|room|palace|built|designed)\b/gi;

/**
 * Language the visitor is writing in: Vietnamese if the text carries Vietnamese
 * diacritics, English if it reads as English, otherwise the UI language
 * (short or ambiguous input, e.g. "1975?").
 */
export function questionLang(text: string, uiLang: Lang): Lang {
  if (VI_MARKS.test(text)) return "vi";
  const en = text.match(EN_WORDS)?.length ?? 0;
  if (en >= 2 || (en >= 1 && text.trim().split(/\s+/).length <= 4)) return "en";
  if (VI_WORDS.test(text)) return "vi"; // Vietnamese typed without accents
  return uiLang;
}
