"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { IconName } from "@/components/ui/Icon";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useVisitKey } from "@/lib/useVisitKey";
import { useMediaQuery } from "@/lib/useMedia";
import { loadCityData, mapView, useLoadProgress } from "@/lib/city/useCityBuild";
import { LANDMARKS, project } from "@/data/landmarks";
import { FACT_BY_ID } from "@/data/dinh/sources";
import { loc, useLang, useT } from "@/lib/i18n";
import { keyLabel, useSettings } from "@/lib/store/settings";
import type { CityData } from "@/lib/city/types";
import type { CityBuild } from "@/lib/city/buildCity";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton, StatusBadge } from "@/components/ui/primitives";
import { TopControls } from "@/components/ui/TopControls";
import { useReducedMotion, useResolvedTheme } from "@/components/ui/Providers";
import { SettingsDialog } from "@/components/ui/SettingsDialog";
import { WebGLGate } from "@/components/ui/WebGLGate";
import type { CitySceneHandle } from "./CityScene";

const CityScene = dynamic(() => import("./CityScene").then((m) => m.CityScene), { ssr: false });

type Load = { state: "loading" } | { state: "error" } | { state: "ready"; data: CityData };

export function HomeExperience() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const quality = useSettings((s) => s.quality);
  const keys = useSettings((s) => s.keys);
  const dark = useResolvedTheme() === "dark";
  const reducedMotion = useReducedMotion();
  const scene = useRef<CitySceneHandle>(null);
  const markerEls = useRef(new Map<string, HTMLElement>());
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [built, setBuilt] = useState<CityBuild["stats"] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const small = useMediaQuery("(max-width: 768px)");
  const [listPref, setListOpen] = useState<boolean | null>(null);
  const listOpen = listPref ?? !small;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hintOpen, setHintOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const visit = useVisitKey();
  // This page is kept alive (hidden) while the tour runs: clear transient
  // state when it's hidden so coming back never shows the "entering" veil.
  useLayoutEffect(() => () => setLeaving(false), []);
  const touch = useMediaQuery("(pointer: coarse)");

  const fetchCity = useCallback(() => {
    loadCityData()
      .then((data: CityData) => setLoad({ state: "ready", data }))
      .catch(() => setLoad({ state: "error" }));
  }, []);

  useEffect(() => {
    fetchCity();
    // Warm the tour route so the transition is quick.
    router.prefetch("/dinh-doc-lap");
  }, [fetchCity, router]);

  const select = useCallback((id: string) => {
    setSelected(id);
    void scene.current?.flyTo(id, id === "dinh-doc-lap");
  }, []);

  const startTour = async () => {
    if (leaving) return; // one tour session at a time
    setLeaving(true);
    mapView.returningFromTour = true;
    await scene.current?.dive();
    router.push("/dinh-doc-lap");
  };

  const sel = LANDMARKS.find((l) => l.id === selected) ?? null;
  const onReady = useCallback((s: CityBuild["stats"]) => setBuilt(s), []);

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-bg text-fg">
      <WebGLGate>
        {load.state === "ready" && (
          <div className="absolute inset-0">
            <CityScene
              key={visit}
              ref={scene}
              data={load.data}
              dark={dark}
              quality={quality}
              reducedMotion={reducedMotion}
              markerEls={markerEls}
              onReady={onReady}
            />
            <div className={`pointer-events-none absolute inset-0 isolate z-0 overflow-hidden transition-opacity ${built ? "opacity-100" : "opacity-0"}`} aria-label={t.map.landmarks}>
              {LANDMARKS.map((l) => {
                const available = l.status === "available";
                return (
                  <button
                    key={l.id}
                    ref={(el) => {
                      if (el) markerEls.current.set(l.id, el);
                      else markerEls.current.delete(l.id);
                    }}
                    type="button"
                    onClick={() => select(l.id)}
                    // data-mode (full | short | dot) is set every frame by the marker projector
                    data-selected={selected === l.id}
                    data-full-len={loc(l.name, lang).length}
                    data-short-len={loc(l.short, lang).length}
                    data-mode="full"
                    style={{ visibility: "hidden" }}
                    className="group pointer-events-auto absolute left-0 top-0 flex flex-col items-center outline-none data-[mode=dot]:[&_.lbl]:hidden data-[mode=full]:[&_.lbl-short]:hidden data-[mode=short]:[&_.lbl-full]:hidden"
                    aria-label={`${loc(l.name, lang)} — ${available ? t.map.available : t.map.comingSoon}`}
                    title={loc(l.name, lang)}
                  >
                    <span
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-ink px-2.5 py-1 text-[12px] font-bold shadow-[0_3px_0_var(--ink)] transition-colors group-hover:brightness-105 group-focus-visible:ring-2 ring-[var(--focus)] group-data-[mode=dot]:px-1 ${
                        available ? "bg-accent text-on-accent" : "bg-surface-solid text-fg"
                      } ${selected === l.id ? "bg-mustard text-fg ring-2 ring-[var(--mustard)]" : ""}`}
                    >
                      <Icon name={available ? "play" : "clock"} size={13} />
                      <span className="lbl lbl-full">{loc(l.name, lang)}</span>
                      <span className="lbl lbl-short">{loc(l.short, lang)}</span>
                      {!available && <span className="lbl lbl-full rounded-full bg-amber-soft px-1.5 text-[10px] text-fg">{t.map.comingSoon}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </WebGLGate>

      {/* Loading / error */}
      <AnimatePresence>
        {(load.state !== "ready" || !built) && (
          <motion.div
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-bg"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            role="status"
            aria-live="polite"
          >
            {load.state === "error" ? (
              <>
                <p className="max-w-sm text-center text-sm">{t.map.cityError}</p>
                <Button variant="primary" icon="reset" onClick={() => { setLoad({ state: "loading" }); fetchCity(); }}>
                  {t.common.retry}
                </Button>
              </>
            ) : (
              <>
                <LoadBar label={t.map.loadingCity} />
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header: brand (top-left) · language, theme, sound, settings (top-right) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2.5">
          <Logo />
          <div className="leading-tight">
            <h1 className="title-game whitespace-nowrap text-base sm:text-xl">{t.app.name}</h1>
            <p className="hidden text-xs font-medium text-muted sm:block">{t.app.tagline}</p>
          </div>
        </div>
        <div className="panel pointer-events-auto p-1.5">
          <TopControls onSettings={() => setSettingsOpen(true)} />
        </div>
      </header>

      {/* Landmark list (left sidebar) */}
      <AnimatePresence initial={false}>
        {listOpen && (
          <motion.nav
            aria-label={t.map.landmarks}
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.16 }}
            className="panel absolute left-3 top-[84px] z-20 w-[min(300px,calc(100vw-24px))] overflow-hidden sm:left-4 sm:top-[96px]"
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-4 py-2.5">
              <h2 className="title-game flex items-center gap-2 text-[15px]">
                <Icon name="pin" /> {t.map.landmarks}
              </h2>
              <IconButton icon="close" label={t.common.close} className="!h-8 !w-8" onClick={() => setListOpen(false)} />
            </div>
            <ul className="scroll-thin max-h-[min(46vh,420px)] overflow-y-auto p-2">
              {LANDMARKS.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => select(l.id)}
                    aria-current={selected === l.id}
                    className={`flex w-full items-center justify-between gap-2 rounded-[10px] border-2 px-3 py-2 text-left text-[13px] font-semibold transition-colors ${
                      selected === l.id ? "border-ink bg-mint" : "border-transparent hover:bg-surface-2"
                    }`}
                  >
                    <span>{loc(l.name, lang)}</span>
                    <span className={`chip ${l.status === "available" ? "bg-accent text-on-accent" : "bg-amber-soft text-fg"}`}>
                      {l.status === "available" ? t.map.available : t.map.comingSoon}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </motion.nav>
        )}
      </AnimatePresence>

      {/* Selected landmark card */}
      <AnimatePresence>
        {sel && (
          <motion.aside
            key={sel.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="panel absolute right-3 top-[84px] z-20 flex max-h-[calc(100dvh-200px)] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden sm:right-4 sm:top-[96px]"
            aria-live="polite"
          >
            <div className="flex items-start justify-between gap-2 border-b-2 border-ink bg-surface-2 px-4 py-3">
              <div>
                <span className={`chip mb-1.5 ${sel.status === "available" ? "bg-accent text-on-accent" : "bg-amber-soft text-fg"}`}>
                  {sel.status === "available" ? t.map.available : t.map.comingSoon}
                </span>
                <h2 className="title-game text-xl leading-tight">{loc(sel.name, lang)}</h2>
              </div>
              <IconButton icon="close" label={t.common.close} onClick={() => setSelected(null)} />
            </div>
            <div className="scroll-thin overflow-y-auto px-4 py-3">
              <p className="text-sm">{loc(sel.blurb, lang)}</p>
              <p className="mt-1.5 text-[11px] font-medium text-muted">
                {t.map.distance}: {(Math.hypot(...project(sel.lat, sel.lon)) / 1000).toFixed(1)} km
              </p>
              {sel.status === "available" ? (
                <>
                  <ul className="mt-3 space-y-1.5 text-[13px]">
                    {["architect", "inauguration", "building-size", "lawn-oval"].map((id) => (
                      <li key={id} className="flex gap-2">
                        <Icon name="check" size={14} className="mt-0.5 shrink-0 text-accent" />
                        <span>{FACT_BY_ID.get(id)!.text[lang]}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 rounded-[10px] border-2 border-ink bg-mint p-3 text-[12px]">
                    <p className="mb-1.5 font-bold">{t.map.controlsTitle}</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <span>
                        <span className="kbd">{keyLabel(keys.forward)}</span>
                        <span className="kbd">{keyLabel(keys.left)}</span>
                        <span className="kbd">{keyLabel(keys.back)}</span>
                        <span className="kbd">{keyLabel(keys.right)}</span> {t.controls.move}
                      </span>
                      <span>
                        <span className="kbd">{keyLabel(keys.run)}</span> {t.controls.run}
                      </span>
                      <span>
                        <span className="kbd">{keyLabel(keys.interact)}</span> {t.controls.interact}
                      </span>
                      <span>
                        <span className="kbd">{keyLabel(keys.camera)}</span> {t.controls.camera}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="mt-3 rounded-[10px] border-2 border-ink bg-amber-soft p-3 text-[13px] text-fg" role="status">
                    <Icon name="clock" size={14} className="mr-1 inline text-amber" />
                    {t.map.comingSoonBody}
                  </p>
                  <p className="mt-2 text-[11px] text-muted">{t.map.modelNote}</p>
                </>
              )}
              <div className="mt-3 flex flex-wrap gap-x-3">
                <a className="inline-flex items-center gap-1 text-[11px] text-muted underline-offset-2 hover:underline" href={sel.ref.url} target="_blank" rel="noreferrer">
                  <Icon name="image" size={11} /> {t.map.reference} ({sel.ref.label}) <Icon name="external" size={11} />
                </a>
                <a className="inline-flex items-center gap-1 text-[11px] text-muted underline-offset-2 hover:underline" href={`https://www.openstreetmap.org/${sel.osm}`} target="_blank" rel="noreferrer">
                  OSM {sel.osm} <Icon name="external" size={11} />
                </a>
              </div>
            </div>
            {sel.status === "available" && (
              <div className="flex items-center justify-between gap-2 border-t-2 border-ink bg-surface-2 px-4 py-3">
                <StatusBadge status="verified" />
                <Button variant="primary" size="lg" icon="arrowRight" onClick={startTour} disabled={leaving}>
                  {t.map.startTour}
                </Button>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Bottom: attribution (left) · toolbar (centre) */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 p-3 sm:p-4">
        <nav aria-label={t.map.toolbar} className="pointer-events-auto relative">
          {/* striped awning edge above the toolbar */}
          <div aria-hidden className="mx-3 h-3 rounded-t-[8px] border-2 border-b-0 border-ink bg-[repeating-linear-gradient(90deg,var(--accent)_0_18px,var(--surface)_18px_36px)]" />
          <div className="panel flex max-w-[calc(100vw-16px)] items-stretch gap-0.5 px-1.5 py-1.5 sm:gap-1 sm:px-2">
            <ToolButton icon="pin" label={t.map.landmarks} active={listOpen} onClick={() => setListOpen(!listOpen)} />
            <ToolButton icon="play" label={t.map.goDinh} accent onClick={() => select("dinh-doc-lap")} />
            <ToolButton icon="reset" label={t.map.reset} onClick={() => { setSelected(null); scene.current?.reset(); }} />
            <span aria-hidden className="mx-0.5 w-0.5 self-stretch rounded bg-[var(--border)] sm:mx-1" />
            <ToolLink icon="book" label={t.common.sources} href="/sources" />
            <ToolButton icon="help" label={t.common.help} active={hintOpen} onClick={() => setHintOpen(!hintOpen)} />
            <ToolButton icon="settings" label={t.common.settings} onClick={() => setSettingsOpen(true)} />
          </div>
        </nav>
        <AnimatePresence>
          {hintOpen && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              className="panel pointer-events-auto absolute bottom-[96px] max-w-[min(440px,calc(100vw-24px))] px-3.5 py-2.5 text-[12px] sm:bottom-[104px]"
              role="note"
            >
              <p className="font-bold">{touch ? t.map.hintTouch : t.map.hint}</p>
              {built && (
                <p className="mt-1 text-muted">
                  <span className="mr-1 inline-block h-2 w-2 rounded-sm border border-ink bg-[#e3cfae]" /> {t.map.legendOsm} ({built.osmBuildings}) · {t.map.legendGeneric} ({built.genericBuildings})
                </p>
              )}
              <p className="mt-1 text-muted">{t.map.disclaimer}</p>
            </motion.div>
          )}
        </AnimatePresence>
        <p className="pointer-events-auto absolute bottom-1 left-3 hidden rounded-md bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-1.5 text-[10px] text-muted lg:block">
          <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
        </p>
      </div>

      {/* Transition veil */}
      <AnimatePresence>
        {leaving && (
          <motion.div
            className="absolute inset-0 z-40 flex items-center justify-center bg-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: reducedMotion ? 0 : 0.9, duration: 0.6 }}
          >
            <p className="panel px-4 py-2.5 text-sm font-bold">{t.map.entering}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

/** Toolbar button: icon over a short label; `active` = its panel is open, `accent` = main action. */
function ToolButton({ icon, label, onClick, active, accent }: { icon: IconName; label: string; onClick: () => void; active?: boolean; accent?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      className={`flex w-[54px] flex-col items-center gap-0.5 rounded-[10px] border-2 px-0.5 py-1.5 text-[9.5px] font-bold leading-tight transition-colors sm:w-[84px] sm:px-1 sm:text-[10.5px] ${
        accent ? "border-ink bg-accent text-on-accent hover:bg-accent-strong" : active ? "border-ink bg-mint" : "border-transparent hover:bg-surface-2"
      }`}
    >
      <Icon name={icon} size={20} />
      <span className="line-clamp-2 text-center">{label}</span>
    </button>
  );
}

function ToolLink({ icon, label, href }: { icon: IconName; label: string; href: string }) {
  return (
    <Link href={href} title={label} className="flex w-[54px] flex-col items-center gap-0.5 rounded-[10px] border-2 border-transparent px-0.5 py-1.5 text-[9.5px] font-bold leading-tight hover:bg-surface-2 sm:w-[84px] sm:px-1 sm:text-[10.5px]">
      <Icon name={icon} size={20} />
      <span className="line-clamp-2 text-center">{label}</span>
    </Link>
  );
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="38" height="38" rx="10" fill="var(--accent)" stroke="var(--ink)" strokeWidth="2.5" />
      <path d="M8 29h24M10 29V19h20v10M13 19v-4h14v4M18 15v-3h4v3M20 12V8" stroke="var(--accent-contrast)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 23h16" stroke="var(--accent-contrast)" strokeWidth="1.4" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

/** Horizontal loading bar with the real share of the city loaded (download, then build). */
function LoadBar({ label }: { label: string }) {
  const p = Math.round(useLoadProgress() * 100);
  return (
    <div className="w-[min(420px,calc(100vw-32px))]">
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-sm font-semibold">{label}</p>
        <p className="title-game text-lg tabular-nums">{p}%</p>
      </div>
      <div
        className="h-5 overflow-hidden rounded-full border-2 border-ink bg-surface-solid p-[2px] shadow-[var(--shadow-btn)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={p}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200 ease-out" style={{ width: `${Math.max(3, p)}%` }} />
      </div>
    </div>
  );
}
