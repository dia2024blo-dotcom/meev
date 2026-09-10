// MEEV v3 — caller-side DM mute registry.
// Module-level (NOT store state — the lead owns store.ts): the messages
// view owns the real muted flags (from /api/dms + /api/dms/:id/messages)
// and mirrors them here so the global app shell's dm:new toast guard can
// suppress notification toasts for muted conversations with ONE tiny
// import instead of lifting state ownership.

const mutedConversations = new Set<string>()

/** True when the caller muted notifications for this conversation. */
export function isMuted(conversationId: string): boolean {
  return mutedConversations.has(conversationId)
}

/** Mirror a caller-side mute flag (called by the messages view). */
export function setMuted(conversationId: string, muted: boolean): void {
  if (muted) mutedConversations.add(conversationId)
  else mutedConversations.delete(conversationId)
}
