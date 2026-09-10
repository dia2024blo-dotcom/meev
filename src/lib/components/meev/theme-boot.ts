// v14 boot helper — the v13 multi-accent picker (ألوان ميف) is retired:
// Meev now has ONE identity, the muted gold→cream gradient. Users who
// still have the old accent's inline CSS vars on <html> (they beat the
// stylesheet) need them cleared once so the fixed gold tokens win again.

export function restoreThemeBoot() {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.style.removeProperty("--acc-light");
  el.style.removeProperty("--acc-dark");
  el.style.removeProperty("--acc-tint-light");
  el.style.removeProperty("--acc-tint-dark");
  try {
    window.localStorage.removeItem("meev-accent");
  } catch {
    /* private mode */
  }
}
