"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { loc, useLang, useT } from "@/lib/i18n";
import { usePointerLock, lockPointer, pointerLockSupported } from "@/lib/game/pointer";
import { useGame } from "@/lib/store/game";
import { keyLabel, useSettings } from "@/lib/store/settings";
import { DEST_BY_KEY } from "@/lib/tour/destinations";
import { askGuideToLead, cancelNavigation, continueTour, navigateTo } from "@/lib/tour/director";
import { Icon } from "@/components/ui/Icon";
import type { Turn } from "@/lib/dinh/route";

const TURN_ARROW: Record<Turn, string> = { straight: "↑", left: "↰", right: "↱", back: "↓", up: "⇡", down: "⇣" };

/** Destination card: name, distance, next instruction, guide / cancel actions. */
export function NavCard() {
  const t = useT();
  const lang = useLang();
  const destination = useGame((s) => s.destination);
  const status = useGame((s) => s.navStatus);
  const distance = useGame((s) => s.navDistance);
  const turn = useGame((s) => s.navTurn);
  const exact = useGame((s) => s.navExact);
  const hint = useGame((s) => s.navHint);
  const mode = useGame((s) => s.mode);
  const leading = useGame((s) => s.guideLeading);
  const targetStopId = useGame((s) => s.targetStopId);
  const d = destination ? DEST_BY_KEY.get(destination) : undefined;

  // In free exploration an arrival card tidies itself away after a few seconds.
  useEffect(() => {
    if (status !== "arrived" || mode !== "free") return;
    const id = setTimeout(() => cancelNavigation(), 6000);
    return () => clearTimeout(id);
  }, [status, mode]);

  const detour = mode === "guided" && d && d.kind !== "stop";
  return (
    <AnimatePresence>
      {d && (
        <motion.div
          key={d.key}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="panel pointer-events-auto flex max-w-[min(440px,calc(100vw-24px))] items-center gap-3 px-3 py-2"
          role="status"
          aria-live="polite"
        >
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg font-bold ${status === "arrived" ? "bg-accent text-on-accent" : status === "noPath" ? "bg-surface-2 text-amber" : "text-fg"}`}
            style={status === "active" ? { background: "rgba(47, 211, 234, 0.22)" } : undefined}
            aria-hidden
          >
            {status === "arrived" ? "✓" : status === "noPath" ? "!" : TURN_ARROW[turn]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-wide text-muted">
              {status === "arrived" ? t.nav.arrived : leading ? t.nav.guideLeading : t.nav.navigating}
            </p>
            <p className="truncate text-[13.5px] font-semibold">{loc(d.title, lang)}</p>
            {status === "active" && (
              <p className="text-[12px] text-muted">
                <span className="font-semibold text-fg">{t.nav.turns[turn]}</span> · ~{distance} m
                {!exact && <span className="block text-[11px]">{t.nav.inexact}</span>}
              </p>
            )}
            {status === "noPath" && (
              <p className="text-[12px] text-amber">
                {t.nav.noPath}
                {hint && DEST_BY_KEY.get(hint) && (
                  <button type="button" className="ml-1 underline" onClick={() => navigateTo(hint)}>
                    {t.nav.nearest}: {loc(DEST_BY_KEY.get(hint)!.title, lang)}
                  </button>
                )}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-1">
            {mode === "free" && !leading && status === "active" && (
              <button type="button" onClick={askGuideToLead} className="rounded-lg bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-on-accent">
                {t.nav.askGuide}
              </button>
            )}
            {detour && status === "arrived" && (
              <button type="button" onClick={continueTour} className="rounded-lg bg-accent px-2.5 py-1 text-[11.5px] font-semibold text-on-accent">
                {t.nav.resumeTour}
              </button>
            )}
            {!(mode === "guided" && d.kind === "stop" && d.id === targetStopId && status === "arrived") && (
              <button type="button" onClick={cancelNavigation} className="rounded-lg border border-line px-2.5 py-1 text-[11.5px] font-medium hover:bg-accent-soft" aria-label={t.nav.cancel}>
                <Icon name="close" size={13} className="mr-1 inline" />
                {t.nav.cancel}
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Mouse-look status: locked (with how to leave), or how to take control. */
export function PointerChip({ canvas }: { canvas: React.RefObject<HTMLCanvasElement | null> }) {
  const t = useT();
  const locked = usePointerLock((s) => s.locked);
  const error = usePointerLock((s) => s.error);
  const key = useSettings((s) => s.keys.lock);
  const modal = useGame((s) => s.mapOpen || s.phase !== "playing");
  if (modal || typeof document === "undefined" || !pointerLockSupported()) return null;
  if (error && !locked) {
    return <p className="panel max-w-[360px] px-3 py-1.5 text-[11.5px] text-amber" role="status">{t.pointer.error}</p>;
  }
  return locked ? (
    <p className="rounded-full bg-black/45 px-3 py-1 text-[11.5px] text-white backdrop-blur" role="status">
      <Icon name="camera" size={12} className="mr-1 inline" />
      {t.pointer.locked} · {t.pointer.escHint}
    </p>
  ) : (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        lockPointer(canvas.current);
      }}
      className="panel pointer-events-auto flex items-center gap-2 px-3 py-1.5 text-[11.5px]"
    >
      <Icon name="camera" size={13} />
      <span className="font-semibold">{t.pointer.start}</span>
      <span className="text-muted">{t.pointer.unlocked.replace("{key}", keyLabel(key))}</span>
    </button>
  );
}

/** Notices about Minh Anh (waiting, narration paused, no route, shortcut, too far in free mode). */
export function GuideNotices() {
  const t = useT();
  const notice = useGame((s) => s.guideNotice);
  const far = useGame((s) => s.guideFar);
  const gap = useGame((s) => s.guideGap);
  const playing = useGame((s) => s.phase === "playing");
  const keys = useSettings((s) => s.keys);
  const text =
    notice === "waiting" ? `${t.guide.waiting} · ~${gap} m`
    : notice === "narrationPaused" ? t.guide.narrationPaused
    : notice === "noRoute" ? t.guide.noRoute
    : notice === "shortcut" ? t.guide.shortcut
    : far ? t.guide.farAway.replace("G", keyLabel(keys.guide))
    : null;
  return (
    <AnimatePresence>
      {playing && text && (
        <motion.p key={text} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="panel px-3 py-1.5 text-[12.5px]" role="status">
          <Icon name="info" size={14} className="mr-1 inline text-amber" />
          {text}
        </motion.p>
      )}
    </AnimatePresence>
  );
}
