"use client";

// MEEV — Global client state (Zustand): auth, active view,
// presence map, notifications, heartbeat activity tracking.

import { create } from "zustand";
import type { PublicUser, NotificationDTO, MiniUser } from "./types";
import { setToken } from "./api";

export type ViewId =
  | "home" | "explore" | "live" | "messages" | "servers" | "gifts" | "notifications" | "profile" | "shop" | "settings" | "admin";

export type Lang = "ar" | "en" | "fr" | "es" | "tr" | "de";

// v10 note: ProfileTarget is a plain username string ("me" = own profile).
// It was previously declared as { username } | "me" but EVERY consumer
// (ProfileView, setView arg) treats it as a raw string — the object form
// silently broke other-user profiles (they fell back to "me").
export type ProfileTarget = string;

interface MeevState {
  booted: boolean;
  authed: boolean;
  me: PublicUser | null;
  view: ViewId;
  profileTarget: ProfileTarget;
  onlineUsers: Map<string, MiniUser>;
  notifications: NotificationDTO[];
  unread: number;
  socketConnected: boolean;
  dmConversation: string | null; // open conversation in messages view
  dmPartnerId: string | null;
  serverId: string | null;
  channelId: string | null;
  theme: string;
  lang: Lang; // v5 — AR default + EN/FR/ES/TR/DE, full RTL for Arabic
  myPulseUnseen: boolean; // v15 — my own pulse is live + unwatched (gold ring on my avatar)

  boot: () => void;
  setAuthed: (v: boolean) => void;
  setMe: (u: PublicUser | null) => void;
  patchMe: (patch: Partial<PublicUser>) => void;
  setView: (v: ViewId, arg?: string) => void;
  openProfile: (username: string | "me") => void;
  openDm: (conversationId: string | null, partnerId?: string | null) => void;
  openServer: (serverId: string | null, channelId?: string | null) => void;
  setOnlineUsers: (users: MiniUser[]) => void;
  upsertPresence: (userId: string, presence: string) => void;
  setNotifications: (n: NotificationDTO[], unread: number) => void;
  pushNotification: (n: NotificationDTO) => void;
  markAllRead: () => void;
  setSocketConnected: (v: boolean) => void;
  setLang: (l: Lang, persist?: boolean) => void;
  setMyPulseUnseen: (v: boolean) => void;
  clearAll: () => void;
}

export const useMeev = create<MeevState>((set, get) => ({
  booted: false,
  authed: false,
  me: null,
  view: "home",
  profileTarget: "me",
  onlineUsers: new Map(),
  notifications: [],
  unread: 0,
  socketConnected: false,
  dmConversation: null,
  dmPartnerId: null,
  serverId: null,
  channelId: null,
  theme: "dark",
  myPulseUnseen: false,
  lang: (() => {
    try {
      const saved = localStorage.getItem("meev_lang") || "";
      if (saved === "en" || saved === "fr" || saved === "es" || saved === "tr" || saved === "de") return saved;
      return "ar";
    } catch {
      return "ar";
    }
  })() as Lang,

  boot: () => set({ booted: true }),
  setAuthed: (v) => set({ authed: v }),
  setMe: (u) => {
    setToken(null);
    // adopt the profile language once at sign-in (v2 i18n)
    const profileLang = u?.lang;
    if (
      profileLang &&
      (profileLang === "ar" || profileLang === "en" || profileLang === "fr" || profileLang === "es" || profileLang === "tr" || profileLang === "de") &&
      profileLang !== get().lang
    ) {
      set({ lang: profileLang, me: u, authed: !!u });
      get().setLang(profileLang, false);
      return;
    }
    set({ me: u, authed: !!u });
  },
  patchMe: (patch) => set((s) => (s.me ? { me: { ...s.me, ...patch } } : {})),
  setView: (v, arg) =>
    set((s) => {
      const base = { view: v as ViewId };
      if (v === "messages" && arg !== undefined) {
        return { ...base, dmConversation: arg || null, dmPartnerId: null };
      }
      if (v === "profile") return { ...base, profileTarget: (arg as ProfileTarget) || "me" };
      return base;
    }),
  openProfile: (username) => set({ view: "profile", profileTarget: username }),
  openDm: (conversationId, partnerId) =>
    set({ view: "messages", dmConversation: conversationId, dmPartnerId: partnerId ?? null }),
  openServer: (serverId, channelId) => set({ view: "servers", serverId, channelId: channelId ?? null }),
  setOnlineUsers: (users) => set({ onlineUsers: new Map(users.map((u) => [u.id, u])) }),
  upsertPresence: (userId, presence) => {
    const map = new Map(get().onlineUsers);
    const existing = map.get(userId);
    if (presence === "offline") {
      if (existing) map.delete(userId);
    } else if (existing) {
      map.set(userId, { ...existing, presence });
    }
    set({ onlineUsers: map });
  },
  setNotifications: (n, unread) => set({ notifications: n, unread }),
  pushNotification: (n) =>
    set((s) => ({
      notifications: [n, ...s.notifications].slice(0, 60),
      unread: s.unread + 1,
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unread: 0,
    })),
  setSocketConnected: (v) => set({ socketConnected: v }),
  setMyPulseUnseen: (v) => set({ myPulseUnseen: v }),
  setLang: (l, persist = true) => {
    set({ lang: l });
    try {
      if (persist) localStorage.setItem("meev_lang", l);
    } catch { /* private mode */ }
    if (typeof document !== "undefined") {
      document.documentElement.lang = l;
      document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
    }
    // persist to the user profile (fire-and-forget)
    if (persist && get().authed) {
      void import("./api").then(({ api }) =>
        api.updateMe({ lang: l }).catch(() => null)
      );
    }
  },
  clearAll: () =>
    set({
      authed: false,
      me: null,
      onlineUsers: new Map(),
      notifications: [],
      unread: 0,
      view: "home",
      dmConversation: null,
      dmPartnerId: null,
      serverId: null,
      channelId: null,
      myPulseUnseen: false,
    }),
}));

// ---------------- Activity heartbeat (XP engine, spec §6) ----------------
// Tracks real interaction (clicks/keys) + visibility, posts a heartbeat
// every 60s only when the user was genuinely active.

let lastBeat = 0;
let activityScore = 0;

if (typeof window !== "undefined") {
  const bump = () => {
    if (document.visibilityState === "visible") activityScore += 1;
  };
  window.addEventListener("click", bump, { passive: true });
  window.addEventListener("keydown", bump, { passive: true });
  window.addEventListener("touchstart", bump, { passive: true });
}

export async function heartbeatTick() {
  const now = Date.now();
  if (now - lastBeat < 60_000) return;
  lastBeat = now;
  const state = useMeev.getState();
  if (!state.authed) return;
  const active = activityScore >= 3 && document.visibilityState === "visible";
  activityScore = 0;
  if (!active) return;
  try {
    const { api } = await import("./api");
    const r = await api.heartbeat(60);
    const prevLevel = state.me?.level ?? 0;
    // v16: the beat carries both the hourly point AND the scarce coin trickle
    state.patchMe({ xp: r.xp, level: r.level, coins: r.coins });
    if (r.level > prevLevel) {
      window.dispatchEvent(new CustomEvent("meev:levelup", { detail: { level: r.level } }));
    }
    if (r.coinsCredited > 0) {
      // a gentle, quiet coin notice — the currency stays "hard" but earned
      window.dispatchEvent(new CustomEvent("meev:coins", { detail: { coins: r.coins, delta: r.coinsCredited } }));
    }
  } catch {
    /* offline — skip */
  }
}
