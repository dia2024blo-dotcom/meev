"use client";

// ============================================================
// MEEV — App shell (v2): boot → auth gate → super-app layout.
// I18nProvider (AR/RTL default) + TopBar control deck + PawDock
// paw navigation + animated paw-print background.
// Wires global realtime events (notifications, gifts, level-ups,
// presence) + the activity heartbeat (XP engine).
// ============================================================

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { useMeev, heartbeatTick } from "./store";
import { api, setToken, getToken, refreshSession } from "./api";
import { meevSocket } from "./socket";
import { MeevSplash } from "./logo";
import { useCelebration } from "./celebration";
import { I18nProvider } from "./i18n";
import { TopBar } from "./top-bar";
import { PawDock } from "./paw-dock";
import { AuthView } from "./auth-view";
import { DragRails } from "./drag-rails";
import { restoreThemeBoot } from "./theme-boot";
import { DevGuard } from "./dev-guard";
import type { NotificationDTO, MiniUser } from "./types";
import { isMuted } from "./mute-registry";

const HomeView = dynamic(() => import("./home-view").then((m) => m.HomeView), { ssr: false, loading: () => <ViewLoader /> });
const ExploreView = dynamic(() => import("./explore-view").then((m) => m.ExploreView), { ssr: false, loading: () => <ViewLoader /> });
const LiveView = dynamic(() => import("./live-view").then((m) => m.LiveView), { ssr: false, loading: () => <ViewLoader /> });
const MessagesView = dynamic(() => import("./messages-view").then((m) => m.MessagesView), { ssr: false, loading: () => <ViewLoader /> });
const ServersView = dynamic(() => import("./servers-view").then((m) => m.ServersView), { ssr: false, loading: () => <ViewLoader /> });
const GiftsView = dynamic(() => import("./gifts-view").then((m) => m.GiftsView), { ssr: false, loading: () => <ViewLoader /> });
const NotificationsView = dynamic(() => import("./notifications-view").then((m) => m.NotificationsView), { ssr: false, loading: () => <ViewLoader /> });
const ProfileView = dynamic(() => import("./profile-view").then((m) => m.ProfileView), { ssr: false, loading: () => <ViewLoader /> });
const ShopView = dynamic(() => import("./shop-view").then((m) => m.ShopView), { ssr: false, loading: () => <ViewLoader /> });
const SettingsView = dynamic(() => import("./settings-view").then((m) => m.SettingsView), { ssr: false, loading: () => <ViewLoader /> });
const AdminConsole = dynamic(() => import("./admin-console").then((m) => m.AdminConsole), { ssr: false, loading: () => <ViewLoader /> });

function ViewLoader() {
  return (
    <div className="h-full grid place-items-center">
      <div className="flex flex-col items-center gap-3 opacity-70">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    </div>
  );
}

