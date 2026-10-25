"use client";

import Link from "next/link";
import { ASSETS } from "@/data/assets";
import { MEASURES } from "@/data/dinh/layout";
import { FACTS, SOURCE_BY_ID, SOURCES } from "@/data/dinh/sources";
import { loc, useLang, useT } from "@/lib/i18n";
import { Logo } from "@/components/map/HomeExperience";
import { StatusBadge } from "./primitives";
import { TopControls } from "./TopControls";

export function SourcesView() {
  const t = useT();
  const lang = useLang();
  return (
    <main className="h-dvh overflow-y-auto bg-bg text-fg">
      <header className="sticky top-0 z-10 border-b border-line bg-surface backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-sm font-bold">{t.app.name}</span>
          </Link>
          <TopControls />
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold">{t.sources.title}</h1>
        <p className="mt-2 text-sm text-muted">{t.sources.intro}</p>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t.common.sources}</h2>
          <ul className="space-y-2">
            {SOURCES.map((s) => (
              <li key={s.id} className="panel px-4 py-3 text-sm">
                <a href={s.url} target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">{loc(s.title, lang)}</a>
                <p className="text-xs text-muted">{s.publisher} · {s.url} · {lang === "vi" ? "truy cập" : "accessed"} {s.accessed}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t.sources.facts} ({FACTS.length})</h2>
          <ul className="space-y-2">
            {FACTS.map((f) => (
              <li key={f.id} className="rounded-xl border border-line px-4 py-3 text-sm">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <StatusBadge status={f.confidence_status} />
                  {f.source_ids.map((id) => (
                    <a key={id} href={SOURCE_BY_ID.get(id)!.url} target="_blank" rel="noreferrer" className="text-[11px] text-muted underline">{loc(SOURCE_BY_ID.get(id)!.title, lang)}</a>
                  ))}
                </div>
                <p>{loc(f.text, lang)}</p>
                {f.note && <p className="mt-1 text-xs text-amber">{loc(f.note, lang)}</p>}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{lang === "vi" ? "Số đo dùng trong mô phỏng" : "Measurements used in the simulation"}</h2>
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-sm">
              <tbody>
                {Object.entries(MEASURES).map(([k, m]) => (
                  <tr key={k} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-mono text-xs">{k}</td>
                    <td className="px-3 py-2 tabular-nums">{m.value} m{k.includes("Footprint") ? "²" : ""}</td>
                    <td className="px-3 py-2"><StatusBadge status={m.status} /></td>
                    <td className="px-3 py-2 text-xs text-muted">{m.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">{t.sources.assets}</h2>
          <ul className="space-y-2">
            {ASSETS.map((a) => (
              <li key={a.name} className="rounded-xl border border-line px-4 py-3 text-sm">
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted">{loc(a.kind, lang)} · {a.licence} · {a.source}</p>
                <p className="mt-1">{loc(a.note, lang)}</p>
              </li>
            ))}
          </ul>
        </section>
        <p className="mt-10 text-xs text-muted">
          <Link href="/" className="underline">← {t.tour.backToMap}</Link>
        </p>
      </article>
    </main>
  );
}
