"use client";

// MEEV — Realtime client: socket.io through the sandbox gateway
// (`/?XTransformPort=3003`, path '/'), auto-reconnect, typed events.

import { io, type Socket } from "socket.io-client";
import { getToken, refreshSession } from "./api";
import type { MessageDTO, MiniUser, GameXO } from "./types";

type Handler = (payload: unknown) => void;

class MeevSocket {
  private socket: Socket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private connectPromise: Promise<Socket> | null = null;

  on(event: string, fn: Handler) {
    // v2 fix: ONLY book-keep in the map — connect() already registers one
    // relay listener per event that fans out via dispatch(). Registering a
    // direct socket listener here as well made every handler fire TWICE
    // (once via the relay, once via the direct wrapper), which duplicated
    // appended messages (e.g. AI stranger replies in live rooms).
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(fn);
    return () => this.off(event, fn);
  }

  off(event: string, fn: Handler) {
    this.handlers.get(event)?.delete(fn);
  }

  emit(event: string, payload?: unknown) {
    this.socket?.emit(event, payload);
  }

  get connected() {
    return !!this.socket?.connected;
  }

  connect(): Promise<Socket> {
    if (this.socket?.connected) return Promise.resolve(this.socket);
    if (this.connectPromise) return this.connectPromise;

    this.connectPromise = new Promise<Socket>((resolve, reject) => {
      // v11 fix: the URL must be ABSOLUTE in the browser. The old relative
      // form ("/?XTransformPort=3003") parsed fine but the query could be
      // dropped by socket.io-client's URL normalization in the browser,
      // making Caddy forward the socket to Next (:3000) instead of the
      // realtime service (:3003) — the room queue silently never paired.
      // An absolute URL (page origin + query) keeps the transform query
      // alive all the way to the gateway.
      const wsUrl =
        typeof window !== "undefined"
          ? `${window.location.origin}/?XTransformPort=3003`
          : "/?XTransformPort=3003";
      const socket = io(wsUrl, {
        path: "/",
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1200,
        reconnectionDelayMax: 6000,
        timeout: 12000,
      });
      this.socket = socket;

      socket.on("connect", () => {
        socket.emit("hello", { token: getToken() });
      });

      socket.on("hello:ok", (payload: { user: MiniUser }) => {
        resolve(socket);
        this.dispatch("hello:ok", payload);
      });

      socket.on("hello:error", async () => {
        // token expired/missing — silent refresh through the shared
        // single-flight refresh, then retry the handshake once.
        const ok = await refreshSession();
        if (ok) {
          socket.emit("hello", { token: getToken() });
        } else {
          this.dispatch("hello:error", {});
          reject(new Error("auth failed"));
        }
      });

      const relayEvents = [
        "presence:update",
        "presence:online-users",
        "dm:new",
        "dm:typing",
        // v6/v8: dm:read was broadcast by the API but missing from this
        // allowlist (the "vu" ticks only updated on refetch); match:effect
        // is the v8 live-effects relay — both now actually reach the app.
        "dm:read",
        "server:new",
        "server:typing",
        "match:waiting",
        "match:found",
        "match:new",
        "match:typing",
        "match:effect",
        "match:partner-left",
        "match:ended",
        "match:summary",
        "match:report:ok",
        "dm:game:state",
        "game:error",
        "msg:error",
        "notif:new",
        "gift:received",
        "level:up",
      ];
      for (const ev of relayEvents) {
        socket.on(ev, (payload: unknown) => this.dispatch(ev, payload));
      }

      socket.on("disconnect", () => {
        this.dispatch("socket:disconnected", {});
        // v2 fix: clear the stale promise so the next connect() call after a
        // disconnect (e.g. HMR full remount) actually reconnects instead of
        // resolving a dead socket.
        this.connectPromise = null;
      });
      socket.on("reconnect", () => {
        socket.emit("hello", { token: getToken() });
      });
    });

    return this.connectPromise;
  }

  private dispatch(event: string, payload: unknown) {
    this.handlers.get(event)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error("socket handler error", event, e);
      }
    });
  }

  // ---- typed helpers ----
  joinDm(conversationId: string) {
    this.emit("dm:join", { conversationId });
  }
  leaveDm(conversationId: string) {
    this.emit("dm:leave", { conversationId });
  }
  sendDm(conversationId: string, content: string, kind = "text", meta?: unknown, attachmentUrl?: string) {
    this.emit("dm:send", { conversationId, content, kind, meta, attachmentUrl });
  }
  dmTyping(conversationId: string) {
    this.emit("dm:typing", { conversationId });
  }
  joinServerChannel(channelId: string) {
    this.emit("server:join", { channelId });
  }
  leaveServerChannel(channelId: string) {
    this.emit("server:leave", { channelId });
  }
  sendServer(channelId: string, content: string, kind = "text", meta?: unknown, attachmentUrl?: string) {
    this.emit("server:send", { channelId, content, kind, meta, attachmentUrl });
  }
  serverTyping(channelId: string) {
    this.emit("server:typing", { channelId });
  }
  setPresence(status: "online" | "busy" | "dnd" | "offline") {
    this.emit("presence:set", { status });
  }
  queueMatch(mode: "text" | "video", interests?: string[]) {
    this.emit("match:queue", { mode, interests });
  }
  sendMatch(matchId: string, content: string) {
    this.emit("match:send", { matchId, content });
  }
  matchTyping(matchId: string) {
    this.emit("match:typing", { matchId });
  }
  /** v8: TikTok-style live effect — an emoji floats up the room for both */
  matchEffect(matchId: string, emoji: string) {
    this.emit("match:effect", { matchId, emoji });
  }
  skipMatch(matchId: string, requeue = false) {
    this.emit("match:skip", { matchId, requeue });
  }
  endMatch(matchId: string) {
    this.emit("match:end", { matchId });
  }
  reportMatch(matchId: string, reason: string) {
    this.emit("match:report", { matchId, reason });
  }
  startGame(conversationId: string) {
    this.emit("dm:game:start", { conversationId });
  }
  gameMove(conversationId: string, cell: number) {
    this.emit("dm:game:move", { conversationId, cell });
  }
  leaveGame(conversationId: string) {
    this.emit("dm:game:leave", { conversationId });
  }
}

export type { MessageDTO, GameXO };
export const meevSocket = new MeevSocket();
