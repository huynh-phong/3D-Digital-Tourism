"use client";

import { DICTS } from "@/data/i18n";
import { useSettings } from "@/lib/store/settings";
import type { Lang, Localized } from "@/types";

export function useLang(): Lang {
  return useSettings((s) => s.lang);
}

export function useT() {
  return DICTS[useLang()];
}

export function loc(text: Localized, lang: Lang): string {
  return text[lang] ?? text.vi;
}
