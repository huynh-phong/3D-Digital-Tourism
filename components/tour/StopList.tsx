"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { TOUR_STOPS } from "@/data/dinh/tour";
import { loc, useLang, useT } from "@/lib/i18n";
import { useGame, useProgress } from "@/lib/store/game";
import { goToStop } from "@/lib/tour/director";
import { Icon } from "@/components/ui/Icon";

export function StopList() {
  const t = useT();
  const lang = useLang();
  const completed = useProgress((s) => s.completed);
  const current = useGame((s) => s.currentStopId);
  const target = useGame((s) => s.targetStopId);
  const [open, setOpen] = useState(true);
  const done = TOUR_STOPS.filter((s) => completed.includes(s.id)).length;

  return (
    <nav aria-label={t.tour.stops} className="panel pointer-events-auto w-[min(290px,calc(100vw-24px))] overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold">{t.tour.stops}</span>
        <span className="flex items-center gap-2 text-[11px] text-muted">
          {t.tour.progress} {done}/{TOUR_STOPS.length}
          <Icon name={open ? "chevronUp" : "chevronDown"} size={16} />
        </span>
      </button>
      <div className="mx-3 mb-2 h-1.5 overflow-hidden rounded-full bg-bg-2" role="progressbar" aria-valuemin={0} aria-valuemax={TOUR_STOPS.length} aria-valuenow={done}>
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(done / TOUR_STOPS.length) * 100}%` }} />
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ol initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="scroll-thin max-h-[34vh] overflow-y-auto pb-2">
            {TOUR_STOPS.map((s) => {
              const isDone = completed.includes(s.id);
              const isHere = current === s.id;
              const isTarget = target === s.id;
              return (
                <li key={s.id} className={`group flex items-center gap-2 px-3 py-1.5 text-[13px] ${isHere ? "bg-accent-soft" : ""}`}>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      isDone ? "bg-accent text-on-accent" : isTarget ? "bg-blue text-white" : "border border-line text-muted"
                    }`}
                    aria-hidden
                  >
                    {isDone ? <Icon name="check" size={13} /> : s.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{loc(s.title, lang)}</span>
                    <span className="block text-[10.5px] text-muted">
                      {t.tour.floors[s.floor]} · {isHere ? t.tour.current : isDone ? t.tour.completed : isTarget ? t.tour.nextStop : t.tour.notVisited}
                    </span>
                  </span>
                  {!isHere && (
                    <button
                      type="button"
                      onClick={() => goToStop(s.id)}
                      className="rounded-lg px-2 py-1 text-[11px] font-semibold text-accent opacity-80 hover:bg-accent-soft hover:opacity-100 focus-visible:opacity-100"
                      aria-label={`${t.tour.goTo}: ${loc(s.title, lang)}`}
                    >
                      {t.tour.goTo}
                    </button>
                  )}
                </li>
              );
            })}
          </motion.ol>
        )}
      </AnimatePresence>
    </nav>
  );
}
