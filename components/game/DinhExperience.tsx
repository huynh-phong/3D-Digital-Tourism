"use client";

import { AnimatePresence, motion } from "framer-motion";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef } from "react";
import { useMediaQuery } from "@/lib/useMedia";
import { useVisitKey } from "@/lib/useVisitKey";
import { INTERACTABLES, STOP_BY_ID } from "@/data/dinh/tour";
import { ROOMS } from "@/data/dinh/layout";
import { narrator } from "@/lib/audio/narrator";
import { useKeyboard } from "@/lib/game/input";
import { installPointerLockListeners, lockPointer, releasePointer, togglePointer, usePointerLock } from "@/lib/game/pointer";
import { loc, useLang, useT } from "@/lib/i18n";
import { runtime, useGame, useProgress } from "@/lib/store/game";
import { keyLabel, useSettings, type Action } from "@/lib/store/settings";
import { askGuideToLead, callGuide, cancelNavigation, continueTour, interact, navigateTo, resetNarrated, setMode, STAIR_POINTS, watchNarrationEnd } from "@/lib/tour/director";
import { navRuntime } from "@/lib/tour/navigator";
import { GuideCard } from "@/components/guide/GuideCard";
import { FloorMap } from "@/components/tour/FloorMap";
import { InfoPanel } from "@/components/tour/InfoPanel";
import { ControlsGrid, ModeChooser, PauseMenu, TouchControls } from "@/components/tour/Overlays";
import { StopList } from "@/components/tour/StopList";
import { GuideNotices, NavCard, PointerChip } from "@/components/tour/NavHud";
import { markerClick } from "./RouteGuide";
import { IconButton } from "@/components/ui/primitives";
import { TopControls } from "@/components/ui/TopControls";
import { useReducedMotion } from "@/components/ui/Providers";
import { WebGLGate } from "@/components/ui/WebGLGate";
import { Logo } from "@/components/map/HomeExperience";
import type { CameraState } from "@/components/player/Player";
import { SPAWN } from "./spawn";

const DinhScene = dynamic(() => import("./DinhScene"), { ssr: false });

