"use client";

// ============================================================
// v14 — DESKTOP DRAG-SCROLL for every horizontal rail
// User report: "لما تجي تقلب تحوس على بروفيلات واكسسوارات هي تمسك
// وجبد يسار مثل هاتف لاكن فالبيسي لا تشتغل… أيضا نفس المشكل فالملاحظات
// وايضا فالطقس" — every horizontal rail swipes naturally on a phone,
// but on the desktop the mouse could neither DRAG the row nor wheel
// across it.
//
// <DragRails/> mounts ONCE (app.tsx) and uses full event delegation:
//   • any element with the .meev-drag-rail class becomes draggable
//     with the MOUSE (press + move = grab-and-drag, exactly like a
//     phone swipe; touch pointers keep native scrolling)
//   • the vertical mouse wheel scrolls the rail horizontally ONLY
//     while the rail can still move in that direction — at either end
//     the page keeps scrolling normally (never a trap)
//   • a real drag (moved > 8px) suppresses the click that follows, so
//     tiles are never opened by accident
//   • RTL rows (the Arabic default) are handled: Chrome reports
//     negative scrollLeft there, so positions are compared via abs()
//     and the wheel direction is mirrored
// ============================================================

import { useEffect } from "react";

const RAIL_SELECTOR = ".meev-drag-rail";
const DRAG_THRESHOLD = 8;

export function DragRails() {
  useEffect(() => {
    let rail: HTMLElement | null = null;
    let startX = 0;
    let startScroll = 0;
    let moved = false;
    let down = false;
    let justDragged = false;

    const railOf = (t: EventTarget | null): HTMLElement | null =>
      t instanceof Element ? (t.closest(RAIL_SELECTOR) as HTMLElement | null) : null;

    const isRTL = (el: HTMLElement) => getComputedStyle(el).direction === "rtl";

    // ---- mouse drag ----
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      const el = railOf(e.target);
      if (!el || el.scrollWidth <= el.clientWidth + 2) return; // nothing to drag
      down = true;
      moved = false;
      rail = el;
      startX = e.clientX;
      startScroll = el.scrollLeft;
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!down || !rail) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) < DRAG_THRESHOLD) return;
      if (!moved) {
        moved = true;
        rail.classList.add("meev-dragging");
        window.getSelection?.()?.removeAllRanges();
      }
      if (rail) rail.scrollLeft = startScroll - dx;
    };

    const endDrag = () => {
      if (moved && rail) justDragged = true;
      rail?.classList.remove("meev-dragging");
      down = false;
      rail = null;
      moved = false;
    };

    // ---- click suppression after a real drag ----
    const onClickCapture = (e: MouseEvent) => {
      if (!justDragged) return;
      justDragged = false;
      if (railOf(e.target)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ---- smart wheel: horizontal only while the rail can consume it ----
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey) return; // pinch-zoom gesture
      const el = railOf(e.target);
      if (!el) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 2) return; // no overflow → page scrolls normally
      const pos = Math.abs(el.scrollLeft);
      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (delta === 0) return;
      // at either end in the wheel's direction → hand the scroll back
      if (delta > 0 && pos >= max - 1) return;
      if (delta < 0 && pos <= 1) return;
      e.preventDefault();
      el.scrollLeft += isRTL(el) ? -delta : delta;
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", endDrag);
    document.addEventListener("pointercancel", endDrag);
    document.addEventListener("click", onClickCapture, true);
    document.addEventListener("wheel", onWheel, { passive: false, capture: true });
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", endDrag);
      document.removeEventListener("pointercancel", endDrag);
      document.removeEventListener("click", onClickCapture, true);
      document.removeEventListener("wheel", onWheel, true);
    };
  }, []);

  return null;
}
