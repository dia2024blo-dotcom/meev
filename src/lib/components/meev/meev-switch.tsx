"use client";

// ============================================================
// MEEV v6 — MeevSwitch: a REAL toggle button.
// The 2FA row's tiny Switch read as "broken / not a real button"
// (three rounds of feedback) — this replaces it with a proper
// iOS-style control: big pill, spring thumb, glow when on,
// loading state while the server call is in flight.
// ============================================================

import { cn } from "@/lib/utils";

export function MeevSwitch({
  checked,
  onCheckedChange,
  disabled,
  busy,
  label,
  className,
}: {
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  busy?: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border transition-all duration-300 outline-none",
        "focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "cursor-pointer select-none",
        checked
          ? "border-transparent bg-gradient-to-r from-[#C5B767] to-[#DDD6B4] shadow-[0_0_12px_-2px_rgba(190,177,92,0.65)]"
          : "border-border bg-input/90 hover:bg-input",
        (disabled || busy) && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {/* the ON glyph — a tiny key emoji that fades in */}
      <span
        className={cn(
          "absolute start-2.5 text-[10px] leading-none transition-all duration-300",
          checked ? "opacity-100 scale-100" : "opacity-0 scale-50"
        )}
        aria-hidden="true"
      >
        🔐
      </span>
      {/* the thumb */}
      <span
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 grid place-items-center",
          "size-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,0.4)]",
          "transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
          checked ? "start-[calc(100%-25px)]" : "start-[2px]"
        )}
      >
        {busy && (
          <span
            className="block size-3 rounded-full border-2 border-rose-400/30 border-t-rose-500 animate-spin"
            aria-hidden="true"
          />
        )}
      </span>
    </button>
  );
}
