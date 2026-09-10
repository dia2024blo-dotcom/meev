"use client";

// MEEV — Gift sending dialog (Hala-style gifting) with confetti
// celebration + a mini explosion preview on success. Used from feed,
// DMs (also opened via the /gift slash command), live rooms, profiles.

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { useCelebration, Confetti } from "./celebration";
import { MeevLogo } from "./logo";
import { MiniExplosion } from "./gift-box";
import { PawCoinIcon } from "./pawcoin";
import { GIFTS, RARITY_STYLES } from "@/lib/meev/constants";
import type { GiftCatalogItem } from "./types";
import { cn } from "@/lib/utils";
import { Check, Sparkles } from "lucide-react";
import { GiftMark } from "./symbols";

interface GiftDialogProps {
  open: boolean;
  onClose: () => void;
  recipient: { id: string; displayName: string; avatarSeed?: string };
  /** v2: gift key preselected by the /gift <name> slash command */
  preselectKey?: string | null;
  /** v16 (user spec): gifts live ONLY in private chats and live rooms */
  contextType?: "dm" | "live";
  contextId?: string;
  /** v8: when provided, the PARENT renders the center-screen GiftCinema
   *  on success and this dialog skips its own generic celebration. */
  onSent?: (gift: GiftCatalogItem, note: string) => void;
}

/** Burst emoji for a gift key (GIFTS constant is the source of truth — the API catalog may lag). */
function giftEmoji(key: string): string {
  return GIFTS.find((g) => g.key === key)?.emoji ?? "🎁";
}

export function GiftDialog({ open, onClose, recipient, preselectKey, contextType = "dm", contextId, onSent }: GiftDialogProps) {
  const me = useMeev((s) => s.me);
  const patchMe = useMeev((s) => s.patchMe);
  const { L } = useI18n();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<GiftCatalogItem[]>(GIFTS as GiftCatalogItem[]);
  const [selected, setSelected] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const { show } = useCelebration();

  useEffect(() => {
    if (open) {
      setSelected(preselectKey ?? null);
      setNote("");
      setSent(false);
      api.giftCatalog().then((r) => setGifts(r.gifts)).catch(() => {});
    }
  }, [open, preselectKey]);

  const gift = gifts.find((g) => g.key === selected);
  const coins = me?.coins ?? 0;

  const send = async () => {
    if (!gift) return;
    setBusy(true);
    try {
      const r = await api.sendGift({ giftKey: gift.key, recipientId: recipient.id, note: note.slice(0, 30), contextType, contextId });
      patchMe({ coins: r.coinsLeft });
      setSent(true);
      if (onSent) {
        // v8: the parent owns the celebration (GiftCinema takeover)
        onSent(gift, note.trim());
      } else {
        show({
          type: "gift",
          giftKey: gift.key,
          giftName: gift.name,
          from: "You",
          mood: gift.mood,
          rare: gift.rarity === "epic" || gift.rarity === "legendary",
        });
      }
      toast({
        title: (
          <span className="flex items-center gap-2">
            <GiftMark size={16} className="text-amber-400" />
            {L(`أُرسلت الهدية إلى ${recipient.displayName}!`, `Gift sent to ${recipient.displayName}!`)}
          </span>
        ),
        description: L(
          `-${gift.price} ذهب · وصلت +${gift.price} 🪙 إلى حسابه`,
          `-${gift.price} Gold · +${gift.price} 🪙 credited to their account`,
        ),
      });
      setTimeout(onClose, 1800);
    } catch (e) {
      toast({
        title: L("تعذّر إرسال الهدية", "Couldn't send gift"),
        description: e instanceof Error ? e.message : L("حاول مجدداً", "Try again"),
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg rounded-3xl glass border-border/60 p-0 max-h-[88dvh] flex flex-col">
        <DialogHeader className="p-5 pb-3 border-b border-border/40 shrink-0">
          <DialogTitle className="flex items-center justify-between gap-3">
            <span>
              {L("أرسل هدية إلى", "Send a gift to")} <span className="meev-aurora-text">{recipient.displayName}</span>
            </span>
            <span
              className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-sm text-amber-400 font-bold"
              title={L("ذهب ميف", "Gold Meev")}
            >
              <PawCoinIcon size={16} spin /> {coins.toLocaleString()}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="p-4 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {gifts.map((g) => {
            const rar = RARITY_STYLES[g.rarity];
            const active = selected === g.key;
            const affordable = coins >= g.price;
            return (
              <motion.button
                key={g.key}
                whileHover={affordable ? { y: -3 } : undefined}
                whileTap={affordable ? { scale: 0.96 } : undefined}
                onClick={() => affordable && setSelected(g.key)}
                disabled={!affordable}
                className={cn(
                  "relative rounded-2xl border p-3 pt-4 flex flex-col items-center gap-2 text-center transition-all",
                  active ? "border-primary ring-2 ring-primary/40 bg-primary/10" : "border-border/60 bg-card hover:border-primary/40",
                  !affordable && "opacity-40 cursor-not-allowed"
                )}
                style={active ? { boxShadow: `0 0 22px -4px ${rar.glow}` } : undefined}
                aria-label={`${g.name} — ${g.price} Gold Meev`}
              >
                <span className="absolute top-1.5 end-1.5 text-lg select-none opacity-90" aria-hidden="true">
                  {giftEmoji(g.key)}
                </span>
                <MeevLogo size={56} mood={g.mood as never} speed={active ? 1.8 : 1} />
                <div className="text-xs font-bold leading-tight">{g.name}</div>
                <div className="text-[10px] text-muted-foreground leading-tight line-clamp-2 min-h-8">{g.description}</div>
                <span className={cn("text-[9px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5")} style={{ background: `${rar.ring}22`, color: rar.ring }}>
                  {rar.label}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-amber-400">
                  <PawCoinIcon size={13} /> {g.price}
                </span>
              </motion.button>
            );
          })}
        </div>

        <div className="relative p-4 pt-0 border-t border-border/40 shrink-0 space-y-3">
          {sent && <MiniExplosion giftKey={gift?.key} count={8} />}
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 30))}
            placeholder={
              gift
                ? L(`قل شيئاً مع ${gift.name}… (اختياري)`, `Say something with your ${gift.name}… (optional)`)
                : L("اختر هدية أولاً", "Pick a gift first")
            }
            className="rounded-xl bg-background/50"
            disabled={!selected || sent}
          />
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <GiftMark size={13} className="text-amber-400/80" aria-hidden="true" />
            {L(
              "الهدية تُرسل في الخاص/المباشر فقط · الحد: ٢٤ هدية كل ٢٤ ساعة",
              "Private & live rooms only · limit: 24 gifts every 24h",
            )}
          </div>
          <Button
            className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
            disabled={!selected || busy || sent}
            onClick={send}
          >
            {sent ? (
              <> <Check className="size-4" /> {L("تم الإرسال!", "Sent!")} </>
            ) : busy ? (
              L("جارٍ الإرسال…", "Sending…")
            ) : (
              <> <Sparkles className="size-4" /> {L("إرسال", "Send")} {gift ? `${gift.name} · ${gift.price}` : L("هدية", "gift")} </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { Confetti };
