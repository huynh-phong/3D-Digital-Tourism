"use client";

import { AnimatePresence, motion } from "framer-motion";
import { INTERACTABLES, STOP_BY_ID } from "@/data/dinh/tour";
import { KNOWLEDGE_BY_ID } from "@/data/dinh/knowledge";
import { FACT_BY_ID } from "@/data/dinh/sources";
import { narrator } from "@/lib/audio/narrator";
import { loc, useLang, useT } from "@/lib/i18n";
import { useGame } from "@/lib/store/game";
import { navigateTo, playStop } from "@/lib/tour/director";
import { destKey } from "@/lib/tour/destinations";
import { Icon } from "@/components/ui/Icon";
import { Button, IconButton, StatusBadge } from "@/components/ui/primitives";
import Link from "next/link";

/** Right-side information sheet (never covers the whole 3D view). */
export function InfoPanel() {
  const t = useT();
  const lang = useLang();
  const panel = useGame((s) => s.panel);
  const close = () => useGame.setState({ panel: null });

  let body: React.ReactNode = null;
  let title = "";
  if (panel?.kind === "stop") {
    const s = STOP_BY_ID.get(panel.id)!;
    title = loc(s.title, lang);
    const sources = [...new Set(s.knowledge_ids.flatMap((k) => KNOWLEDGE_BY_ID.get(k)?.source_urls ?? []))];
    body = (
      <>
        <p className="text-[13.5px] leading-relaxed">{loc(s.narration.quick, lang)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon="replay" onClick={() => playStop(s.id, "main")}>{t.tour.replay}</Button>
          <Button size="sm" icon="book" onClick={() => playStop(s.id, "deep")}>{t.tour.deeper}</Button>
        </div>
        <details className="mt-3 rounded-xl border border-line px-3 py-2 text-[13px]" open>
          <summary className="cursor-pointer font-semibold">{t.tour.deeper}</summary>
          <p className="mt-1.5 leading-relaxed text-muted">{loc(s.narration.deep, lang)}</p>
        </details>
        {s.timeline.length > 0 && (
          <section className="mt-3">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Icon name="clock" size={14} />{t.tour.timeline}</h3>
            <ol className="relative ml-2 border-l border-line">
              {s.timeline.map((it) => {
                const f = FACT_BY_ID.get(it.fact_id);
                return (
                  <li key={it.date + it.fact_id} className="mb-2 ml-3">
                    <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
                    <p className="text-[12px] font-bold tabular-nums">{it.date}</p>
                    <p className="text-[12.5px]">{loc(it.label, lang)}</p>
                    {f && f.confidence_status !== "verified" && <StatusBadge status={f.confidence_status} />}
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        {s.media.length > 0 && (
          <section className="mt-3">
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><Icon name="image" size={14} />{t.tour.archive}</h3>
            <ul className="space-y-1">
              {s.media.map((m) => (
                <li key={m.id}>
                  <a href={m.page_url} target="_blank" rel="noreferrer" className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-[12.5px] hover:bg-accent-soft">
                    <Icon name="external" size={13} className="mt-0.5 shrink-0" />
                    <span>{loc(m.caption, lang)} <span className="text-muted">— {m.credit}</span></span>
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-[11px] text-muted">{t.tour.archiveNote}</p>
          </section>
        )}
        <section className="mt-3 rounded-xl bg-surface-2 p-2.5 text-[12px]">
          <p className="mb-1 flex items-center gap-2 font-semibold">{t.tour.accuracy} <StatusBadge status={s.spatial_confidence} /></p>
          <p className="text-muted">{loc(s.spatial_note, lang)}</p>
        </section>
        <Sources urls={sources} />
      </>
    );
  } else if (panel?.kind === "interactable") {
    const i = INTERACTABLES.find((x) => x.id === panel.id)!;
    const k = KNOWLEDGE_BY_ID.get(i.knowledge_id);
    title = loc(i.title, lang);
    body = (
      <>
        <div className="mb-2"><StatusBadge status={i.confidence_status} /></div>
        <p className="text-[13.5px] leading-relaxed">{loc(i.body, lang)}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" icon="volume" onClick={() => narrator?.play(loc(i.body, lang), lang, `i:${i.id}`, loc(i.title, lang))}>{t.tour.replay}</Button>
          <Button size="sm" icon="map" onClick={() => { navigateTo(destKey("interactable", i.id)); close(); }}>{t.nav.directions}</Button>
        </div>
        <Sources urls={k?.source_urls ?? []} />
      </>
    );
  } else if (panel?.kind === "complete") {
    title = t.tour.tourComplete;
    body = (
      <>
        <p className="text-[13.5px]">{t.tour.tourCompleteBody}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button onClick={close}>{t.tour.free}</Button>
          <Link href="/" className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-3.5 text-sm font-medium text-on-accent"><Icon name="map" />{t.tour.backToMap}</Link>
        </div>
      </>
    );
  }

  return (
    <AnimatePresence>
      {panel && (
        <motion.aside
          key={JSON.stringify(panel)}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 24 }}
          transition={{ duration: 0.18 }}
          className="panel pointer-events-auto flex max-h-[min(62vh,620px)] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden"
          aria-label={title}
          role="dialog"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <h2 className="text-[15px] font-bold leading-tight">{title}</h2>
            <IconButton icon="close" label={`${t.common.close} (E)`} onClick={close} />
          </div>
          <div className="scroll-thin overflow-y-auto px-4 py-3">{body}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function Sources({ urls }: { urls: string[] }) {
  const t = useT();
  if (!urls.length) return null;
  return (
    <section className="mt-3">
      <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">{t.common.sources}</h3>
      <ul className="space-y-0.5 text-[12px]">
        {urls.map((u) => (
          <li key={u}>
            <a className="break-all underline underline-offset-2" href={u} target="_blank" rel="noreferrer">{u.replace("https://", "")}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
