"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/useMedia";
import { LANDMARKS } from "@/data/landmarks";
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
  const [leaving, setLeaving] = useState(false);
  const touch = useMediaQuery("(pointer: coarse)");

  const fetchCity = useCallback(() => {
    fetch("/data/city.json")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
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
    setLeaving(true);
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
              ref={scene}
              data={load.data}
              dark={dark}
              quality={quality}
              reducedMotion={reducedMotion}
              markerEls={markerEls}
              onReady={onReady}
            />
            <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-label={t.map.landmarks}>
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
                    style={{ visibility: "hidden" }}
                    className="group pointer-events-auto absolute left-0 top-0 flex flex-col items-center outline-none data-[far=true]:[&_.lbl]:hidden"
                    aria-label={`${loc(l.name, lang)} — ${available ? t.map.available : t.map.comingSoon}`}
                  >
                    <span
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[12px] font-semibold shadow-md transition-transform group-hover:scale-105 group-focus-visible:ring-2 ring-[var(--focus)] ${
                        available ? "border-transparent bg-accent text-on-accent" : "border-line bg-surface-solid text-fg"
                      } ${selected === l.id ? "scale-110 ring-2 ring-[var(--blue)]" : ""}`}
                    >
                      <Icon name="pin" size={13} />
                      <span className="lbl">{loc(l.name, lang)}</span>
                      {!available && <span className="lbl rounded-full bg-amber-soft px-1.5 text-[10px] text-amber">{t.map.comingSoon}</span>}
                    </span>
                    <span className={`h-5 w-0.5 ${available ? "bg-accent" : "bg-[var(--muted)]"}`} />
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
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-[var(--accent)]" />
                <p className="text-sm text-muted">{t.map.loadingCity}</p>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 sm:p-4">
        <div className="panel pointer-events-auto flex items-center gap-3 px-3 py-2">
          <Logo />
          <div className="leading-tight">
            <h1 className="whitespace-nowrap text-sm font-bold sm:text-base">{t.app.name}</h1>
            <p className="hidden text-xs text-muted sm:block">{t.app.tagline}</p>
          </div>
        </div>
        <div className="panel pointer-events-auto p-1.5">
          <TopControls onSettings={() => setSettingsOpen(true)} />
        </div>
      </header>

      {/* Landmark list */}
      <nav
        aria-label={t.map.landmarks}
        className="panel absolute left-3 top-[76px] z-20 w-[min(300px,calc(100vw-24px))] overflow-hidden sm:left-4 sm:top-24"
      >
        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold"
          aria-expanded={listOpen}
          onClick={() => setListOpen(!listOpen)}
        >
          <span className="flex items-center gap-2">
            <Icon name="pin" /> {t.map.landmarks}
          </span>
          <Icon name={listOpen ? "chevronUp" : "chevronDown"} />
        </button>
        <AnimatePresence initial={false}>
          {listOpen && (
            <motion.ul
              initial={{ height: 0 }}
              animate={{ height: "auto" }}
              exit={{ height: 0 }}
              className="scroll-thin max-h-[46vh] overflow-y-auto border-t border-line"
            >
              {LANDMARKS.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    onClick={() => select(l.id)}
                    className={`flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-sm hover:bg-accent-soft ${
                      selected === l.id ? "bg-accent-soft" : ""
                    }`}
                  >
                    <span>{loc(l.name, lang)}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        l.status === "available" ? "bg-accent text-on-accent" : "bg-amber-soft text-amber"
                      }`}
                    >
                      {l.status === "available" ? t.map.available : t.map.comingSoon}
                    </span>
                  </button>
                </li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </nav>

      {/* Selected landmark card */}
      <AnimatePresence>
        {sel && (
          <motion.aside
            key={sel.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="panel absolute bottom-24 right-3 z-20 w-[min(400px,calc(100vw-24px))] p-4 sm:bottom-24 sm:right-4"
            aria-live="polite"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <span
                  className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    sel.status === "available" ? "bg-accent text-on-accent" : "bg-amber-soft text-amber"
                  }`}
                >
                  {sel.status === "available" ? t.map.available : t.map.comingSoon}
                </span>
                <h2 className="text-lg font-bold">{loc(sel.name, lang)}</h2>
              </div>
              <IconButton icon="close" label={t.common.close} onClick={() => setSelected(null)} />
            </div>
            <p className="text-sm text-muted">{loc(sel.short, lang)}</p>
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
                <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[12px]">
                  <p className="mb-1.5 font-semibold">{t.map.controlsTitle}</p>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1">
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
                <div className="mt-3 flex items-center justify-between gap-2">
                  <StatusBadge status="verified" />
                  <Button variant="primary" size="lg" icon="arrowRight" onClick={startTour} disabled={leaving}>
                    {t.map.startTour}
                  </Button>
                </div>
              </>
            ) : (
              <p className="mt-3 rounded-xl bg-amber-soft p-3 text-[13px] text-fg">
                <Icon name="info" size={14} className="mr-1 inline text-amber" />
                {t.map.comingSoonBody}
              </p>
            )}
            <a
              className="mt-3 inline-flex items-center gap-1 text-[11px] text-muted underline-offset-2 hover:underline"
              href={`https://www.openstreetmap.org/${sel.osm}`}
              target="_blank"
              rel="noreferrer"
            >
              OSM {sel.osm} <Icon name="external" size={11} />
            </a>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Bottom bar */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex flex-wrap items-end justify-between gap-2 p-3 sm:p-4">
        <div className="panel pointer-events-auto max-w-[min(520px,100%)] px-3 py-2 text-[11px] text-muted">
          <p className="font-medium text-fg">{touch ? t.map.hintTouch : t.map.hint}</p>
          {built && (
            <p className="mt-1 hidden sm:block">
              <span className="mr-1 inline-block h-2 w-2 rounded-sm bg-[#e9c9a6]" /> {t.map.legendOsm} ({built.osmBuildings}) ·{" "}
              {t.map.legendGeneric} ({built.genericBuildings})
            </p>
          )}
          <p className="mt-1">
            {t.map.disclaimer}{" "}
            <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              © OpenStreetMap
            </a>{" "}
            ·{" "}
            <Link className="underline" href="/sources">
              {t.common.sources}
            </Link>
          </p>
        </div>
        <div className="pointer-events-auto flex gap-2">
          <Button icon="reset" onClick={() => { setSelected(null); scene.current?.reset(); }}>
            <span className="hidden sm:inline">{t.map.reset}</span>
          </Button>
          <Button variant="primary" icon="pin" onClick={() => select("dinh-doc-lap")}>
            {t.map.goDinh}
          </Button>
        </div>
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
            <p className="text-sm font-medium">{t.map.entering}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  );
}

export function Logo() {
  return (
    <svg width="34" height="34" viewBox="0 0 40 40" aria-hidden className="shrink-0">
      <rect width="40" height="40" rx="11" fill="var(--accent)" />
      <path d="M8 29h24M10 29V19h20v10M13 19v-4h14v4M18 15v-3h4v3M20 12V8" stroke="var(--accent-contrast)" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M12 23h16" stroke="var(--accent-contrast)" strokeWidth="1.4" strokeDasharray="1.5 1.5" />
    </svg>
  );
}
