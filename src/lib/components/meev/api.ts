"use client";

// MEEV — API client: Bearer token, auto-refresh on 401, typed helpers.

import type {
  AuthResponse,
  CommentDTO,
  Conversation,
  GiftCatalogItem,
  GiftDTO,
  MessageDTO,
  MiniUser,
  NotificationDTO,
  PostDTO,
  PublicUser,
  ReactionCounts,
  ReactionKind,
  ServerDTO,
  SessionInfo,
  ShopItemDTO,
  SpinResult,
  SuggestedUser,
  StoryDTO,
  StoryGroup,
  StoryViewerEntry,
  SupportTicketDTO,
  XpMe,
} from "./types";

let accessToken: string | null = null;

// Token lives in sessionStorage so every lazily-loaded chunk (which may hold
// its own module instance of this file) shares the same token.
export function setToken(t: string | null) {
  accessToken = t;
  try {
    if (t) sessionStorage.setItem("meev_at", t);
    else sessionStorage.removeItem("meev_at");
  } catch { /* private mode */ }
}
export function getToken() {
  if (accessToken) return accessToken;
  try {
    accessToken = sessionStorage.getItem("meev_at");
  } catch { /* noop */ }
  return accessToken;
}

type GlobalRefresh = { promise: Promise<boolean> | null };
const g = globalThis as unknown as { __meevRefresh?: GlobalRefresh };
g.__meevRefresh ??= { promise: null };

// Exported for the socket client (shared single-flight handshake refresh).
export const refreshSession = refresh;

