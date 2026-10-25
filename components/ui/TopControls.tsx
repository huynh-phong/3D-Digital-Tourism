"use client";

import { useT } from "@/lib/i18n";
import { useSettings, type ThemePref } from "@/lib/store/settings";
import { narrator } from "@/lib/audio/narrator";
import { IconButton } from "./primitives";

/** Language · theme · sound · settings — the top-right cluster on every screen. */
export function TopControls({ onSettings, onHelp }: { onSettings?: () => void; onHelp?: () => void }) {
  const t = useT();
  const { lang, theme, voiceEnabled, set } = useSettings();
  const nextTheme: Record<ThemePref, ThemePref> = { light: "dark", dark: "system", system: "light" };
  const themeIcon = theme === "light" ? "sun" : theme === "dark" ? "moon" : "monitor";
  const themeLabel = `${t.common.theme}: ${theme === "light" ? t.common.themeLight : theme === "dark" ? t.common.themeDark : t.common.themeSystem}`;

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => set({ lang: lang === "vi" ? "en" : "vi" })}
        className="inline-flex h-10 items-center gap-1 rounded-xl border border-line bg-surface-2 px-3 text-xs font-bold hover:bg-accent-soft"
        aria-label={`${t.common.language}: ${lang === "vi" ? "Tiếng Việt" : "English"}`}
        title={t.common.language}
      >
        <span className={lang === "vi" ? "text-accent" : "text-muted"}>VI</span>
        <span className="text-muted">/</span>
        <span className={lang === "en" ? "text-accent" : "text-muted"}>EN</span>
      </button>
      <IconButton icon={themeIcon} label={themeLabel} onClick={() => set({ theme: nextTheme[theme] })} />
      <IconButton
        icon={voiceEnabled ? "volume" : "mute"}
        label={`${t.guide.voice}: ${voiceEnabled ? t.common.on : t.common.off}`}
        onClick={() => {
          if (voiceEnabled) narrator?.stop();
          set({ voiceEnabled: !voiceEnabled });
        }}
      />
      {onHelp && <IconButton icon="help" label={t.common.help} onClick={onHelp} />}
      {onSettings && <IconButton icon="settings" label={t.common.settings} onClick={onSettings} />}
    </div>
  );
}
