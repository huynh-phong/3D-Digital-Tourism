"use client";

import { create } from "zustand";
import { useSettings } from "@/lib/store/settings";
import type { Lang } from "@/types";

export type NarratorStatus = "idle" | "loading" | "speaking" | "paused";
export type Engine = "cloud" | "browser" | "subtitles";

interface NarratorState {
  status: NarratorStatus;
  engine: Engine;
  subtitle: string;
  title: string;
  key: string | null; // what is being narrated (e.g. "stop-gate:main")
  sentenceIndex: number;
  sentenceCount: number;
  notice: string | null; // e.g. "no Vietnamese voice"
}

export const useNarrator = create<NarratorState>()(() => ({
  status: "idle",
  engine: "subtitles",
  subtitle: "",
  title: "",
  key: null,
  sentenceIndex: 0,
  sentenceCount: 0,
  notice: null,
}));

export function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ỹ0-9“"(])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Subtitle-only pacing: ~15 chars/s at rate 1, minimum 1.6 s. */
const readingMs = (s: string, rate: number) => Math.max(1600, (s.length / 15) * 1000) / rate;

let cloudAvailable: boolean | null = null; // null = unknown until first try

async function fetchCloud(text: string, lang: Lang, signal: AbortSignal): Promise<string> {
  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, lang }),
    signal,
  });
  if (res.status === 501) {
    cloudAvailable = false;
    throw new Error("not_configured");
  }
  if (!res.ok) throw new Error("tts_" + res.status);
  cloudAvailable = true;
  return URL.createObjectURL(await res.blob());
}

function pickBrowserVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  const prefix = lang === "vi" ? "vi" : "en";
  const candidates = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!candidates.length) return null;
  // Prefer voices whose names suggest a female voice; fall back to any match.
  const female = /hoai ?my|linh|an\b|female|nữ|zira|jenny|aria|samantha|google (vietnamese|us english)/i;
  return candidates.find((v) => female.test(v.name)) ?? candidates[0];
}

class Narrator {
  private token = 0;
  private audio: HTMLAudioElement | null = null;
  private abort: AbortController | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sentences: string[] = [];
  private lang: Lang = "vi";
  private urls = new Map<number, Promise<string>>();
  private remaining = 0; // subtitle-only timer remainder when paused
  private timerStarted = 0;

  private cleanup() {
    this.abort?.abort();
    this.abort = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    for (const p of this.urls.values()) p.then((u) => URL.revokeObjectURL(u)).catch(() => {});
    this.urls.clear();
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
  }

  private chooseEngine(): Engine {
    const s = useSettings.getState();
    if (!s.voiceEnabled || s.voiceMode === "none") return "subtitles";
    if (s.voiceMode === "cloud" && cloudAvailable !== false) return "cloud";
    if (pickBrowserVoice(this.lang)) return "browser";
    return "subtitles";
  }

  /** Start narrating; any previous narration is stopped first (no overlap). */
  play(text: string, lang: Lang, key: string, title = "") {
    this.cleanup();
    const token = ++this.token;
    this.lang = lang;
    this.sentences = splitSentences(text);
    const engine = this.chooseEngine();
    const notice =
      useSettings.getState().voiceEnabled && engine === "subtitles" && useSettings.getState().voiceMode !== "none"
        ? "no_voice"
        : null;
    useNarrator.setState({ key, title, engine, notice, sentenceCount: this.sentences.length, sentenceIndex: 0, subtitle: "" });
    this.abort = new AbortController();
    void this.playSentence(0, token);
  }

  private prefetch(i: number) {
    if (i >= this.sentences.length || this.urls.has(i) || !this.abort) return;
    const p = fetchCloud(this.sentences[i], this.lang, this.abort.signal);
    p.catch(() => {});
    this.urls.set(i, p);
  }

  private async playSentence(i: number, token: number) {
    if (token !== this.token) return;
    if (i >= this.sentences.length) {
      useNarrator.setState({ status: "idle", subtitle: "", sentenceIndex: this.sentences.length });
      return;
    }
    const text = this.sentences[i];
    const { volume, rate } = useSettings.getState();
    const engine = useNarrator.getState().engine;
    useNarrator.setState({ sentenceIndex: i });

    if (engine === "cloud") {
      useNarrator.setState({ status: "loading" });
      try {
        this.prefetch(i);
        const url = await this.urls.get(i)!;
        if (token !== this.token) return;
        this.prefetch(i + 1);
        const audio = new Audio(url);
        audio.volume = volume;
        audio.playbackRate = rate;
        this.audio = audio;
        audio.onended = () => void this.playSentence(i + 1, token);
        audio.onerror = () => this.fallback(i, token);
        useNarrator.setState({ status: "speaking", subtitle: text });
        await audio.play();
      } catch (err) {
        if (token !== this.token) return;
        if ((err as Error)?.name === "AbortError") return;
        this.fallback(i, token);
      }
      return;
    }

    if (engine === "browser") {
      const voice = pickBrowserVoice(this.lang);
      if (!voice) return this.fallback(i, token);
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang;
      u.volume = volume;
      u.rate = rate;
      u.onend = () => void this.playSentence(i + 1, token);
      u.onerror = (e) => {
        if (e.error === "interrupted" || e.error === "canceled") return;
        this.fallback(i, token);
      };
      useNarrator.setState({ status: "speaking", subtitle: text });
      window.speechSynthesis.speak(u);
      return;
    }

    // Subtitles only.
    useNarrator.setState({ status: "speaking", subtitle: text });
    this.remaining = readingMs(text, rate);
    this.timerStarted = performance.now();
    this.timer = setTimeout(() => void this.playSentence(i + 1, token), this.remaining);
  }

  /** Audio failed: degrade one level and continue from the same sentence. */
  private fallback(i: number, token: number) {
    if (token !== this.token) return;
    const cur = useNarrator.getState().engine;
    const next: Engine = cur === "cloud" && pickBrowserVoice(this.lang) ? "browser" : "subtitles";
    useNarrator.setState({ engine: next, notice: next === "subtitles" ? "no_voice" : null });
    void this.playSentence(i, token);
  }

  pause() {
    const st = useNarrator.getState();
    if (st.status !== "speaking" && st.status !== "loading") return;
    if (st.engine === "cloud") this.audio?.pause();
    else if (st.engine === "browser") window.speechSynthesis.pause();
    else if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.remaining -= performance.now() - this.timerStarted;
    }
    useNarrator.setState({ status: "paused" });
  }

  resume() {
    const st = useNarrator.getState();
    if (st.status !== "paused") return;
    const token = this.token;
    useNarrator.setState({ status: "speaking" });
    if (st.engine === "cloud") void this.audio?.play();
    else if (st.engine === "browser") window.speechSynthesis.resume();
    else {
      this.timerStarted = performance.now();
      this.timer = setTimeout(() => void this.playSentence(st.sentenceIndex + 1, token), Math.max(200, this.remaining));
    }
  }

  stop() {
    this.token++;
    this.cleanup();
    useNarrator.setState({ status: "idle", subtitle: "", key: null });
  }

  /** Apply volume/rate changes to what is currently playing. */
  applySettings() {
    const { volume, rate } = useSettings.getState();
    if (this.audio) {
      this.audio.volume = volume;
      this.audio.playbackRate = rate;
    }
  }
}

export const narrator = typeof window !== "undefined" ? new Narrator() : (null as unknown as Narrator);