async function refresh(): Promise<boolean> {
  // single-flight across ALL module instances (window-level guard)
  if (!g.__meevRefresh!.promise) {
    g.__meevRefresh!.promise = fetch("/api/auth/refresh", { method: "POST", credentials: "include" })
      .then(async (r) => {
        if (!r.ok) return false;
        const data = (await r.json()) as AuthResponse;
        setToken(data.accessToken);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        setTimeout(() => (g.__meevRefresh!.promise = null), 150);
      });
  }
  return g.__meevRefresh!.promise;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit & { retry?: boolean }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}),
      ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers || {}),
    },
    credentials: "include",
  });

  // On 401 always attempt one silent refresh — the HttpOnly cookie is the
  // source of truth and is shared across all lazy-loaded chunks.
  if (res.status === 401 && !("retry" in (init ?? {}))) {
    const ok = await refresh();
    if (ok) return request<T>(path, { ...init, retry: true } as never);
  }

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-json */
  }

  if (!res.ok) {
    const message = (data as { error?: string } | null)?.error || `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  // ---- auth ----
  register: (body: { username: string; email: string; password: string; displayName?: string; interests?: string[] }) =>
    request<AuthResponse>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  verifyEmail: (body: { email: string; code: string }) =>
    request<{ user: PublicUser }>("/api/auth/verify-email", { method: "POST", body: JSON.stringify(body) }),
  resendOtp: (body: { email: string; purpose?: string }) =>
    request<{ devOtp: { code: string; purpose: string; expiresAt: string } }>("/api/auth/resend-otp", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { identifier: string; password: string; otp?: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  guest: () => request<AuthResponse>("/api/auth/guest", { method: "POST" }),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  // v10: self-service account deletion (password + exact username confirm)
  deleteAccount: (body: { password: string; confirm: string }) =>
    request<{ ok: true; deleted: string }>("/api/users/me", { method: "DELETE", body: JSON.stringify(body) }),
  me: () => request<{ user: PublicUser }>("/api/auth/me"),
  forgotPassword: (body: { email: string }) =>
    request<{ ok: true; devOtp?: { code: string } }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify(body) }),
  resetPassword: (body: { email: string; code: string; newPassword: string }) =>
    request<{ ok: true }>("/api/auth/reset-password", { method: "POST", body: JSON.stringify(body) }),
  set2fa: (enabled: boolean) => request<{ ok: true; enabled: boolean }>("/api/auth/2fa", { method: "POST", body: JSON.stringify({ enabled }) }),
  sessions: () => request<{ sessions: SessionInfo[] }>("/api/auth/sessions"),
  revokeSession: (id: string) => request<{ ok: true }>(`/api/auth/sessions/${id}`, { method: "DELETE" }),

  // ---- users ----
  updateMe: (body: Record<string, unknown>) => request<{ user: PublicUser }>("/api/users/me", { method: "PATCH", body: JSON.stringify(body) }),
  getUser: (username: string) =>
    request<{ user: PublicUser; relationship: { following: boolean; isFollowingMe: boolean; friendship: string } }>(`/api/users/${username}`),
  getUserPosts: (username: string, page = 1) => request<{ posts: PostDTO[]; hasMore: boolean }>(`/api/users/${username}/posts?page=${page}`),
  search: (body: { q?: string; interest?: string; online?: boolean; city?: string; page?: number }) =>
    request<{ users: SuggestedUser[] }>("/api/users/search", { method: "POST", body: JSON.stringify(body) }),
  suggestions: () => request<{ users: SuggestedUser[] }>("/api/users/suggestions"),
  follow: (id: string) => request<{ following: boolean }>(`/api/users/${id}/follow`, { method: "POST" }),
  unfollow: (id: string) => request<{ following: boolean }>(`/api/users/${id}/follow`, { method: "DELETE" }),
  friendRequest: (id: string) => request<{ status: string }>(`/api/users/${id}/friend-request`, { method: "POST" }),
  friendRespond: (id: string, accept: boolean) =>
    request<{ status: string }>(`/api/users/${id}/friend-respond`, { method: "POST", body: JSON.stringify({ accept }) }),
  block: (id: string) => request<{ blocked: boolean }>(`/api/users/${id}/block`, { method: "POST" }),
  unblock: (id: string) => request<{ blocked: boolean }>(`/api/users/${id}/block`, { method: "DELETE" }),
  report: (body: { targetType: string; targetUserId?: string; targetId?: string; reason: string; details?: string }) =>
    request<{ ok: true }>("/api/users/report", { method: "POST", body: JSON.stringify(body) }),

  // ---- posts ----
  feed: (page = 1, filter: "all" | "following" = "all") => request<{ posts: PostDTO[]; hasMore: boolean }>(`/api/posts/feed?page=${page}&filter=${filter}`),
  createPost: (body: { content: string; imageUrl?: string }) => request<{ post: PostDTO }>("/api/posts", { method: "POST", body: JSON.stringify(body) }),
  deletePost: (id: string) => request<{ ok: true }>(`/api/posts/${id}`, { method: "DELETE" }),
  // v13: Facebook-style reactions — POST sets/switches/toggles-off one reaction
  react: (id: string, kind: ReactionKind) =>
    request<{ liked: boolean; kind: ReactionKind | null; counts: ReactionCounts; total: number }>(`/api/posts/${id}/like`, {
      method: "POST",
      body: JSON.stringify({ kind }),
    }),
  like: (id: string) =>
    request<{ liked: boolean; kind: ReactionKind | null; counts: ReactionCounts; total: number }>(`/api/posts/${id}/like`, {
      method: "POST",
      body: JSON.stringify({ kind: "like" }),
    }),
  unlike: (id: string) =>
    request<{ liked: boolean; kind: ReactionKind | null; counts: ReactionCounts; total: number }>(`/api/posts/${id}/like`, { method: "DELETE" }),
  comments: (id: string) => request<{ comments: CommentDTO[] }>(`/api/posts/${id}/comments`),
  addComment: (id: string, content: string) => request<{ comment: CommentDTO }>(`/api/posts/${id}/comments`, { method: "POST", body: JSON.stringify({ content }) }),
  trending: () => request<{ posts: PostDTO[] }>("/api/posts/trending"),
  // v13: share a post with friends (Facebook-style)
  shareTargets: (postId: string) => request<{ friends: (MiniUser & { isFriend: boolean })[] }>(`/api/posts/${postId}/share`),
  sharePost: (postId: string, targetUserId: string) =>
    request<{ ok: true; conversationId: string; message: MessageDTO }>(`/api/posts/${postId}/share`, {
      method: "POST",
      body: JSON.stringify({ targetUserId }),
    }),

  // ---- stories ----
  stories: () => request<{ groups: StoryGroup[]; myStories: StoryDTO[] }>("/api/stories"),
  createStory: (body: { kind: "text" | "image"; content?: string; gradient?: string; imageUrl?: string; vibe?: string }) =>
    request<{ story: unknown }>("/api/stories", { method: "POST", body: JSON.stringify(body) }),
  viewStory: (id: string) => request<{ ok: true }>(`/api/stories/${id}/view`, { method: "POST" }),
  // v8: delete one of MY stories (author-only, server-checked)
  deleteStory: (id: string) => request<{ ok: true; storyId: string }>(`/api/stories/${id}`, { method: "DELETE" }),
  // v6: Instagram-style viewers list ("vu") — own stories only
  storyViewers: (id: string) => request<{ count: number; viewers: StoryViewerEntry[] }>(`/api/stories/${id}/viewers`),
  // v6: Instagram-style story reaction (quick emoji) or text reply → DM
  storyReact: (id: string, body: { emoji?: string; text?: string }) =>
    request<{ ok: true; conversationId: string; message: MessageDTO }>(`/api/stories/${id}/react`, { method: "POST", body: JSON.stringify(body) }),

  // ---- dms ----
  conversations: () => request<{ conversations: Conversation[] }>("/api/dms"),
  openDm: (targetUserId: string) => request<{ conversationId: string }>("/api/dms", { method: "POST", body: JSON.stringify({ targetUserId }) }),
  dmMessages: (id: string) =>
    request<{ messages: MessageDTO[]; partner: MiniUser; hasMore: boolean; streakDays?: number; themeKey?: string; muted?: boolean; partnerReadAt?: string | null }>(`/api/dms/${id}/messages`),
  // ---- v3: chat settings (streak themes / mute / delete for me) ----
  dmSettings: (id: string, body: { themeKey?: string; muted?: boolean }) =>
    request<{ ok: true; streakDays?: number; themeKey?: string; muted?: boolean }>(`/api/dms/${id}/settings`, { method: "PATCH", body: JSON.stringify(body) }),
  deleteDm: (id: string) => request<{ ok: true }>(`/api/dms/${id}`, { method: "DELETE" }),

  // ---- servers ----
  servers: () => request<{ servers: ServerDTO[] }>("/api/servers"),
  createServer: (body: { name: string; description?: string; iconEmoji?: string; accentColor?: string }) =>
    request<{ server: ServerDTO }>("/api/servers", { method: "POST", body: JSON.stringify(body) }),
  joinServer: (id: string) => request<{ ok: true }>(`/api/servers/${id}/join`, { method: "POST" }),
  leaveServer: (id: string) => request<{ ok: true }>(`/api/servers/${id}/leave`, { method: "POST" }),
  createChannel: (id: string, name: string) => request<{ channel: unknown }>(`/api/servers/${id}/channels`, { method: "POST", body: JSON.stringify({ name }) }),
  channelMessages: (serverId: string, channelId: string) =>
    request<{ messages: MessageDTO[]; hasMore: boolean }>(`/api/servers/${serverId}/channels/${channelId}/messages`),
  serverMembers: (id: string) => request<{ members: { user: import("./types").MiniUser; role: string }[] }>(`/api/servers/${id}/members`),

  // ---- gifts ----
  giftCatalog: () => request<{ gifts: GiftCatalogItem[] }>("/api/gifts/catalog"),
  sendGift: (body: { giftKey: string; recipientId: string; note?: string; contextType?: "dm" | "live"; contextId?: string }) =>
    request<{ gift: GiftDTO; coinsLeft: number; coinsCredited: number; remainingToday: number }>("/api/gifts/send", { method: "POST", body: JSON.stringify(body) }),
  giftHistory: () => request<{ sent: GiftDTO[]; received: GiftDTO[] }>("/api/gifts/history"),

  // ---- notifications ----
  notifications: () => request<{ notifications: NotificationDTO[]; unread: number }>("/api/notifications"),
  readNotifications: (ids?: string[]) => request<{ ok: true; unread: number }>("/api/notifications/read", { method: "POST", body: JSON.stringify(ids ? { ids } : {}) }),

  // ---- xp ----
  heartbeat: (activeSeconds: number) =>
    request<{ xp: number; level: number; coins: number; coinsCredited: number; activeSeconds: number; nextHourProgress: number; leveledUp: boolean }>("/api/xp/heartbeat", { method: "POST", body: JSON.stringify({ activeSeconds }) }),
  xpMe: () => request<XpMe>("/api/xp/me"),
  leaderboard: () => request<{ entries: { user: import("./types").MiniUser; xp: number; level: number }[] }>("/api/xp/leaderboard"),

  // ---- media ----
  upload: (file: File, opts?: { square?: boolean }) => {
    const fd = new FormData();
    fd.append("file", file);
    // v7: square=1 → subject-aware 512×512 crop so profile photos fill
    // every circular avatar frame with a balanced composition
    if (opts?.square) fd.append("square", "1");
    return request<{ url: string; fallbackUrl: string; thumbUrl: string; width: number; height: number; bytes: number }>("/api/media/upload", {
      method: "POST",
      body: fd,
    });
  },
  // v7: real-time DM translation — messageId → { translation } in MY language
  translateMessage: (convId: string, messageId: string) =>
    request<{ translation: string }>(`/api/dms/${convId}/translate`, { method: "POST", body: JSON.stringify({ messageId }) }),
  tts: (text: string) => request<{ audioUrl: string }>("/api/media/tts", { method: "POST", body: JSON.stringify({ text }) }),

  // ---- games ----
  xoResult: (opponentId: string, won: boolean) =>
    request<{ ok: true }>("/api/games/xo/result", { method: "POST", body: JSON.stringify({ opponentId, won }) }),

  // ---- v2: shop (PawCoins economy) ----
  shopCatalog: () => request<{ items: ShopItemDTO[] }>("/api/shop/catalog"),
  purchase: (itemKey: string) =>
    request<{ item: ShopItemDTO; coinsLeft: number; xpGained: number; level: number; leveledUp: boolean }>("/api/shop/purchase", {
      method: "POST",
      body: JSON.stringify({ itemKey }),
    }),
  equip: (itemKey: string, equipped: boolean) =>
    request<{ items: ShopItemDTO[]; user: PublicUser }>("/api/shop/equip", { method: "POST", body: JSON.stringify({ itemKey, equipped }) }),

  // ---- v2: blocklist ----
  blocklist: () => request<{ blocked: MiniUser[] }>("/api/users/blocklist"),

  // ---- v2: support tickets ----
  supportCreate: (body: { subject: string; category: string; message: string }) =>
    request<{ ticket: SupportTicketDTO }>("/api/support", { method: "POST", body: JSON.stringify(body) }),
  supportList: () => request<{ tickets: SupportTicketDTO[] }>("/api/support"),

  // ---- v2: daily spin ----
  spin: () => request<SpinResult>("/api/rewards/spin", { method: "POST" }),

  // ---- v5: MeevCMD staff console ----
  adminCommand: (command: string) =>
    request<{ ok: boolean; lines: string[] }>("/api/admin/command", { method: "POST", body: JSON.stringify({ command }) }),
  adminLogs: (page = 1) =>
    request<{ logs: { id: string; action: string; actionAr: string; summary: string; by: string; createdAt: string }[] }>(
      `/api/admin/logs?page=${page}`,
    ),
};
