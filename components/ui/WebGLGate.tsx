"use client";

import Link from "next/link";
import { Component, useSyncExternalStore, type ReactNode } from "react";
import { useT } from "@/lib/i18n";

let webgl: boolean | undefined;
function hasWebGL(): boolean {
  if (webgl !== undefined) return webgl;
  try {
    const c = document.createElement("canvas");
    webgl = !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    webgl = false;
  }
  return webgl;
}

/** Renders children only when WebGL works; otherwise an explanation. Also catches scene crashes. */
export function WebGLGate({ children, onRetry }: { children: ReactNode; onRetry?: () => void }) {
  const t = useT();
  const ok = useSyncExternalStore(
    () => () => {},
    hasWebGL,
    () => null,
  );
  if (ok === null) return null;
  if (!ok)
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
        <div className="panel max-w-md p-5 text-sm">
          <p className="font-semibold">{t.tour.webglError}</p>
          <Link className="mt-3 inline-block underline" href="/sources">
            {t.common.sources}
          </Link>
        </div>
      </div>
    );
  return <SceneBoundary message={t.tour.sceneError} retry={t.common.retry} onRetry={onRetry}>{children}</SceneBoundary>;
}

class SceneBoundary extends Component<{ children: ReactNode; message: string; retry: string; onRetry?: () => void }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("[scene]", error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="absolute inset-0 z-30 flex items-center justify-center p-6">
          <div className="panel max-w-md p-5 text-sm">
            <p className="font-semibold">{this.props.message}</p>
            <p className="mt-1 text-xs text-muted">{String(this.state.error.message).slice(0, 200)}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded-xl bg-accent px-3 py-2 text-on-accent"
                onClick={() => {
                  this.setState({ error: null });
                  this.props.onRetry?.();
                }}
              >
                {this.props.retry}
              </button>
              <Link className="rounded-xl border border-line px-3 py-2" href="/">
                ←
              </Link>
            </div>
          </div>
        </div>
      );
    return this.props.children;
  }
}
