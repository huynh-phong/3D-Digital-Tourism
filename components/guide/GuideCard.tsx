"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { narrator, useNarrator } from "@/lib/audio/narrator";
import { loc, useLang, useT } from "@/lib/i18n";
import { nextStopAfter } from "@/lib/knowledge/retrieve";
import { useGame, useProgress } from "@/lib/store/game";
import { useSettings } from "@/lib/store/settings";
import { continueTour, playStop } from "@/lib/tour/director";
import { STOP_BY_ID } from "@/data/dinh/tour";
import { Icon } from "@/components/ui/Icon";
import { releasePointer } from "@/lib/game/pointer";
import { IconButton } from "@/components/ui/primitives";

interface Msg {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
  mode?: "ai" | "demo" | "fallback";
}

export function GuideAvatar({ speaking }: { speaking: boolean }) {
  return (
    <div className="relative h-11 w-11 shrink-0" aria-hidden>
      <svg viewBox="0 0 44 44" className="h-11 w-11">
        <circle cx="22" cy="22" r="22" fill="var(--accent-soft)" />
        <circle cx="22" cy="18" r="8" fill="#e7c19f" />
        <path d="M13 17a9 9 0 0 1 18 0c0-6-4-9-9-9s-9 3-9 9Z" fill="#1c1511" />
        <circle cx="22" cy="8.5" r="3.2" fill="#1c1511" />
        <path d="M9 40c1-8 6-12 13-12s12 4 13 12" fill="#1f3557" />
        <path d="M19 28l3 5 3-5" fill="#f5f3ee" />
        <rect x="15" y="31" width="3" height="4" rx="0.6" fill="#17834f" />
      </svg>
      {speaking && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 animate-pulse rounded-full bg-accent ring-2 ring-[var(--surface-solid)]" />}
    </div>
  );
}

export function GuideCard({ chatRef }: { chatRef: React.RefObject<HTMLInputElement | null> }) {
  const t = useT();
  const lang = useLang();
  const nar = useNarrator();
  const { subtitles, voiceEnabled } = useSettings();
  const guideState = useGame((s) => s.guideState);
  const mode = useGame((s) => s.mode);
  const currentStopId = useGame((s) => s.currentStopId);
  const targetStopId = useGame((s) => s.targetStopId);
  const chatOpen = useGame((s) => s.chatOpen);
  const completed = useProgress((s) => s.completed);
  const [q, setQ] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<{ ai: string | null; tts: string | null } | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => setStatus({ ai: null, tts: null }));
  }, []);
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [msgs, busy]);

  const nextId = nextStopAfter(completed);
  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setErr(null);
    setBusy(true);
    setExpanded(true);
    useGame.setState({ chatOpen: true });
    const history = msgs.slice(-6).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: question }]);
    setQ("");
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, lang, currentStopId, nextStopId: nextId, history }),
      });
      if (res.status === 429) throw new Error("rate");
      if (!res.ok) throw new Error("http");
      const data = (await res.json()) as { answer: string; sources: string[]; mode: Msg["mode"] };
      setMsgs((m) => [...m, { role: "assistant", content: data.answer, sources: data.sources, mode: data.mode }]);
      narrator?.play(data.answer, lang, "answer", t.guide.name);
    } catch (e) {
      setErr((e as Error).message === "rate" ? t.guide.rateLimited : t.guide.askError);
    } finally {
      setBusy(false);
    }
  };

  const speaking = nar.status === "speaking";
  const stateLabel = busy
    ? t.guide.thinking
    : nar.status === "loading"
      ? t.guide.loadingVoice
      : speaking
        ? t.guide.speaking
        : chatOpen
          ? t.guide.listening
          : t.guide.idle;

  const awaitingContinue = mode === "guided" && guideState === "WAIT" && nar.status === "idle" && !!targetStopId && completed.includes(targetStopId);
  const lastKey = nar.key;

  return (
    <section aria-label={t.guide.name} className="panel pointer-events-auto flex w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden">
      <header className="flex items-center gap-3 px-3 pt-3">
        <GuideAvatar speaking={speaking} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">{t.guide.name}</p>
          <p className="text-[11px] text-muted" aria-live="polite">
            {t.guide.role} · <span className="font-medium text-fg">{stateLabel}</span>
          </p>
        </div>
        <div className="flex gap-1">
          {nar.status === "paused" ? (
            <IconButton icon="play" label={t.guide.play} onClick={() => narrator?.resume()} />
          ) : (
            <IconButton icon="pause" label={t.guide.pause} disabled={nar.status === "idle"} onClick={() => narrator?.pause()} />
          )}
          <IconButton
            icon="replay"
            label={t.tour.replay}
            disabled={!lastKey && !currentStopId}
            onClick={() => {
              const [id, layer] = (lastKey ?? `${currentStopId}:main`).split(":");
              if (STOP_BY_ID.has(id)) playStop(id, (layer as "quick" | "main" | "deep") ?? "main");
              else {
                const last = [...msgs].reverse().find((m) => m.role === "assistant");
                if (last) narrator?.play(last.content, lang, "answer", t.guide.name);
              }
            }}
          />
          <IconButton icon="stop" label={t.guide.stop} disabled={nar.status === "idle"} onClick={() => narrator?.stop()} />
          <IconButton icon={expanded ? "chevronDown" : "chat"} label={t.controls.chat} onClick={() => setExpanded((v) => !v)} />
        </div>
      </header>

      {/* Subtitles */}
      <div className="px-3 pt-2" aria-live="polite">
        {subtitles && nar.subtitle ? (
          <p className="rounded-xl bg-surface-2 px-3 py-2 text-[13.5px] leading-relaxed">
            {nar.title && <span className="mb-0.5 block text-[11px] font-semibold uppercase tracking-wide text-accent">{nar.title}</span>}
            {nar.subtitle}
            <span className="ml-2 text-[10px] text-muted tabular-nums">
              {Math.min(nar.sentenceIndex + 1, nar.sentenceCount)}/{nar.sentenceCount}
            </span>
          </p>
        ) : null}
        {nar.notice === "no_voice" && voiceEnabled && <p className="mt-1 text-[11px] text-amber">{t.guide.noViVoice}</p>}
      </div>

      {awaitingContinue && (
        <div className="mx-3 mt-2 flex items-center justify-between gap-2 rounded-xl bg-accent-soft px-3 py-2 text-[13px]">
          <span>
            {nextId ? `${t.tour.nextStop}: ${loc(STOP_BY_ID.get(nextId)!.title, lang)}` : t.tour.tourComplete}
          </span>
          <button type="button" onClick={continueTour} className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-on-accent">
            {t.tour.resume} →
          </button>
        </div>
      )}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div ref={logRef} className="scroll-thin mx-3 mt-2 max-h-48 space-y-2 overflow-y-auto">
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {t.guide.suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => ask(s)} className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[12px] hover:bg-accent-soft">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className={`text-[13px] ${m.role === "user" ? "text-right" : ""}`}>
                  <p className={`inline-block max-w-[92%] rounded-xl px-3 py-1.5 text-left ${m.role === "user" ? "bg-accent text-on-accent" : "bg-surface-2"}`}>{m.content}</p>
                  {m.role === "assistant" && (
                    <p className="mt-0.5 text-[10.5px] text-muted">
                      {m.mode === "demo" ? t.guide.demoMode : m.mode === "fallback" ? t.guide.fallbackMode : t.guide.aiMode}
                      {m.sources && m.sources.length > 0 && (
                        <>
                          {" · "}
                          {t.guide.sourcesUsed}:{" "}
                          {m.sources.slice(0, 3).map((u, k) => (
                            <a key={u} href={u} target="_blank" rel="noreferrer" className="underline">
                              [{k + 1}]
                            </a>
                          ))}
                        </>
                      )}
                    </p>
                  )}
                </div>
              ))}
              {busy && <p className="text-[12px] text-muted">{t.guide.thinking}</p>}
              {err && <p className="text-[12px] text-danger" role="alert">{err}</p>}
            </div>
            {status && !status.ai && <p className="mx-3 mt-1 text-[10.5px] text-muted">{t.guide.demoMode}</p>}
          </motion.div>
        )}
      </AnimatePresence>

      <form
        className="flex items-center gap-2 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void ask(q);
          chatRef.current?.blur();
        }}
      >
        <input
          ref={chatRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={400}
          onFocus={() => {
            useGame.setState({ chatOpen: true });
            releasePointer();
          }}
          onBlur={() => setTimeout(() => !busy && useGame.setState({ chatOpen: false }), 200)}
          onKeyDown={(e) => {
            if (e.key === "Escape") (e.target as HTMLInputElement).blur();
            e.stopPropagation();
          }}
          placeholder={t.guide.askPlaceholder}
          aria-label={t.guide.askPlaceholder}
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-surface-solid px-3 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button type="submit" disabled={busy || !q.trim()} aria-label={t.guide.send} className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-on-accent disabled:opacity-50">
          <Icon name="send" />
        </button>
      </form>
    </section>
  );
}