export function MeevApp() {
  const { booted, authed, view } = useMeev();
  const boot = useMeev((s) => s.boot);
  const setMe = useMeev((s) => s.setMe);
  const { show, node: celebrationNode } = useCelebration();
  const { toast } = useToast();
  const wiredRef = useRef(false);

  // ---------- boot: refresh session, load me (shared single-flight) ----------
  useEffect(() => {
    // v14: clear any v13 accent inline-vars left on <html> (the multi-accent
    // picker is retired — ONE gold identity now) so the stylesheet wins
    restoreThemeBoot();
    let cancelled = false;
    (async () => {
      try {
        const ok = await refreshSession();
        if (ok) {
          setToken(getToken()); // ensure this instance reads the shared sessionStorage token
          const { user } = await api.me();
          if (!cancelled) setMe(user);
        }
      } catch {
        /* offline */
      }
      if (!cancelled) boot();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ---------- global realtime wiring ----------
  useEffect(() => {
    if (!authed || wiredRef.current) return;
    wiredRef.current = true;

    (async () => {
      try {
        await meevSocket.connect();
        useMeev.getState().setSocketConnected(true);
      } catch {
        /* will retry */
      }
    })();

    const off: (() => void)[] = [];
    off.push(
      meevSocket.on("hello:ok", () => useMeev.getState().setSocketConnected(true)),
      meevSocket.on("hello:error", () => useMeev.getState().setSocketConnected(false)),
      meevSocket.on("socket:disconnected", () => useMeev.getState().setSocketConnected(false)),

      meevSocket.on("presence:online-users", (p) => {
        const d = p as { users: MiniUser[] };
        useMeev.getState().setOnlineUsers(d.users || []);
      }),
      meevSocket.on("presence:update", (p) => {
        const d = p as { userId: string; presence: string };
        useMeev.getState().upsertPresence(d.userId, d.presence);
      }),

      meevSocket.on("notif:new", (p) => {
        const n = p as NotificationDTO;
        useMeev.getState().pushNotification(n);
        toast({ title: n.title, description: n.body || undefined, duration: 4000 });
      }),

      meevSocket.on("gift:received", (p) => {
        const d = p as { gift: { gift: { key: string; name: string; mood: string; rarity: string }; sender: { displayName: string } }; coinsCredited?: number };
        const g = d.gift;
        show({
          type: "gift",
          giftKey: g.gift.key,
          giftName: g.gift.name,
          from: g.sender.displayName,
          mood: g.gift.mood,
          rare: g.gift.rarity === "epic" || g.gift.rarity === "legendary",
        });
        useMeev.getState().patchMe({});
      }),

      // v16: live coin balance — a received gift credits instantly
      meevSocket.on("coins:changed", (p) => {
        const d = p as { coins: number; reason?: string; delta?: number };
        if (typeof d.coins === "number") {
          useMeev.getState().patchMe({ coins: d.coins });
        }
      }),

      meevSocket.on("level:up", (p) => {
        const d = p as { level: number };
        show({ type: "level", level: d.level });
        useMeev.getState().patchMe({ level: d.level });
      }),

      meevSocket.on("dm:new", (p) => {
        const d = p as { conversationId: string; message: { author: { id: string; displayName: string } } };
        const state = useMeev.getState();
        if (state.view !== "messages" || state.dmConversation !== d.conversationId) {
          if (d.message.author.id !== state.me?.id && !isMuted(d.conversationId)) {
            // resolve the string from the LIVE store lang — the fallback L()
            // outside the provider would freeze it at mount language
            const sent = state.lang === "en" ? "sent you a message" : "أرسل لك رسالة";
            toast({ title: `💬 ${d.message.author.displayName}`, description: sent, duration: 3000 });
          }
        }
      })
    );

    return () => off.forEach((f) => f());
    // `authed` only: L identity churn here historically unwired every global
    // socket handler right after boot (cleanup ran, the once-only wiredRef
    // guard blocked re-registration). Language is read from the store at
    // event time instead, so no L closure is needed.
  }, [authed]);

  // level-up from local heartbeat
  useEffect(() => {
    const onLevel = (e: Event) => {
      const d = (e as CustomEvent).detail as { level: number };
      show({ type: "level", level: d.level });
    };
    window.addEventListener("meev:levelup", onLevel);
    return () => window.removeEventListener("meev:levelup", onLevel);
  }, []);

  // heartbeat every 60s
  useEffect(() => {
    if (!authed) return;
    const t = setInterval(heartbeatTick, 60_000);
    return () => clearInterval(t);
  }, [authed]);

  if (!booted) return <MeevSplash />;

  return (
    <I18nProvider>
      {/* v16: production code protection (F12 / view-source / context menu) */}
      <DevGuard />
      {/* v14: desktop drag-scroll for every .meev-drag-rail row */}
      <DragRails />
      {!authed ? (
        <AuthView />
      ) : (
        // v18: the living-background canvas (gold dust / stars / shooting
        // star) is REMOVED per user request — it never fit the site and was
        // invisible on the white theme. Back to the clean pure-black /
        // pure-white page + the whisper aurora wash only.
        <div className="h-dvh flex flex-col overflow-hidden bg-background">
          <div className="meev-bg-aurora" />
          <TopBar />

          <main className="flex-1 min-w-0 overflow-hidden relative pt-2 pb-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={view}
                initial={{ opacity: 0, y: 8, scale: 0.995 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className="h-full overflow-hidden"
              >
                {view === "home" && <HomeView />}
                {view === "explore" && <ExploreView />}
                {view === "live" && <LiveView />}
                {view === "messages" && <MessagesView />}
                {view === "servers" && <ServersView />}
                {view === "gifts" && <GiftsView />}
                {view === "notifications" && <NotificationsView />}
                {view === "profile" && <ProfileView />}
                {view === "shop" && <ShopView />}
                {view === "settings" && <SettingsView />}
                {view === "admin" && <AdminConsole />}
              </motion.div>
            </AnimatePresence>
          </main>

          <PawDock />
          {celebrationNode}
        </div>
      )}
    </I18nProvider>
  );
}
