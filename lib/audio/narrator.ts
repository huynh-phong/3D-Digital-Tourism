"use client";

import { create } from "zustand";
import { useSettings } from "@/lib/store/settings";
import type { Lang } from "@/types";

export type NarratorStatus = "idle" | "loading" | "speaking" | "paused";
/** "voice" = Minh Anh's Azure voice (HoaiMy / Jenny); "subtitles" = text only. */
export type Engine = "voice" | "subtitles";

interface NarratorState {
  status: NarratorStatus;
  engine: Engine;
  subtitle: string;
  title: string;
  key: string | null; // what is being narrated (e.g. "stop-gate:main")
  sentenceIndex: number;
  sentenceCount: number;
  notice: string | null; // "voice_fallback" when a sentence could not be voiced
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

/** Whether the server has the voice configured; null = unknown until /api/status answers. */
let voiceAvailable: boolean | null = null;
if (typeof window !== "undefined") {
  fetch("/api/status")
    .then((r) => r.json())
    .then((s: { tts: string | null }) => (voiceAvailable = !!s.tts))
    .catch(() => {});
}

/**
 * Streaming URL: the server passes MP3 through as Azure generates it. `v`
 * changes whenever the voice provider changes, so audio a browser kept from
 * an earlier voice can never be played again.
 */
const VOICE_VERSION = "azure-1";
const ttsUrl = (text: string, lang: Lang, retry = 0) =>
  `/api/tts?v=${VOICE_VERSION}&lang=${lang}&text=${encodeURIComponent(text)}` + (retry ? `&r=${retry}` : "");

/**
 * Plays narration sentence by sentence with synced subtitles, always in the
 * same Azure voice for the language. A new play() stops the previous one (no overlap). If
 * a sentence can't be voiced even after a retry, that sentence is shown as a
 * subtitle and the next one tries the voice again — never a different voice.
 */
class Narrator {
  private token = 0;
  private audio: HTMLAudioElement | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private sentences: string[] = [];
  private lang: Lang = "vi";
  private clips = new Map<number, HTMLAudioElement>(); // current + preloaded next sentence
  private remaining = 0; // subtitle timer remainder when paused
  private timerStarted = 0;
  private silent = false; // the current sentence is subtitle-only

  private cleanup() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.audio = null;
    // stop and drop every clip (also aborts their downloads → the server stops generating)
    for (const a of this.clips.values()) this.drop(a);
    this.clips.clear();
  }

  private drop(a: HTMLAudioElement) {
    a.onended = a.onerror = a.onplaying = null;
    a.pause();
    a.removeAttribute("src");
    a.load();
  }

  private chooseEngine(): Engine {
    const s = useSettings.getState();
    if (!s.voiceEnabled || s.voiceMode === "none" || voiceAvailable === false) return "subtitles";
    return "voice";
  }

  /** Start narrating; any previous narration is stopped first (no overlap). */
  play(text: string, lang: Lang, key: string, title = "") {
    this.cleanup();
    const token = ++this.token;
    this.lang = lang;
    this.sentences = splitSentences(text);
    useNarrator.setState({ key, title, engine: this.chooseEngine(), notice: null, sentenceCount: this.sentences.length, sentenceIndex: 0, subtitle: "" });
    void this.playSentence(0, token);
  }

  private clip(i: number, retry = 0): HTMLAudioElement | null {
    if (i >= this.sentences.length) return null;
    let a = this.clips.get(i);
    if (!a || retry) {
      if (a) this.drop(a);
      a = new Audio();
      a.preload = "auto";
      a.src = ttsUrl(this.sentences[i], this.lang, retry);
      this.clips.set(i, a);
    }
    return a;
  }

  private playSentence(i: number, token: number, retry = 0) {
    if (token !== this.token) return;
    if (i >= this.sentences.length) {
      useNarrator.setState({ status: "idle", subtitle: "", sentenceIndex: this.sentences.length });
      return;
    }
    const text = this.sentences[i];
    const { volume, rate } = useSettings.getState();
    useNarrator.setState({ sentenceIndex: i });
    this.silent = false;

    if (useNarrator.getState().engine === "subtitles") return this.showSubtitle(i, token);

    useNarrator.setState({ status: "loading", subtitle: text });
    const audio = this.clip(i, retry)!;
    const prev = this.clips.get(i - 1);
    if (prev) this.drop(prev);
    this.clips.delete(i - 1);
    audio.volume = volume;
    audio.playbackRate = rate;
    this.audio = audio;
    // generate the next sentence in parallel, so there is no gap between sentences
    this.clip(i + 1);
    audio.onplaying = () => {
      if (token === this.token) useNarrator.setState({ status: "speaking" });
    };
    audio.onended = () => this.playSentence(i + 1, token);
    const failed = () => {
      if (token !== this.token || this.audio !== audio) return;
      audio.onerror = null;
      if (retry === 0) this.playSentence(i, token, 1); // one more try with the same voice
      else {
        useNarrator.setState({ notice: "voice_fallback" });
        this.showSubtitle(i, token);
      }
    };
    audio.onerror = failed;
    audio.play().catch((err: Error) => {
      if (err?.name !== "AbortError") failed();
    });
  }

  /** Text only for this sentence (no other voice), then carry on. */
  private showSubtitle(i: number, token: number) {
    const { rate } = useSettings.getState();
    this.silent = true;
    this.audio = null;
    useNarrator.setState({ status: "speaking", subtitle: this.sentences[i] });
    this.remaining = readingMs(this.sentences[i], rate);
    this.timerStarted = performance.now();
    this.timer = setTimeout(() => this.playSentence(i + 1, token), this.remaining);
  }

  pause() {
    const st = useNarrator.getState();
    if (st.status !== "speaking" && st.status !== "loading") return;
    if (this.silent && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
      this.remaining -= performance.now() - this.timerStarted;
    } else this.audio?.pause();
    useNarrator.setState({ status: "paused" });
  }

  resume() {
    const st = useNarrator.getState();
    if (st.status !== "paused") return;
    const token = this.token;
    useNarrator.setState({ status: "speaking" });
    if (this.silent) {
      this.timerStarted = performance.now();
      this.timer = setTimeout(() => this.playSentence(st.sentenceIndex + 1, token), Math.max(200, this.remaining));
    } else void this.audio?.play();
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
