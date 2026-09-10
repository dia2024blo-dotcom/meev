"use client";

// ============================================================
// MEEV i18n — inline bilingual strings + extended languages.
// Usage: const { L } = useI18n(); L("مرحبا", "Hello")
//
// v5: ar/en work inline as before. The extra languages
// (fr/es/tr/de) resolve through the dictionary in i18n-dict.ts,
// keyed by the English string — anything missing falls back to
// English. Direction (rtl/ltr) is synced from the store lang.
// ============================================================

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useMeev, type Lang } from "./store";
import { EXTRA_TRANSLATIONS, isExtraLang } from "./i18n-dict";

type I18nValue = {
  lang: Lang;
  dir: "rtl" | "ltr";
  /** Pick the Arabic or English variant of a string (extra langs via dict). */
  L: (ar: string, en: string) => string;
  setLang: (l: Lang) => void;
};

const I18nContext = createContext<I18nValue | null>(null);

// STABLE module-level fallback. Consumers rendered OUTSIDE the provider
// (the app shell sits above <I18nProvider>) used to get a fresh object per
// useI18n() call — a new `L` identity every render. Any effect that lists
// `L` in its dependency array (the app shell's realtime wiring) would have
// its cleanup run on the next render and its re-run blocked by a
// once-only ref guard, silently unwiring every global socket handler
// (level:up / gift:received / notif:new / dm:new toasts) a few hundred ms
// after boot. A constant identity keeps those deps stable forever.
const I18N_FALLBACK: I18nValue = {
  lang: "ar",
  dir: "rtl",
  L: (ar) => ar,
  setLang: () => {},
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const lang = useMeev((s) => s.lang);
  const setLangStore = useMeev((s) => s.setLang);

  // sync <html dir/lang> with the active language
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  }, [lang]);

  const value: I18nValue = {
    lang,
    dir: lang === "ar" ? "rtl" : "ltr",
    L: (ar, en) => {
      if (lang === "ar") return ar;
      if (isExtraLang(lang)) {
        const dict = EXTRA_TRANSLATIONS[lang];
        return dict[en] ?? en;
      }
      return en;
    },
    setLang: (l) => setLangStore(l),
  };

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext) ?? I18N_FALLBACK;
}

// ============================================================
// v7 — lightRestart(): a language switch should feel like a soft
// reboot of the site (رستارت خفيف). We persist the language, fade
// the app out behind a tiny paw-pulse overlay (~500ms), then
// reload — the boot splash takes it from there in the new lang.
// (v16: the overlay speaks the ONE gold identity — the old sunset
// gradient label was the "نفس اللون الأول" flash the user saw.)
// ============================================================
let restarting = false;
export function lightRestart(delayMs = 550) {
  if (restarting || typeof window === "undefined") return;
  restarting = true;
  try {
    const ov = document.createElement("div");
    ov.id = "meev-light-restart";
    ov.setAttribute("role", "status");
    ov.setAttribute("aria-label", "Restarting…");
    ov.style.cssText =
      "position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;" +
      "background:color-mix(in oklab, var(--background, #000) 92%, transparent);backdrop-filter:blur(14px);" +
      "opacity:0;transition:opacity .28s ease;";
    const paw = document.createElement("div");
    paw.textContent = "🐾";
    paw.style.cssText =
      "font-size:52px;line-height:1;filter:drop-shadow(0 6px 18px rgba(190,177,92,.45));" +
      "animation:meev-restart-pulse 1s ease-in-out infinite;";
    const label = document.createElement("div");
    label.textContent = "Meev";
    label.style.cssText =
      "font-weight:900;font-size:20px;letter-spacing:-.02em;" +
      "background:linear-gradient(90deg,#BEB15C,#DDD6B4,#C9C189);-webkit-background-clip:text;background-clip:text;color:transparent;";
    ov.appendChild(paw);
    ov.appendChild(label);
    const style = document.createElement("style");
    style.textContent = "@keyframes meev-restart-pulse{0%,100%{transform:scale(1) rotate(-6deg)}50%{transform:scale(1.18) rotate(6deg)}}";
    document.head.appendChild(style);
    document.body.appendChild(ov);
    requestAnimationFrame(() => {
      ov.style.opacity = "1";
    });
    setTimeout(() => window.location.reload(), delayMs);
  } catch {
    window.location.reload();
  }
}
