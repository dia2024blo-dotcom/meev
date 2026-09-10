// MEEV v3 — one-shot "jump to the legend items" handoff between the
// celebration overlay (level-999 LEGEND takeover → "Open Shop") and the
// shop view. Module-level state like mute-registry.ts: the celebration
// queues the jump right before setView("shop"); ShopView consumes it on
// mount so the user lands straight on the ⚡ legend tab with the gold
// flash instead of the default gradients tab.

let pending = false;

/** Queue a one-shot jump to the legend tab (called by the 999 takeover). */
export function queueLegendJump(): void {
  pending = true;
}

/** Consume the pending jump flag (ShopView calls this once on mount). */
export function consumeLegendJump(): boolean {
  const v = pending;
  pending = false;
  return v;
}
