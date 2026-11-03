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
    primary: "btn-game bg-accent text-on-accent hover:bg-accent-strong",
    soft: "btn-game bg-surface-solid text-fg hover:bg-mint",
    ghost: "rounded-[10px] text-fg hover:bg-accent-soft",
    outline: "btn-game bg-transparent text-fg hover:bg-mint",
  }[variant];
  const s = { sm: "h-8 px-2.5 text-xs gap-1.5", md: "h-10 px-3.5 text-sm gap-2", lg: "h-12 px-5 text-base gap-2.5" }[size];
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center font-bold disabled:opacity-50 disabled:pointer-events-none ${v} ${s} ${className}`}
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
      className={`btn-game inline-flex h-10 w-10 shrink-0 items-center justify-center ${
        active ? "bg-accent text-on-accent" : "bg-surface-solid text-fg hover:bg-mint"
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
    <span className={`chip ${cfg.cls}`}>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(43,36,29,0.42)] p-4"
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
            className={`panel panel-modal flex max-h-[88vh] w-full flex-col overflow-hidden ${wide ? "max-w-3xl" : "max-w-lg"}`}
            initial={{ y: 16, scale: 0.98, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center justify-between border-b-2 border-ink px-5 py-3.5">
              <h2 className="title-game text-xl">{title}</h2>
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
    <div role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-[10px] border-2 border-ink bg-surface-solid shadow-[var(--shadow-btn)]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`px-3.5 py-1.5 text-xs font-bold transition-colors [&+&]:border-l-2 [&+&]:border-ink ${
            value === o.value ? "bg-accent text-on-accent" : "text-fg hover:bg-mint"
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
        className={`relative h-7 w-12 shrink-0 rounded-full border-2 border-ink transition-colors ${checked ? "bg-accent" : "bg-bg-2"}`}
      >
        <span
          className={`absolute top-[2px] left-0 h-[18px] w-[18px] rounded-full border-2 border-ink bg-surface-solid transition-transform ${checked ? "translate-x-[24px]" : "translate-x-[2px]"}`}
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
