"use client";

// ============================================================
// MEEV v2 — TopBar: floating glass pill with brand, live user
// search (start a DM instantly), PawCoins balance, servers,
// notifications, language toggle, settings + account menu.
// The paw dock handles primary navigation; this handles the
// "control deck".
// ============================================================

import { useEffect, useRef, useState } from "react";
import { useMeev } from "./store";
import { api, ApiError } from "./api";
import { MeevLogo } from "./logo";
import { MeevCat } from "./cat-avatar";
import { MeevName, LevelPill } from "./username";
import { PawCoins } from "./pawcoin";
import { PawMark } from "./symbols";
import { NotifBell } from "./notif-panel";
import { PulseRing } from "./pulse-ring";
import { useI18n } from "./i18n";
import { PRESENCE, type PresenceKey } from "@/lib/meev/constants";
import type { SuggestedUser } from "./types";
import {
  Search, Server, Settings, LogOut, User, Loader2, X, Compass, Terminal, LifeBuoy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function TopBar() {
  const { me, view } = useMeev();
  const setView = useMeev((s) => s.setView);
  const openProfile = useMeev((s) => s.openProfile);
  const openDm = useMeev((s) => s.openDm);
  const setMe = useMeev((s) => s.setMe);
  // v15: my new pulse, unseen by me — my avatar wears the gold
  // Instagram-style ring until I watch my own story
  const myPulseUnseen = useMeev((s) => s.myPulseUnseen);
  const { L } = useI18n();
  const { toast } = useToast();

  const [q, setQ] = useState("");
  const [results, setResults] = useState<SuggestedUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [mobileSearch, setMobileSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // debounced user search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await api.search({ q: q.trim() });
        setResults(r.users.slice(0, 6));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  // close search on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setResults([]);
        setMobileSearch(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const messageUser = async (u: SuggestedUser) => {
    try {
      const r = await api.openDm(u.id);
      setQ("");
      setResults([]);
      openDm(r.conversationId, u.id);
    } catch (e) {
      if (e instanceof ApiError) toast({ title: e.message, variant: "destructive" });
    }
  };

  const doLogout = async () => {
    try {
      await api.logout();
    } catch { /* ignore */ }
    setMe(null);
    toast({
      title: (
        <span className="flex items-center gap-2">
          <PawMark size={16} className="text-amber-500" />
          {L("نسيتك خرجت… تعال بسرعة", "Signed out — come back soon")}
        </span>
      ),
    });
  };

  // v20: any staff rank (support+ — including superadmin) gets MeevCMD
  const isStaff =
    me?.role === "owner" ||
    me?.role === "superadmin" ||
    me?.role === "admin" ||
    me?.role === "support" ||
    me?.role === "moderator";

  const presence = (me?.presence as PresenceKey) || "online";
  const showResults = results.length > 0 || searching;

  const SearchIconBtn = (
    <button
      className="md:hidden size-9 grid place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
      onClick={() => setMobileSearch((v) => !v)}
      aria-label={L("بحث", "Search")}
    >
      {mobileSearch ? <X className="size-5" /> : <Search className="size-5" />}
    </button>
  );

  return (
    <header className="relative z-30 shrink-0">
      <div className="mx-auto max-w-[1400px] px-3 md:px-5 pt-3">
        <div className="h-14 rounded-full glass border-border/60 flex items-center gap-2 px-3 md:px-4 shadow-[0_8px_32px_-12px_rgba(0,0,0,.5)]">
          {/* brand */}
          <button onClick={() => setView("home")} className="flex items-center gap-2.5 shrink-0 group" aria-label="Meev home">
            <span className="meev-float">
              <MeevLogo size={34} mood={view === "home" ? "happy" : "default"} speed={1} />
            </span>
            <span className="hidden sm:block text-xl font-extrabold meev-aurora-text tracking-tight">Meev</span>
          </button>

          {/* search (desktop) */}
          <div ref={searchRef} className="hidden md:flex items-center relative flex-1 max-w-md mx-auto">
            <Search className="absolute start-3 size-4 text-muted-foreground pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, 40))}
              onKeyDown={(e) => e.key === "Escape" && setQ("")}
              placeholder={L("ابحث عن صديق… ابدأ محادثة", "Find a friend… start chatting")}
              className="w-full h-9 rounded-full bg-background/60 border border-border/50 ps-9 pe-3 text-sm outline-none transition-all focus:border-primary/50 focus:shadow-[0_0_20px_-6px_rgba(190,177,92,.45)]"
              aria-label={L("بحث عن مستخدمين", "Search users")}
            />
            {searching && <Loader2 className="absolute end-3 size-4 animate-spin text-muted-foreground" />}

            {showResults && (
              <div className="absolute top-full mt-2 w-full rounded-2xl glass border border-border/60 p-1.5 max-h-80 overflow-y-auto shadow-2xl meev-pop">
                {results.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5 transition-colors">
                    <button onClick={() => openProfile(u.username)} className="flex items-center gap-2.5 min-w-0 flex-1 text-start">
                      <MeevCat seed={u.avatarSeed} fallback={u.id} size={34} level={u.level} presence={u.presence} avatarPhoto={u.avatarPhoto} name={u.displayName} />
                      <span className="min-w-0 flex flex-col">
                        <MeevName displayName={u.displayName} level={u.level} nameColor={u.nameColor} compact />
                        <span className="text-[11px] text-muted-foreground truncate">@{u.username}</span>
                      </span>
                    </button>
                    <button
                      onClick={() => messageUser(u)}
                      className="shrink-0 h-8 px-3 rounded-full meev-gradient-btn text-white text-xs font-bold"
                    >
                      {L("مراسلة", "Chat")}
                    </button>
                  </div>
                ))}
                {results.length === 0 && searching === false && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">{L("لا نتائج… جرّب اسماً آخر", "No friends found… try another name")}</div>
                )}
              </div>
            )}
          </div>

          <div className="flex-1 md:hidden" />

          {/* right cluster */}
          <div className="flex items-center gap-1 md:gap-1.5 shrink-0">
            {SearchIconBtn}

            {/* explore (mobile — no side rail anymore) */}
            <button
              onClick={() => setView("explore")}
              className={cn(
                "md:hidden size-9 grid place-items-center rounded-full transition-colors",
                view === "explore" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              aria-label={L("استكشاف", "Explore")}
              title={L("استكشاف", "Explore")}
            >
              <Compass className="size-5" />
            </button>

            {/* PawCoins balance */}
            <button
              onClick={() => setView("shop")}
              className="hidden sm:flex items-center h-9 px-3 rounded-full bg-amber-500/10 border border-amber-500/30 hover:border-amber-400/60 transition-colors"
              title={L("رصيد ذهب ميف — افتح المتجر", "Gold Meev balance — open the shop")}
              aria-label={L("رصيد ذهب ميف", "Gold Meev balance")}
            >
              <PawCoins amount={me?.coins ?? 0} size={16} />
            </button>

            {/* servers */}
            <button
              onClick={() => setView("servers")}
              className={cn(
                "size-9 grid place-items-center rounded-full transition-colors",
                view === "servers" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              aria-label={L("السيرفرات", "Servers")}
              title={L("السيرفرات", "Servers")}
            >
              <Server className="size-5" />
            </button>

            {/* notifications — small Facebook-style window (v3) */}
            <NotifBell />

            {/* v13: language switcher REMOVED from the main control deck
                (user: "انزع زر تغيير لغة من واجهة اساسية خليه فقط
                فالاعدادات") — it now lives ONLY in Settings → عام */}

            {/* settings */}
            <button
              onClick={() => setView("settings")}
              className={cn(
                "size-9 grid place-items-center rounded-full transition-colors",
                view === "settings" ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
              aria-label={L("الإعدادات", "Settings")}
              title={L("الإعدادات", "Settings")}
            >
              <Settings className="size-5" />
            </button>

            {/* account */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ms-0.5 rounded-full transition-transform hover:scale-105" aria-label={L("حسابي", "Account")}>
                  {/* v15: the gold pulse ring on MY picture — appears the
                      moment I launch a new pulse, melts to transparent once
                      I've watched my story (Instagram, prettier) */}
                  {myPulseUnseen ? (
                    <PulseRing unviewed rest="clear" size={46} label={L("نبضتك الجديدة — شاهدها", "Your new pulse — watch it")}>
                      <MeevCat
                        seed={me?.avatarSeed || ""}
                        fallback={me?.id || "me"}
                        size={36}
                        level={me?.level}
                        presence={presence}
                        avatarPhoto={me?.avatarPhoto}
                        name={me?.displayName}
                      />
                    </PulseRing>
                  ) : (
                    <MeevCat
                      seed={me?.avatarSeed || ""}
                      fallback={me?.id || "me"}
                      size={36}
                      level={me?.level}
                      presence={presence}
                      avatarPhoto={me?.avatarPhoto}
                      name={me?.displayName}
                    />
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end" className="w-60 rounded-2xl glass p-2">
                <div className="px-3 py-2 flex items-center justify-between">
                  <div className="flex flex-col min-w-0">
                    <MeevName displayName={me?.displayName || ""} level={me?.level} nameColor={me?.nameColor} compact role={me?.role} verified={me?.verified} />
                    <span className="text-xs text-muted-foreground truncate">@{me?.username}</span>
                  </div>
                  <LevelPill level={me?.level ?? 0} />
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => openProfile("me")} className="gap-2 rounded-xl cursor-pointer">
                  <User className="size-4" /> {L("ملفي الشخصي", "My profile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setView("shop")} className="gap-2 rounded-xl cursor-pointer">
                  <PawCoins amount={me?.coins ?? 0} size={14} /> {L("متجر ميف", "Meev Shop")}
                </DropdownMenuItem>
                {isStaff && (
                  <DropdownMenuItem onClick={() => setView("admin")} className="gap-2 rounded-xl cursor-pointer">
                    <Terminal className="size-4 text-emerald-400" />
                    <span className="font-bold">MeevCMD</span>
                    <span className="ms-auto text-[9px] font-mono text-muted-foreground">{me?.role}</span>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setView("settings")} className="gap-2 rounded-xl cursor-pointer">
                  <LifeBuoy className="size-4" /> {L("الدعم والإعدادات", "Support & settings")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={doLogout} className="gap-2 rounded-xl cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="size-4" /> {L("تسجيل الخروج", "Sign out")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* mobile expanded search */}
        {mobileSearch && (
          <div ref={searchRef} className="md:hidden mt-2 rounded-2xl glass border-border/60 p-2 meev-pop">
            <div className="relative">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value.slice(0, 40))}
                placeholder={L("ابحث عن صديق…", "Find a friend…")}
                className="w-full h-10 rounded-xl bg-background/60 border border-border/50 ps-9 pe-3 text-sm outline-none focus:border-primary/50"
                aria-label={L("بحث عن مستخدمين", "Search users")}
              />
            </div>
            {showResults && (
              <div className="mt-1.5 max-h-72 overflow-y-auto">
                {results.map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5">
                    <button onClick={() => { openProfile(u.username); setMobileSearch(false); }} className="flex items-center gap-2.5 min-w-0 flex-1 text-start">
                      <MeevCat seed={u.avatarSeed} fallback={u.id} size={34} level={u.level} presence={u.presence} avatarPhoto={u.avatarPhoto} name={u.displayName} />
                      <span className="min-w-0 flex flex-col">
                        <MeevName displayName={u.displayName} level={u.level} nameColor={u.nameColor} compact />
                        <span className="text-[11px] text-muted-foreground truncate">@{u.username}</span>
                      </span>
                    </button>
                    <button onClick={() => messageUser(u)} className="shrink-0 h-8 px-3 rounded-full meev-gradient-btn text-white text-xs font-bold">
                      {L("مراسلة", "Chat")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
