"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useT } from "@/lib/i18n";
import type { ConfidenceStatus } from "@/types";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "ghost" | "soft" | "outline";

export function Button({
  variant = "soft",
  icon,
  children,
  className = "",
  size = "md",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; icon?: IconName; size?: "sm" | "md" | "lg" }) {
  const v = {
    primary: "bg-accent text-on-accent hover:bg-accent-strong shadow-sm",
    soft: "bg-surface-2 text-fg hover:bg-accent-soft border border-line",
    ghost: "text-fg hover:bg-accent-soft",
    outline: "border border-line text-fg hover:bg-accent-soft",
  }[variant];
  const s = { sm: "h-8 px-2.5 text-xs gap-1.5", md: "h-10 px-3.5 text-sm gap-2", lg: "h-12 px-5 text-base gap-2.5" }[size];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none ${v} ${s} ${className}`}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 15 : 18} />}
      {children}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  active,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { icon: IconName; label: string; active?: boolean }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border border-line transition-colors duration-150 ${
        active ? "bg-accent text-on-accent" : "bg-surface-2 text-fg hover:bg-accent-soft"
      } ${className}`}
      {...rest}
    >
      <Icon name={icon} />
    </button>
  );
}

/** Status shown with text + icon, never colour alone. */
export function StatusBadge({ status }: { status: ConfidenceStatus }) {
  const t = useT();
  const cfg = {
    verified: { cls: "bg-accent-soft text-accent", icon: "check" as const, label: t.common.verified },
    conflicting: { cls: "bg-amber-soft text-amber", icon: "info" as const, label: t.common.conflicting },
    estimated: { cls: "bg-blue-soft text-blue", icon: "layers" as const, label: t.common.estimated },
    simulated: { cls: "bg-surface-2 text-muted border border-line", icon: "layers" as const, label: t.common.simulated },
  }[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
      <Icon name={cfg.icon} size={12} />
      {cfg.label}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, [href], input, select")?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      prev?.focus?.();
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`panel flex max-h-[88vh] w-full flex-col overflow-hidden ${wide ? "max-w-3xl" : "max-w-lg"}`}
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <h2 className="text-base font-semibold">{title}</h2>
              <IconButton icon="close" label={t.common.close} onClick={onClose} />
            </div>
            <div className="scroll-thin overflow-y-auto px-5 py-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-surface-2 p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[10px] px-3 py-1.5 text-xs font-semibold transition-colors ${
            value === o.value ? "bg-accent text-on-accent" : "text-muted hover:text-fg"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 py-1.5 text-sm">
      <span>{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-accent" : "bg-bg-2 border border-line"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  return (
    <label className="block py-1.5 text-sm">
      <span className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-muted">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--accent)]"
        aria-label={label}
      />
    </label>
  );
}
