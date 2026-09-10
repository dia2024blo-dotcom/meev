"use client";

// ============================================================
// MEEV v16 — DevGuard: production code protection (user spec:
// "لما واحد يعمل F12 ما يلاحش عمل ذكاء اصطناعي أو يسرق كودات").
//
// In PRODUCTION builds only:
//   · F12 / Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C blocked
//   · Ctrl+U (view-source) / Ctrl+S (save page) blocked
//   · right-click context menu disabled
//   · a no-nonsense console notice
//   · text selection theft deterrent on double-shift? (no — keep UX)
//
// In DEV (the preview sandbox) the guard stays asleep so QA and
// hot-reload keep working. Real protection is the production build
// itself: minified bundles, no source maps, no readable source.
// ============================================================

import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "./i18n";
import { PawMark } from "./symbols";

const IS_PROD = process.env.NODE_ENV === "production";

export function DevGuard() {
  const { L } = useI18n();
  const { toast } = useToast();
  const warned = useRef(false);

  useEffect(() => {
    if (!IS_PROD) return;

    const warn = () => {
      if (warned.current) return;
      warned.current = true;
      toast({
        title: (
          <span className="flex items-center gap-2">
            <PawMark size={16} className="text-amber-400" />
            {L("محتوى Meev محمي 🐾", "Meev content is protected 🐾")}
          </span>
        ),
        duration: 2600,
      });
      window.setTimeout(() => {
        warned.current = false;
      }, 10_000);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const blocked =
        key === "f12" ||
        (e.ctrlKey && e.shiftKey && (key === "i" || key === "j" || key === "c")) ||
        (e.ctrlKey && !e.shiftKey && (key === "u" || key === "s"));
      if (blocked) {
        e.preventDefault();
        e.stopPropagation();
        warn();
      }
    };

    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      warn();
    };

    window.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);

    // one quiet console notice — discouragement, not security theater
    try {
      console.log(
        "%cMeev 🐾 %c code & design are protected — viewing or copying source is not permitted.",
        "font-weight:900;font-size:14px;color:#BEB15C",
        "color:#8F7C35",
      );
    } catch {
      /* old browsers */
    }

    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
    };
  }, [L, toast]);

  return null;
}
