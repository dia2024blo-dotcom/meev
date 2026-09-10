"use client";

// ============================================================
// MEEV v11 — LanguageSheet + LanguageLaunchButton.
//
// The login-style language quick-switcher: press the round glass
// globe, a glass dialog pops up with all 6 languages; pick one and
// the site does a LIGHT RESTART (paw-pulse overlay → reload → boot
// splash in the new language) — exactly like the big login screens.
//
// - Works PRE-LOGIN: the sheet skips the profile PATCH when no
//   `me` exists (localStorage persistence still happens via
//   store.setLang).
// - Works POST-LOGIN: persists the choice to the profile.
// - The button is fully standalone (owns its sheet state) so it
//   can be dropped anywhere: auth screen, top bar, settings.
// ============================================================

import { useState } from "react";
import { motion } from "framer-motion";
import { Globe, Check } from "lucide-react";
import { GlobeLive } from "./symbols";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api } from "./api";
import { useMeev, type Lang } from "./store";
import { useI18n, lightRestart } from "./i18n";
import { LANGUAGES } from "./i18n-dict";
import { cn } from "@/lib/utils";

const BUTTON_SIZES = {
  sm: { box: "size-9", icon: "size-5" },
  md: { box: "size-10", icon: "size-[18px]" },
  lg: { box: "size-12", icon: "size-6" },
} as const;

export type LanguageButtonSize = keyof typeof BUTTON_SIZES;

// ------------------------------------------------------------
// LanguageLaunchButton — the round glass globe. Owns its sheet,
// so it works dropped anywhere (no parent state required).
// ------------------------------------------------------------
export function LanguageLaunchButton({
  className,
  size = "md",
  variant = "glass",
  title,
}: {
  className?: string;
  size?: LanguageButtonSize;
  /** "glass" = standalone round glass globe · "plain" = icon-only, matches top-bar siblings */
  variant?: "glass" | "plain";
  /** override the tooltip (default: current language flag + native name) */
  title?: string;
}) {
  const { lang } = useI18n();
  const [open, setOpen] = useState(false);
  const active = LANGUAGES.find((l) => l.key === lang);
  const s = BUTTON_SIZES[size] ?? BUTTON_SIZES.md;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={lang === "ar" ? "تغيير اللغة / Change language" : "Change language / تغيير اللغة"}
        title={title ?? (active ? `${active.flag} ${active.native}` : "Meev Languages")}
        className={cn(
          "rounded-full grid place-items-center shrink-0 transition-all active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          variant === "glass"
            ? "glass text-foreground/85 shadow-lg hover:border-primary/40 hover:text-primary"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
          s.box,
          className,
        )}
      >
        <Globe className={s.icon} aria-hidden="true" />
      </button>

      <LanguageSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

// ------------------------------------------------------------
// LanguageSheet — the language list dialog (login-screen style).
// Same language → just close. New language → persist (store +
// profile when signed in) → light restart 🐾.
// ------------------------------------------------------------
export function LanguageSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { L, lang, setLang } = useI18n();
  const me = useMeev((s) => s.me);

  const pick = (key: string) => {
    if (key === lang) {
      onOpenChange(false);
      return;
    }
    setLang(key as Lang); // persists to localStorage (works pre-auth)
    if (me) api.updateMe({ lang: key }).catch(() => {}); // profile sync, signed-in only
    onOpenChange(false);
    lightRestart(); // paw-pulse overlay → reload → boot in the new language
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl glass p-0 overflow-hidden gap-0">
        {/* soft aurora bloom behind the header */}
        <div className="absolute -top-20 start-1/2 -translate-x-1/2 size-48 rounded-full bg-primary/20 blur-3xl pointer-events-none" aria-hidden="true" />

        <DialogHeader className="relative p-5 pb-3 text-center sm:text-center">
          <DialogTitle className="text-xl font-black tracking-tight flex items-center justify-center gap-2.5">
            <GlobeLive size={24} className="text-primary shrink-0" aria-hidden="true" />
            <span className="meev-aurora-text">{L("اختر لغتك", "Choose your language")}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {L("ستشتغل ميف بلغتك بعد لحظات", "Meev will speak your language in a moment")}
          </DialogDescription>
        </DialogHeader>

        {/* the 6 languages — big tappable rows, staggered in */}
        <div role="listbox" aria-label={L("اختر لغتك", "Choose your language")} className="relative p-2.5 pt-1 space-y-1.5">
          {LANGUAGES.map((l, i) => {
            const active = lang === l.key;
            return (
              <motion.button
                key={l.key}
                type="button"
                role="option"
                aria-selected={active}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 + i * 0.045, duration: 0.22 }}
                onClick={() => pick(l.key)}
                className={cn(
                  "w-full rounded-2xl p-[2px] transition-all",
                  active
                    ? "bg-gradient-to-br from-[#C5B767] to-[#E4DDC0] shadow-lg"
                    : "bg-transparent hover:bg-primary/15",
                )}
              >
                <span
                  className={cn(
                    "flex items-center gap-3.5 rounded-[14px] px-4 py-3 text-start transition-colors",
                    active
                      ? "bg-card"
                      : "border border-border/60 hover:border-primary/30",
                  )}
                >
                  <span className="text-2xl leading-none shrink-0" aria-hidden="true">{l.flag}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-base font-black leading-tight">{l.native}</span>
                    <span className="block text-[11px] text-muted-foreground">{l.note}</span>
                  </span>
                  {active && (
                    <motion.span
                      initial={{ scale: 0.4, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="shrink-0 size-7 rounded-full bg-emerald-500 grid place-items-center shadow-md shadow-emerald-500/30"
                    >
                      <Check className="size-4 text-white" strokeWidth={3} />
                    </motion.span>
                  )}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* footer — the light-restart hint */}
        <div className="relative px-5 py-3.5 border-t border-border/50 text-center text-[11px] text-muted-foreground">
          {L("يتم إعادة تشغيل خفيف للموقع بعد الاختيار", "A light restart follows your choice")}
        </div>
      </DialogContent>
    </Dialog>
  );
}
