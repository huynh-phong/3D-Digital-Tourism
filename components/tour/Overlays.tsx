"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/lib/i18n";
import { runtime, useGame, useProgress } from "@/lib/store/game";
import { keyLabel, useSettings } from "@/lib/store/settings";
import { setMode } from "@/lib/tour/director";
import { narrator } from "@/lib/audio/narrator";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton } from "@/components/ui/primitives";
import { SettingsBody } from "@/components/ui/SettingsDialog";
import { GuideAvatar } from "@/components/guide/GuideCard";

export function ModeChooser({ onStart }: { onStart: () => void }) {
  const t = useT();
  const phase = useGame((s) => s.phase);
  const completed = useProgress((s) => s.completed);
  return (
    <AnimatePresence>
      {phase === "choose" && (
        <motion.div className="pointer-events-auto absolute inset-0 z-40 flex items-end justify-center bg-[rgba(43,36,29,0.3)] p-4 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="panel panel-modal w-full max-w-xl p-5" initial={{ y: 20 }} animate={{ y: 0 }} role="dialog" aria-label={t.tour.chooseMode}>
            <div className="mb-3 flex items-center gap-3">
              <GuideAvatar speaking={false} />
              <div>
                <p className="title-game text-xl">{t.tour.chooseMode}</p>
                <p className="text-xs text-muted">{t.guide.name} · {t.guide.role}</p>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["guided", "free"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  autoFocus={m === "guided"}
                  onClick={() => {
                    setMode(m);
                    onStart();
                  }}
                  className={`btn-game p-4 text-left ${m === "guided" ? "bg-accent text-on-accent hover:bg-accent-strong [&_.desc]:text-on-accent/85" : "bg-surface-solid hover:bg-mint"}`}
                >
                  <span className="mb-1 flex items-center gap-2 text-[15px] font-extrabold">
                    <Icon name={m === "guided" ? "user" : "map"} /> {m === "guided" ? t.tour.guided : t.tour.free}
                  </span>
                  <span className={`desc text-[13px] ${m === "guided" ? "" : "text-muted"}`}>{m === "guided" ? t.tour.modeGuidedDesc : t.tour.modeFreeDesc}</span>
                </button>
              ))}
            </div>
            {completed.length > 0 && (
              <button type="button" className="mt-3 text-xs text-muted underline" onClick={() => useProgress.getState().reset()}>
                {t.tour.progress}: {completed.length} · {t.controls.reset}
              </button>
            )}
            <ControlsGrid />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function ControlsGrid({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const k = useSettings((s) => s.keys);
  const rows: [string, string][] = [
    [`${keyLabel(k.forward)} ${keyLabel(k.left)} ${keyLabel(k.back)} ${keyLabel(k.right)}`, t.controls.move],
    [compact ? "🖱" : "Mouse", t.controls.look],
    [keyLabel(k.lock), t.controls.lock],
    [keyLabel(k.run), t.controls.run],
    [keyLabel(k.interact), t.controls.interact],
    [keyLabel(k.camera), t.controls.camera],
    [keyLabel(k.jump), t.controls.jump],
    [keyLabel(k.map), t.controls.map],
    [keyLabel(k.guide), t.controls.guide],
    [keyLabel(k.chat), t.controls.chat],
    [keyLabel(k.help), t.controls.help],
    ["Esc", t.controls.pause],
  ];
  return (
    <ul className={`grid gap-x-3 gap-y-1 ${compact ? "mt-1.5 grid-cols-2 text-[11px]" : "mt-3 grid-cols-2 text-[12px]"}`}>
      {rows.map(([key, label]) => (
        <li key={label} className="flex items-center gap-2">
          <span className="flex gap-0.5">{key.split(" ").map((x, i) => <span key={i} className="kbd">{x}</span>)}</span>
          <span className="text-muted">{label}</span>
        </li>
      ))}
    </ul>
  );
}

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const phase = useGame((s) => s.phase);
  return (
    <AnimatePresence>
      {phase === "paused" && (
        <motion.div className="pointer-events-auto absolute inset-0 z-40 flex items-center justify-center bg-[rgba(43,36,29,0.42)] p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <PauseBody onResume={onResume} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Mounted fresh on every pause, so it always opens on the main tab. */
function PauseBody({ onResume }: { onResume: () => void }) {
  const t = useT();
  const mode = useGame((s) => s.mode);
  const [tab, setTab] = useState<"menu" | "settings" | "help">("menu");
  return (
    <div className="panel panel-modal flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden" role="dialog" aria-label={t.tour.paused}>
      <div className="flex items-center gap-2 border-b-2 border-ink px-5 py-3.5">
        <h2 className="title-game flex-1 text-2xl">{t.tour.paused}</h2>
        <IconButton icon="close" label={t.tour.resume} onClick={onResume} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
      <nav aria-label={t.tour.paused} className="flex shrink-0 gap-1.5 border-b-2 border-ink p-3 sm:w-48 sm:flex-col sm:border-b-0 sm:border-r-2">
        {(["menu", "settings", "help"] as const).map((x) => (
          <button
            key={x}
            type="button"
            onClick={() => setTab(x)}
            aria-current={tab === x}
            className={`rounded-[10px] border-2 px-3 py-2 text-left text-sm font-bold ${tab === x ? "border-ink bg-accent text-on-accent shadow-[var(--shadow-btn)]" : "border-transparent hover:bg-surface-2"}`}
          >
            {x === "menu" ? t.tour.paused : x === "settings" ? t.common.settings : t.common.help}
          </button>
        ))}
      </nav>
      <div className="scroll-thin min-h-0 flex-1 overflow-y-auto p-4">
        {tab === "menu" && (
          <div className="grid gap-2">
            <Button variant="primary" size="lg" icon="play" onClick={onResume} autoFocus>{t.tour.resume}</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button icon="user" variant={mode === "guided" ? "primary" : "soft"} onClick={() => setMode("guided")}>{t.tour.guided}</Button>
              <Button icon="map" variant={mode === "free" ? "primary" : "soft"} onClick={() => setMode("free")}>{t.tour.free}</Button>
            </div>
            <Button icon="layers" onClick={() => useGame.setState({ mapOpen: true })}>{t.tour.floorMap}</Button>
            <Button icon="reset" onClick={() => { narrator?.stop(); useGame.getState().restart(); }}>{t.tour.restart}</Button>
            <Link href="/" onClick={() => narrator?.stop()} className="btn-game inline-flex h-12 items-center justify-center gap-2 bg-surface-solid text-sm font-bold hover:bg-mint">
              <Icon name="home" /> {t.tour.backToMap}
            </Link>
            <Link href="/sources" className="text-center text-xs text-muted underline">{t.common.sources}</Link>
          </div>
        )}
        {tab === "settings" && <SettingsBody />}
        {tab === "help" && <ControlsGrid />}
      </div>
      </div>
    </div>
  );
}

/** Virtual joystick + buttons for touch devices. */
export function TouchControls({ onInteract, onCamera }: { onInteract: () => void; onCamera: () => void }) {
  const t = useT();
  const base = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(false);
  useEffect(() => {
    runtime.input.run = run;
  }, [run]);
  useEffect(() => {
    const el = base.current;
    if (!el) return;
    let id: number | null = null;
    const R = 46;
    const set = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
      runtime.input.x = dx / R;
      runtime.input.y = -dy / R;
      if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const down = (e: PointerEvent) => { id = e.pointerId; el.setPointerCapture(e.pointerId); set(e); };
    const move = (e: PointerEvent) => { if (e.pointerId === id) set(e); };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = null;
      runtime.input.x = runtime.input.y = 0;
      if (knob.current) knob.current.style.transform = "translate(0,0)";
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, []);
  return (
    <>
      <div ref={base} className="pointer-events-auto absolute bottom-6 left-6 z-30 h-28 w-28 touch-none rounded-full border border-line bg-surface" aria-label={t.controls.move} role="application">
        <div ref={knob} className="absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full bg-accent/80 shadow" />
      </div>
      <div className="pointer-events-auto absolute bottom-40 right-4 z-30 flex flex-col gap-2">
        <button type="button" onClick={onInteract} className="h-14 w-14 rounded-full bg-accent text-sm font-bold text-on-accent shadow" aria-label={t.controls.interact}>E</button>
        <button type="button" onClick={() => setRun((v) => !v)} aria-pressed={run} className={`h-12 w-12 rounded-full border border-line text-[11px] font-semibold shadow ${run ? "bg-blue text-white" : "bg-surface-solid"}`} aria-label={t.controls.run}>{t.controls.run}</button>
        <button type="button" onClick={onCamera} className="h-12 w-12 rounded-full border border-line bg-surface-solid shadow" aria-label={t.controls.camera}><Icon name="camera" className="mx-auto" /></button>
        <button type="button" onClick={() => (runtime.input.jump = true)} className="h-12 w-12 rounded-full border border-line bg-surface-solid text-[11px] font-semibold shadow" aria-label={t.controls.jump}>↥</button>
      </div>
    </>
  );
}
