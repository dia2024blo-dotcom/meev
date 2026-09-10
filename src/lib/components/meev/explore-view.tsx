"use client";

// MEEV — Explore/Discover: friend suggestions powered by the
// similarity engine, user search with filters, trending posts,
// and active communities.
//
// v17: the page is now FULLY localized — the tabs, search bar,
// suggestion cards, toasts and room cards all speak the active
// language (ar inline, fr/es/tr/de via i18n-dict, EN fallback).
// Interpolated strings use a {count}/{name}/{members} pattern
// that is translated first, then substituted.

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { interestLabel } from "./i18n-dict";
import { MeevCat } from "./cat-avatar";
import { MeevName, LevelPill } from "./username";
import { MeevLogo } from "./logo";
import { timeAgo } from "./chat-shared";
import { INTERESTS } from "@/lib/meev/constants";
import type { SuggestedUser, PostDTO, ServerDTO } from "./types";
import { cn } from "@/lib/utils";
import { Search, UserPlus, Check, Flame, MapPin, Users, Compass, Heart, MessageCircle, Zap, Link2, PartyPopper, Trophy } from "lucide-react";

function SuggestionCard({ user }: { user: SuggestedUser }) {
  const openProfile = useMeev((s) => s.openProfile);
  const openDm = useMeev((s) => s.openDm);
  const { L, lang } = useI18n();
  const { toast } = useToast();
  const [state, setState] = useState<"idle" | "following" | "requested" | "friends">("idle");

  const follow = async () => {
    try {
      await api.follow(user.id);
      setState("following");
      toast({
        title: (
          <span className="flex items-center gap-2">
            <UserPlus className="size-4 text-primary" aria-hidden="true" />
            {L("تتابع {name} الآن", "Following {name}").replace("{name}", user.displayName)}
          </span>
        ),
      });
    } catch (e) {
      toast({ title: L("فشل", "Failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const addFriend = async () => {
    try {
      const r = await api.friendRequest(user.id);
      setState(r.status === "friends" ? "friends" : "requested");
      toast({
        title: r.status === "friends" ? (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            {L("أنت و{name} أصبحتم أصدقاء!", "You and {name} are now friends!").replace("{name}", user.displayName)}
          </span>
        ) : L("تم إرسال طلب صداقة إلى {name}", "Friend request sent to {name}").replace("{name}", user.displayName),
      });
    } catch (e) {
      toast({ title: L("فشل", "Failed"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const message = async () => {
    try {
      const r = await api.openDm(user.id);
      openDm(r.conversationId, user.id);
    } catch (e) {
      toast({ title: L("تعذّر فتح المحادثة", "Couldn't open chat"), description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  const shared = user.sharedInterests?.slice(0, 3) || [];
  const sharedFirst = INTERESTS.find((i) => i.key === shared[0]);
  const mutualLabel =
    user.mutualCount === 1
      ? L("صديق مشترك واحد", "1 mutual")
      : L("{count} أصدقاء مشتركين", "{count} mutual").replace("{count}", String(user.mutualCount));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl p-4 hover:border-primary/30 transition-colors group"
    >
      <div className="flex items-start gap-3">
        <button onClick={() => openProfile(user.username)} aria-label={L("فتح ملف {name}", "Open {name}").replace("{name}", user.displayName)}>
          <MeevCat seed={user.avatarSeed} fallback={user.id} size={56} level={user.level} presence={user.presence} avatarPhoto={user.avatarPhoto} frameKey={user.frameKey} avatarAcc={user.avatarAcc} name={user.displayName} />
        </button>
        <div className="flex-1 min-w-0">
          <button onClick={() => openProfile(user.username)} className="flex items-center gap-1.5 flex-wrap text-left">
            <MeevName displayName={user.displayName} level={user.level} nameColor={user.nameColor} nameFx={user.nameFx} />
            <LevelPill level={user.level} />
          </button>
          <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
            <span>@{user.username}</span>
            {user.city && (
              <span className="inline-flex items-center gap-0.5"><MapPin className="size-3" /> {user.city}</span>
            )}
          </div>
          {/* match reasons */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] text-primary font-semibold">
              {L("{count}٪ تطابق", "{count}% match").replace("{count}", String(Math.round(user.score * 100)))}
            </span>
            {shared.length > 0 && sharedFirst && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] text-amber-400 font-semibold">
                <Link2 className="size-3" aria-hidden="true" /> {interestLabel(sharedFirst.key, sharedFirst.label, lang)}
                {shared.length > 1 && ` +${shared.length - 1}`}
              </span>
            )}
            {user.mutualCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] text-emerald-400 font-semibold">
                <Users className="size-3" aria-hidden="true" /> {mutualLabel}
              </span>
            )}
          </div>
          {user.bio && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{user.bio}</p>}
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <Button size="sm" className="rounded-xl h-8 text-xs meev-gradient-btn text-white gap-1.5 flex-1" onClick={addFriend} disabled={state === "requested" || state === "friends"}>
          {state === "friends" ? <><Check className="size-3.5" /> {L("أصدقاء", "Friends")}</> : state === "requested" ? <><Check className="size-3.5" /> {L("تم الطلب", "Requested")}</> : <><UserPlus className="size-3.5" /> {L("أضف صديقاً", "Add friend")}</>}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5" onClick={follow} disabled={state === "following"}>
          {state === "following" ? <><Check className="size-3.5" /> {L("يتابِع", "Following")}</> : L("تابِع", "Follow")}
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl h-8 text-xs gap-1.5" onClick={message}>
          {L("رسالة", "Message")}
        </Button>
      </div>
    </motion.div>
  );
}

export function ExploreView() {
  const { L, lang } = useI18n();
  const openProfile = useMeev((s) => s.openProfile);
  const openServer = useMeev((s) => s.openServer);
  const [suggestions, setSuggestions] = useState<SuggestedUser[]>([]);
  const [trending, setTrending] = useState<PostDTO[]>([]);
  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [q, setQ] = useState("");
  const [interest, setInterest] = useState<string>("any");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [results, setResults] = useState<SuggestedUser[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [tab, setTab] = useState<"people" | "trending" | "rooms">("people");

  useEffect(() => {
    api.suggestions().then((r) => setSuggestions(r.users)).catch(() => {});
    api.trending().then((r) => setTrending(r.posts.slice(0, 9))).catch(() => {});
    api.servers().then((r) => setServers(r.servers.filter((s) => s.myRole === null).slice(0, 6))).catch(() => {});
  }, []);

  const doSearch = useCallback(async (opts?: { online?: boolean }) => {
    // v16 fix: the toggle used to pass a STALE `doSearch` closure to
    // setTimeout — the search ran with the OLD onlineOnly value, so the
    // Arabic (RTL) toggle visibly acted reversed. The new value is now
    // passed explicitly and the search uses it directly.
    const online = opts && typeof opts.online === "boolean" ? opts.online : onlineOnly;
    if (!q.trim() && (interest === "any" || !interest) && !online) {
      setResults(null);
      return;
    }
    setSearching(true);
    try {
      const r = await api.search({ q: q.trim(), interest: interest && interest !== "any" ? interest : undefined, online });
      setResults(r.users);
    } catch { /* noop */ } finally {
      setSearching(false);
    }
  }, [q, interest, onlineOnly]);

  const tabs: { k: "people" | "trending" | "rooms"; label: string }[] = [
    { k: "people", label: L("الأشخاص", "People") },
    { k: "trending", label: L("الرائج", "Trending") },
    { k: "rooms", label: L("الغرف", "Rooms") },
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 space-y-5 pb-24 md:pb-8">
        {/* header */}
        <div className="flex items-center gap-3">
          <Compass className="size-6 text-primary" />
          <h1 className="text-xl font-black tracking-tight">{L("استكشاف", "Explore")}</h1>
          <div className="ml-auto flex gap-1.5">
            {tabs.map(({ k, label }) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  tab === k ? "bg-primary/15 text-primary border border-primary/30" : "text-muted-foreground border border-border/60 hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* search bar */}
        {tab === "people" && (
          <div className="glass rounded-3xl p-4 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()}
                  placeholder={L("ابحث عن القطط بالاسم أو اسم المستخدم…", "Search cats by name or username…")}
                  className="rounded-xl bg-background/50 pl-10"
                />
              </div>
              <Select value={interest} onValueChange={setInterest}>
                <SelectTrigger className="w-40 rounded-xl bg-background/50">
                  <SelectValue placeholder={L("الاهتمام", "Interest")} />
                </SelectTrigger>
                <SelectContent className="rounded-xl max-h-64">
                  <SelectItem value="any">{L("أي اهتمام", "Any interest")}</SelectItem>
                  {INTERESTS.map((i) => (
                    <SelectItem key={i.key} value={i.key}>{i.emoji} {interestLabel(i.key, i.label, lang)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button className="rounded-xl meev-gradient-btn text-white" onClick={() => doSearch()} disabled={searching}>
                {searching ? "…" : L("اذهب", "Go")}
              </Button>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Switch
                id="online-only"
                checked={onlineOnly}
                onCheckedChange={(v) => {
                  setOnlineOnly(v);
                  doSearch({ online: v }); // immediate search with the NEW value
                }}
              />
              <label htmlFor="online-only" className="text-muted-foreground cursor-pointer select-none">
                {L("متصل الآن", "Online now")}
              </label>
            </div>
          </div>
        )}

        {/* people */}
        {tab === "people" && (
          <>
            {results && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1">
                  {L("نتائج البحث ({count})", "Search results ({count})").replace("{count}", String(results.length))}
                </h2>
                {results.length === 0 && (
                  <div className="glass rounded-3xl p-8 text-center">
                    <MeevLogo size={60} mood="sad" />
                    <div className="mt-2 text-sm text-muted-foreground">{L("لم نجد أحداً. جرّب فلاتر مختلفة", "No friends found. Try different filters")}</div>
                  </div>
                )}
                {results.map((u) => <SuggestionCard key={u.id} user={u} />)}
              </div>
            )}

            <div className="space-y-3">
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest px-1 flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" /> {L("مقترحون لك", "Suggested for you")}
                <span className="text-[10px] font-normal normal-case">· {L("اهتمامات + موقع + أصدقاء مشتركون", "interest + location + mutuals")}</span>
              </h2>
              {suggestions.length === 0 && <div className="glass rounded-3xl p-6 text-sm text-muted-foreground text-center">{L("جارٍ تحميل المقترحات…", "Loading suggestions…")}</div>}
              <div className="grid sm:grid-cols-2 gap-3">
                {suggestions.map((u) => <SuggestionCard key={u.id} user={u} />)}
              </div>
            </div>
          </>
        )}

        {/* trending */}
        {tab === "trending" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {trending.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => openProfile(p.author.username)}
                className="glass rounded-2xl overflow-hidden hover:border-primary/30 transition-colors text-left group"
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={L("منشور رائج", "Trending post")} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-36 p-4 text-xs line-clamp-5 bg-gradient-to-br from-primary/10 to-transparent grid place-items-center text-muted-foreground">
                    {p.content.slice(0, 140)}
                  </div>
                )}
                <div className="p-2.5 flex items-center gap-2">
                  <MeevCat seed={p.author.avatarSeed} fallback={p.author.id} size={24} presence="hidden" avatarPhoto={p.author.avatarPhoto} name={p.author.displayName} />
                  <div className="min-w-0 flex-1">
                    <MeevName displayName={p.author.displayName} level={p.author.level} nameColor={p.author.nameColor} nameFx={p.author.nameFx} compact />
                    <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5"><Heart className="size-2.5" /> {p.likeCount}</span>
                      <span className="inline-flex items-center gap-0.5"><MessageCircle className="size-2.5" /> {p.commentCount}</span>
                      <span className="ml-auto">{timeAgo(p.createdAt)}</span>
                    </div>
                  </div>
                  {i === 0 && <Flame className="size-4 text-orange-400 shrink-0" />}
                </div>
              </motion.button>
            ))}
            {trending.length === 0 && <div className="glass rounded-3xl p-8 text-center col-span-full text-sm text-muted-foreground">{L("جارٍ تحميل الرائج…", "Loading trending…")}</div>}
          </div>
        )}

        {/* rooms */}
        {tab === "rooms" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {servers.map((s) => (
              <div key={s.id} className="glass rounded-3xl p-5 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{s.iconEmoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate" style={{ color: s.accentColor }}>{s.name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Users className="size-3" /> {L("{members} عضو · {channels} قناة", "{members} members · {channels} channels").replace("{members}", String(s.memberCount)).replace("{channels}", String(s.channels.length))}
                    </div>
                  </div>
                  <Button size="sm" className="rounded-xl h-8 text-xs meev-gradient-btn text-white" onClick={() => openServer(s.id, s.channels[0]?.id)}>
                    {L("انضم", "Join")}
                  </Button>
                </div>
                {s.description && <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{s.description}</p>}
              </div>
            ))}
            {servers.length === 0 && <div className="glass rounded-3xl p-8 text-center col-span-full text-sm text-muted-foreground flex items-center justify-center gap-2">{L("انضممت لكل الغرف — تصرّف أسطوري", "You already joined every room — legend behavior")} <Trophy className="size-4 text-amber-400" aria-hidden="true" /></div>}
          </div>
        )}
      </div>
    </div>
  );
}
