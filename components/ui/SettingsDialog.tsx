"use client";

import { useEffect, useState } from "react";
import { narrator } from "@/lib/audio/narrator";
import { useT } from "@/lib/i18n";
import { keyLabel, useSettings, type Action, type Quality, type VoiceMode } from "@/lib/store/settings";
import { Modal, Segmented, Slider, Toggle } from "./primitives";

const ACTIONS: Action[] = ["forward", "back", "left", "right", "run", "interact", "camera", "jump", "map", "help", "guide", "chat", "lock"];

export function SettingsBody() {
  const t = useT();
  const s = useSettings();
  const [binding, setBinding] = useState<Action | null>(null);
  const [conflict, setConflict] = useState(false);

  useEffect(() => {
    if (!binding) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code === "Escape") return setBinding(null);
      const ok = s.bindKey(binding, e.code);
      setConflict(!ok);
      if (ok) setBinding(null);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [binding, s]);

  const actionLabel: Record<Action, string> = {
    forward: `${t.controls.move} ↑`,
    back: `${t.controls.move} ↓`,
    left: `${t.controls.move} ←`,
    right: `${t.controls.move} →`,
    run: t.controls.run,
    interact: t.controls.interact,
    camera: t.controls.camera,
    jump: t.controls.jump,
    map: t.controls.map,
    help: t.controls.help,
    guide: t.controls.guide,
    chat: t.controls.chat,
    lock: t.controls.lock,
  };

  return (
    <div className="space-y-5 text-sm">
      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t.common.language} · {t.common.theme}</h3>
        <div className="flex flex-wrap gap-2">
          <Segmented label={t.common.language} value={s.lang} onChange={(lang) => s.set({ lang })} options={[{ value: "vi", label: "Tiếng Việt" }, { value: "en", label: "English" }]} />
          <Segmented
            label={t.common.theme}
            value={s.theme}
            onChange={(theme) => s.set({ theme })}
            options={[
              { value: "light", label: t.common.themeLight },
              { value: "dark", label: t.common.themeDark },
              { value: "system", label: t.common.themeSystem },
            ]}
          />
        </div>
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t.settings.audio}</h3>
        <Toggle label={t.guide.voice} checked={s.voiceEnabled} onChange={(v) => { if (!v) narrator?.stop(); s.set({ voiceEnabled: v }); }} />
        <div className="py-1.5">
          <Segmented<VoiceMode>
            label={t.guide.voice}
            value={s.voiceMode}
            onChange={(voiceMode) => s.set({ voiceMode })}
            options={[
              { value: "cloud", label: t.guide.voiceCloud },
              { value: "none", label: t.guide.voiceNone },
            ]}
          />
        </div>
        <Slider label={t.guide.volume} value={s.volume} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)}%`} onChange={(volume) => { s.set({ volume }); narrator?.applySettings(); }} />
        <Slider label={t.guide.rate} value={s.rate} min={0.75} max={1.5} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(rate) => { s.set({ rate }); narrator?.applySettings(); }} />
        <Toggle label={t.guide.subtitles} checked={s.subtitles} onChange={(subtitles) => s.set({ subtitles })} />
        <Toggle label={t.settings.autoNarrate} checked={s.autoNarrate} onChange={(autoNarrate) => s.set({ autoNarrate })} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t.settings.graphics}</h3>
        <Segmented<Quality>
          label={t.settings.quality}
          value={s.quality}
          onChange={(quality) => s.set({ quality })}
          options={[
            { value: "low", label: t.settings.qualityLow },
            { value: "medium", label: t.settings.qualityMedium },
            { value: "high", label: t.settings.qualityHigh },
          ]}
        />
        <Slider label={t.settings.sensitivity} value={s.sensitivity} min={0.25} max={2} step={0.05} format={(v) => `${v.toFixed(2)}×`} onChange={(sensitivity) => s.set({ sensitivity })} />
        <Toggle label={t.settings.invertY} checked={s.invertY} onChange={(invertY) => s.set({ invertY })} />
      </section>

      <section>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{t.settings.accessibility}</h3>
        <Toggle
          label={t.settings.reducedMotion}
          checked={s.reducedMotion ?? (typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches)}
          onChange={(v) => s.set({ reducedMotion: v })}
        />
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{t.settings.controls}</h3>
          <button type="button" className="text-xs underline" onClick={() => s.resetKeys()}>
            {t.controls.reset}
          </button>
        </div>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {ACTIONS.map((a) => (
            <li key={a} className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5">
              <span>{actionLabel[a]}</span>
              <button
                type="button"
                className={`kbd min-w-14 ${binding === a ? "ring-2 ring-[var(--focus)]" : ""}`}
                onClick={() => { setConflict(false); setBinding(a); }}
                aria-label={`${t.controls.remap}: ${actionLabel[a]}`}
              >
                {binding === a ? "…" : keyLabel(s.keys[a])}
              </button>
            </li>
          ))}
          <li className="flex items-center justify-between rounded-lg border border-line px-2.5 py-1.5 opacity-70">
            <span>{t.controls.pause}</span>
            <span className="kbd">Esc</span>
          </li>
        </ul>
        {binding && <p className="mt-2 text-xs text-muted">{t.controls.pressKey}</p>}
        {conflict && <p className="mt-1 text-xs text-danger">{t.controls.conflict}</p>}
      </section>
    </div>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  return (
    <Modal open={open} onClose={onClose} title={t.common.settings} wide>
      <SettingsBody />
    </Modal>
  );
}
