"use client";

// MEEV — Gifts: the Hala-style gifting shop — catalog, coins
// balance, send flow and gift history (sent/received).

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { GiftDialog } from "./gift-dialog";
import { MeevCat } from "./cat-avatar";
import { MeevName, MeevNameUser } from "./username";
import { MeevLogo } from "./logo";
import { PawCoinIcon } from "./pawcoin";
import { timeAgo } from "./chat-shared";
import { GIFTS, RARITY_STYLES } from "@/lib/meev/constants";
import type { GiftCatalogItem, GiftDTO } from "./types";
import { cn } from "@/lib/utils";
import { Gift, ArrowLeftRight, Sparkles, Send, Inbox, Coins } from "lucide-react";

export function GiftsView() {
  const me = useMeev((s) => s.me);
  const { toast } = useToast();
  const { L } = useI18n();
  const [catalog, setCatalog] = useState<GiftCatalogItem[]>(GIFTS as GiftCatalogItem[]);
  const [sent, setSent] = useState<GiftDTO[]>([]);
  const [received, setReceived] = useState<GiftDTO[]>([]);
  const [giftFor, setGiftFor] = useState<{ id: string; displayName: string; avatarSeed: string } | null>(null);

  useEffect(() => {
    api.giftCatalog().then((r) => setCatalog(r.gifts)).catch(() => {});
    api.giftHistory().then((r) => { setSent(r.sent); setReceived(r.received); }).catch(() => {});
  }, []);

  const earned = received.reduce((sum, g) => sum + g.coins, 0);
  const spent = sent.reduce((sum, g) => sum + g.coins, 0);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 space-y-5 pb-24 md:pb-8">
        {/* header */}
        <div className="flex items-center gap-3">
          <Gift className="size-6 text-primary" />
          <h1 className="text-xl font-black tracking-tight">{L("متجر الهدايا", "Gift Shop")}</h1>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-4 py-1.5 font-bold text-amber-400">
              <PawCoinIcon size={16} /> {(me?.coins ?? 0).toLocaleString()}
            </span>
          </div>
        </div>

        {/* stats — v12: vector glyphs, not emoji */}
        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: L("هدايا مستلمة", "Gifts received"), value: received.length, icon: <Inbox className="size-5 text-emerald-400" strokeWidth={2.2} />, color: "text-emerald-400" },
            { label: L("ذهب مكتسب", "Gold earned"), value: earned, icon: <PawCoinIcon size={20} />, color: "text-amber-400" },
            { label: L("ذهب مصروف", "Gold spent"), value: spent, icon: <Coins className="size-5 text-rose-400" strokeWidth={2.2} />, color: "text-rose-400" },
          ].map((s) => (
            <div key={s.label} className="glass rounded-2xl p-3.5 text-center">
              <div className="h-7 grid place-items-center">{s.icon}</div>
              <div className={cn("text-lg font-black tabular-nums", s.color)}>{s.value.toLocaleString()}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="shop">
          <TabsList className="glass rounded-full h-9 p-0.5">
            <TabsTrigger value="shop" className="rounded-full px-4 text-xs data-[state=active]:bg-primary/20">{L("الهدايا", "Shop")}</TabsTrigger>
            <TabsTrigger value="received" className="rounded-full px-4 text-xs data-[state=active]:bg-primary/20">{L(`المستلمة (${received.length})`, `Received (${received.length})`)}</TabsTrigger>
            <TabsTrigger value="sent" className="rounded-full px-4 text-xs data-[state=active]:bg-primary/20">{L(`المرسلة (${sent.length})`, `Sent (${sent.length})`)}</TabsTrigger>
          </TabsList>

          {/* catalog */}
          <TabsContent value="shop" className="space-y-3 mt-4">
            <div className="text-sm text-muted-foreground px-1">{L("أرسل هدايا متحركة لأصدقائك في المحادثات والمنشورات وغرف البث. كل هدية تمنح الخبرة للطرفين", "Send animated gifts to friends in chats, on posts, or in live rooms. Every gift grants XP to both of you")}</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {catalog.map((g, i) => {
                const rar = RARITY_STYLES[g.rarity];
                const affordable = (me?.coins ?? 0) >= g.price;
                return (
                  <motion.div
                    key={g.key}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ y: -4 }}
                    className="glass rounded-3xl p-4 flex flex-col items-center gap-2.5 text-center"
                    style={{ borderColor: `${rar.ring}44` }}
                  >
                    <MeevLogo size={72} mood={g.mood as never} speed={1.2} glow={g.rarity !== "common"} />
                    <div className="font-bold text-sm">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground leading-snug min-h-8">{g.description}</div>
                    <span className="text-[9px] font-bold uppercase tracking-widest rounded-full px-2.5 py-0.5" style={{ background: `${rar.ring}1e`, color: rar.ring }}>
                      {rar.label} · +{g.xpReward} XP
                    </span>
                    <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                      <PawCoinIcon size={14} /> {g.price}
                    </div>
                    <Button
                      size="sm"
                      className={cn("rounded-xl h-8 text-xs gap-1.5 w-full", affordable ? "meev-gradient-btn text-white" : "bg-muted text-muted-foreground")}
                      disabled={!affordable}
                      onClick={() => setGiftFor({ id: "", displayName: "", avatarSeed: "" })}
                    >
                      <Send className="size-3" /> {affordable ? L("أرسل هدية", "Send gift") : L("لا يوجد ذهب كافٍ", "Not enough Gold")}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
            <div className="glass rounded-2xl p-4 flex items-center gap-3 text-sm">
              <ArrowLeftRight className="size-5 text-primary shrink-0" />
              <div className="text-muted-foreground">
                {L("تكتسب ذهب ميف من رفع مستواك (+٢٥ لكل مستوى) ومن نشاطك. افتح أي محادثة أو ملف واضغط زر الهدية للإرسال من هناك.", "Gold Meev is earned by leveling up (+25/level) and being active. Open a chat or profile and tap the gift button to gift from there.")}
              </div>
            </div>
          </TabsContent>

          {/* received */}
          <TabsContent value="received" className="space-y-2.5 mt-4">
            {received.length === 0 && (
              <div className="glass rounded-3xl p-10 text-center space-y-3">
                <MeevLogo size={70} mood="sad" className="mx-auto" />
                <div className="text-sm text-muted-foreground">{L("لا هدايا بعد — انشر شيئاً رائعاً وأصدقاؤك هنا كرماء!", "No gifts yet. Post something cool — your friends are generous here!")}</div>
              </div>
            )}
            {received.map((g) => <GiftRow key={g.id} gift={g} type="received" />)}
          </TabsContent>

          {/* sent */}
          <TabsContent value="sent" className="space-y-2.5 mt-4">
            {sent.length === 0 && (
              <div className="glass rounded-3xl p-10 text-center space-y-3">
                <MeevLogo size={70} mood="blep" className="mx-auto" />
                <div className="text-sm text-muted-foreground">{L("لم ترسل هدايا بعد — أسعد قطة اليوم!", "You haven't sent gifts yet. Make a cat's day!")}</div>
              </div>
            )}
            {sent.map((g) => <GiftRow key={g.id} gift={g} type="sent" />)}
          </TabsContent>
        </Tabs>
      </div>

      {/* pick recipient when sending from shop: opens the explore suggestion quick-pick */}
      <QuickPick open={!!giftFor} onClose={() => setGiftFor(null)} onPick={setGiftFor} />
      {giftFor && giftFor.id && (
        <GiftDialog
          open={!!giftFor.id}
          onClose={() => setGiftFor(null)}
          recipient={giftFor}
        />
      )}
    </div>
  );
}

function GiftRow({ gift, type }: { gift: GiftDTO; type: "sent" | "received" }) {
  const person = type === "sent" ? gift.recipient : gift.sender;
  const openProfile = useMeev((s) => s.openProfile);
  const { L } = useI18n();
  return (
    <div className="glass rounded-2xl p-3 flex items-center gap-3">
      <MeevLogo size={44} mood={gift.gift?.mood as never} speed={1} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold">{gift.gift?.name || gift.giftKey} <span className="text-muted-foreground font-normal">· {L("إلى", "to")}</span></div>
        <button onClick={() => openProfile(person.username)} className="flex items-center gap-1.5 hover:underline text-sm">
          <MeevCat seed={person.avatarSeed} fallback={person.id} size={20} presence="hidden" avatarPhoto={person.avatarPhoto} name={person.displayName} />
          <MeevNameUser user={person} compact />
        </button>
        {gift.note && <div className="text-xs text-muted-foreground italic truncate">“{gift.note}”</div>}
      </div>
      <div className="text-end shrink-0">
        <div className="text-xs font-bold text-amber-400 flex items-center gap-1 justify-end"><PawCoinIcon size={12} /> {gift.coins}</div>
        <div className="text-[10px] text-muted-foreground">{timeAgo(gift.createdAt)}</div>
      </div>
    </div>
  );
}

// quick-pick a friend from suggestions to gift
function QuickPick({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (u: { id: string; displayName: string; avatarSeed: string; avatarPhoto?: string | null }) => void }) {
  const { L } = useI18n();
  const [users, setUsers] = useState<{ id: string; displayName: string; avatarSeed: string; username: string; avatarPhoto?: string | null }[]>([]);
  useEffect(() => {
    if (open) {
      api.suggestions().then((r) => setUsers(r.users.slice(0, 12))).catch(() => {});
      api.conversations().then((r) => {
        setUsers((prev) => {
          const convs = r.conversations.map((c) => ({ id: c.partner.id, displayName: c.partner.displayName, avatarSeed: c.partner.avatarSeed, username: c.partner.username, avatarPhoto: c.partner.avatarPhoto ?? null }));
          const merged: typeof prev = [...convs];
          for (const u of prev) if (!merged.some((m) => m.id === u.id)) merged.push(u);
          return merged.slice(0, 12);
        });
      }).catch(() => {});
    }
  }, [open]);

  if (!open) return null;
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="glass rounded-3xl p-5 w-full max-w-sm space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="font-bold flex items-center gap-2"><Sparkles className="size-5 text-primary" /> {L("أرسل هدية إلى…", "Send a gift to…")}</div>
        <div className="max-h-72 overflow-y-auto space-y-1.5">
          {users.length === 0 && <div className="text-sm text-muted-foreground p-3 text-center">{L("لا أحد هنا — تابع بعض الأصدقاء أولاً!", "No one to show — follow some friends first!")}</div>}
          {users.map((u) => (
            <button
              key={u.id}
              onClick={() => { onPick(u); onClose(); }}
              className="w-full flex items-center gap-3 rounded-xl p-2 hover:bg-white/5 text-start"
            >
              <MeevCat seed={u.avatarSeed} fallback={u.id} size={36} presence="hidden" avatarPhoto={u.avatarPhoto} name={u.displayName} />
              <MeevName displayName={u.displayName} compact />
              <span className="text-xs text-muted-foreground ms-auto">@{u.username}</span>
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