export function DinhExperience() {
  const t = useT();
  const lang = useLang();
  const quality = useSettings((s) => s.quality);
  const showHelp = useSettings((s) => s.showHelp);
  const keys = useSettings((s) => s.keys);
  const reducedMotion = useReducedMotion();
  const phase = useGame((s) => s.phase);
  const sceneKey = useGame((s) => s.sceneKey);
  const floor = useGame((s) => s.floor);
  const room = useGame((s) => s.room);
  const nearby = useGame((s) => s.nearby);
  const camMode = useGame((s) => s.camMode);
  const cam = useRef<CameraState>({ yaw: SPAWN.yaw, pitch: -0.28, dist: 4.6 });
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const chatRef = useRef<HTMLInputElement>(null);
  const touch = useMediaQuery("(pointer: coarse)");
  const lastUnlock = useRef(0);
  // fresh canvas + WebGL context each time this (kept-alive) page is shown
  const visit = useVisitKey();

  // Fresh state on mount / restart.
  useEffect(() => {
    resetNarrated();
    runtime.player = [...SPAWN.pos];
    runtime.input = { x: 0, y: 0, run: false, jump: false };
    cam.current = { yaw: SPAWN.yaw, pitch: -0.28, dist: 4.6 };
    useGame.setState({
      phase: "loading", panel: null, mapOpen: false, chatOpen: false, targetStopId: null, currentStopId: null, nearby: null,
      guideState: "WAITING", guideFar: false, guideLeading: false, guideNotice: null, destination: null, navStatus: "idle", navHint: null,
    });
  }, [sceneKey]);

  // Controls help shows first, then tucks itself away (H brings it back).
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setTimeout(() => useSettings.getState().set({ showHelp: false }), 25000);
    return () => clearTimeout(id);
  }, [phase]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      // Dev-only hook for manual QA (teleport, inspect state).
      (window as unknown as Record<string, unknown>).__sg3d = { useGame, runtime, useProgress, cam, navRuntime, usePointerLock, director: { setMode, continueTour, navigateTo, cancelNavigation, askGuideToLead } };
      // Dev-only QA shortcut: #qa=x,y,z,yaw,pitch[,first] starts free play at that spot.
      const qa = /qa=([^&]+)/.exec(location.hash)?.[1]?.split(",");
      if (qa) {
        const unsubQa = useGame.subscribe((s) => {
          if (s.phase !== "choose") return;
          unsubQa();
          const [x, y, z, yaw, pitch] = qa.map(Number);
          useGame.setState({ phase: "playing", mode: "free", camMode: qa[5] === "first" ? "first" : "third" });
          useGame.getState().requestTeleport([x, y, z], yaw);
          cam.current = { yaw, pitch, dist: 4.6 };
        });
      }
    }
    const unsub = watchNarrationEnd();
    return () => {
      unsub();
      narrator?.stop();
      if (document.pointerLockElement) document.exitPointerLock();
    };
  }, []);

  const pause = useCallback(() => {
    releasePointer();
    useGame.setState({ phase: "paused" });
    narrator?.pause();
  }, []);
  // Resuming never grabs the mouse by itself: the visitor clicks the scene (or the lock key) when ready.
  const resume = useCallback(() => {
    useGame.setState({ phase: "playing" });
    narrator?.resume();
  }, []);

  // Pointer lock: Esc only frees the cursor (the game keeps running). Remember when it
  // happened so the same Esc keystroke doesn't also open the pause menu.
  useEffect(() => {
    const off = installPointerLockListeners();
    const unsub = usePointerLock.subscribe((s, prev) => {
      if (prev.locked && !s.locked) lastUnlock.current = performance.now();
    });
    // Opening an information card frees the cursor so its buttons can be used.
    const unsubPanel = useGame.subscribe((s, prev) => {
      if (s.panel && !prev.panel) releasePointer();
    });
    return () => {
      off();
      unsub();
      unsubPanel();
    };
  }, []);

  const onKey = useCallback(
    (a: Action | "pause") => {
      const g = useGame.getState();
      if (a === "pause") {
        if (g.mapOpen) return useGame.setState({ mapOpen: false });
        // This Esc just released the mouse: that's all it should do.
        if (performance.now() - lastUnlock.current < 300 || usePointerLock.getState().locked) return;
        if (g.phase === "playing") pause();
        else if (g.phase === "paused") resume();
        return;
      }
      if (g.phase !== "playing") return;
      switch (a) {
        case "interact":
          interact();
          break;
        case "camera":
          useGame.setState({ camMode: g.camMode === "first" ? "third" : "first" });
          break;
        case "map":
          if (!g.mapOpen) releasePointer();
          useGame.setState({ mapOpen: !g.mapOpen });
          break;
        case "help":
          useSettings.getState().set({ showHelp: !useSettings.getState().showHelp });
          break;
        case "guide":
          callGuide();
          break;
        case "chat":
          releasePointer();
          setTimeout(() => chatRef.current?.focus(), 30);
          break;
        case "lock":
          if (!g.mapOpen && !g.chatOpen) togglePointer(canvas.current);
          break;
      }
    },
    [pause, resume],
  );
  const held = useKeyboard(onKey);

  const areaName =
    room ? loc(ROOMS.find((r) => r.id === room)!.name, lang) : t.tour.floors[floor];
  let prompt: string | null = null;
  if (nearby?.kind === "interactable") prompt = loc(INTERACTABLES.find((i) => i.id === nearby.id)!.title, lang);
  else if (nearby?.kind === "stop") prompt = loc(STOP_BY_ID.get(nearby.id)!.title, lang);
  else if (nearby?.kind === "stairs") {
    const s = STAIR_POINTS[Number(nearby.id)];
    prompt = s.id === "stair-roof" ? t.tour.stairsUp : t.tour.stairsDown;
  }
  const playing = phase === "playing";

  return (
    <main className="relative h-dvh w-full select-none overflow-hidden bg-bg text-fg">
      <div
        className="absolute inset-0"
        onClick={() => {
          const g = useGame.getState();
          // a click on a 3D marker asks for directions instead of grabbing the mouse
          if (performance.now() - markerClick.at < 300) return;
          if (g.phase === "playing" && !g.mapOpen && !g.chatOpen) lockPointer(canvas.current);
        }}
      >
        <WebGLGate onRetry={() => useGame.getState().restart()}>
          <DinhScene
            key={`${sceneKey}:${visit}`}
            quality={quality}
            reducedMotion={reducedMotion}
            held={held}
            cam={cam}
            onCanvas={(c) => (canvas.current = c)}
          />
        </WebGLGate>
      </div>

      {/* Loading */}
      <AnimatePresence>
        {phase === "loading" && (
          <motion.div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg" exit={{ opacity: 0 }} role="status" aria-live="polite">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-accent-soft border-t-[var(--accent)]" />
            <p className="text-sm text-muted">{t.tour.loadingScene}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div className={`pointer-events-none absolute inset-0 z-20 transition-opacity duration-500 ${phase === "intro" || phase === "loading" ? "opacity-0" : "opacity-100"}`}>
        {/* top-left: logo + area */}
        <div className="absolute left-3 top-3 flex items-center gap-2 sm:left-4 sm:top-4">
          <Link href="/" onClick={() => narrator?.stop()} className="panel pointer-events-auto flex items-center gap-2.5 px-2.5 py-2" aria-label={t.tour.backToMap}>
            <Logo />
            <span className="hidden leading-tight sm:block">
              <span className="block text-[13px] font-bold">{t.app.name}</span>
              <span className="block text-[11px] text-muted">Dinh Độc Lập</span>
            </span>
          </Link>
          <div className="panel px-3 py-2" aria-live="polite">
            <p className="text-[10.5px] uppercase tracking-wide text-muted">{t.tour.current}</p>
            <p className="text-[13px] font-semibold">{areaName}</p>
          </div>
        </div>
        {/* top-right */}
        <div className="absolute right-3 top-3 flex items-center gap-1.5 sm:right-4 sm:top-4">
          <div className="panel pointer-events-auto flex items-center gap-1.5 p-1.5">
            <IconButton icon="layers" label={`${t.tour.floorMap} (${keyLabel(keys.map)})`} onClick={() => { releasePointer(); useGame.setState({ mapOpen: true }); }} />
            <IconButton icon="camera" label={`${camMode === "first" ? t.tour.camera.first : t.tour.camera.third} (${keyLabel(keys.camera)})`} onClick={() => useGame.setState({ camMode: camMode === "first" ? "third" : "first" })} />
            <TopControls onSettings={pause} onHelp={() => useSettings.getState().set({ showHelp: !showHelp })} />
          </div>
        </div>
        {/* left: journey */}
        <div className="absolute left-3 top-[84px] hidden sm:left-4 sm:block">
          <StopList />
        </div>
        {/* right: info panel */}
        <div className="absolute right-3 top-[76px] sm:right-4">
          <InfoPanel />
        </div>
        {/* bottom-left: controls */}
        {!touch && showHelp && playing && (
          <div className="panel absolute bottom-4 left-4 hidden max-w-[360px] px-3 py-2 md:block">
            <p className="flex items-center justify-between text-[12px] font-semibold">
              {t.controls.title}
              <span className="text-[10.5px] font-normal text-muted"><span className="kbd">{keyLabel(keys.help)}</span> {t.controls.help}</span>
            </p>
            <ControlsGrid compact />
          </div>
        )}
        {/* bottom-right: Minh Anh */}
        <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4">
          <GuideCard chatRef={chatRef} />
        </div>
        {/* centre prompt */}
        <AnimatePresence>
          {playing && prompt && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="absolute bottom-40 left-1/2 -translate-x-1/2 sm:bottom-28">
              <button
                type="button"
                onClick={interact}
                className="panel pointer-events-auto flex items-center gap-2 px-3 py-2 text-[13px] font-medium"
              >
                <span className="kbd">{keyLabel(keys.interact)}</span> {t.tour.interact}: {prompt}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
        {/* top centre: directions, guide notices, mouse-look status */}
        <div className="absolute left-1/2 top-3 flex w-max max-w-[calc(100vw-24px)] -translate-x-1/2 flex-col items-center gap-1.5 sm:top-4">
          {playing && <NavCard />}
          <GuideNotices />
          {!touch && <PointerChip canvas={canvas} />}
        </div>
        {/* crosshair in first person */}
        {playing && camMode === "first" && <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/80 ring-1 ring-black/30" aria-hidden />}
      </div>

      {touch && playing && (
        <TouchControls onInteract={interact} onCamera={() => useGame.setState({ camMode: useGame.getState().camMode === "first" ? "third" : "first" })} />
      )}

      <ModeChooser onStart={() => { useGame.setState({ phase: "playing" }); lockPointer(canvas.current); }} />
      <PauseMenu onResume={resume} />
      <FloorMap />
      <ProgressHydrate />
    </main>
  );
}

/** Ensure progress is loaded before the first arrival is recorded. */
function ProgressHydrate() {
  useEffect(() => {
    void useProgress.persist.rehydrate();
  }, []);
  return null;
}
