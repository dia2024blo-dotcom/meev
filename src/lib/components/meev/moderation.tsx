"use client";

// ============================================================
// MEEV v2 — Moderation kit: report dialog (any user, any
// context) + block/unblock button. Shared by chat headers,
// profiles, live rooms, settings.
// ============================================================

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError } from "./api";
import { useI18n } from "./i18n";
import { REPORT_REASONS } from "@/lib/meev/constants";
import { Flag, ShieldOff, Ban, Loader2, ShieldAlert, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";

export function ReportDialog({
  open,
  onClose,
  target,
  contextLabel,
}: {
  open: boolean;
  onClose: () => void;
  target: { id: string; displayName: string };
  contextLabel?: string;
}) {
  const { L } = useI18n();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!reason) return;
    setBusy(true);
    try {
      await api.report({ targetType: "user", targetUserId: target.id, reason, details: details.slice(0, 500) });
      toast({
        title: (
          <span className="flex items-center gap-2">
            <ShieldAlert className="size-4 text-destructive" aria-hidden="true" />
            {L("تم إرسال البلاغ", "Report submitted")}
          </span>
        ),
        description: L(
          "فريق الأمان في ميف راجعه الآن. شكراً لحمايتك للمجتمع.",
          "Meev's safety cats are on it. Thanks for keeping the community safe."
        ),
      });
      setReason("");
      setDetails("");
      onClose();
    } catch (e) {
      toast({
        title: L("تعذّر إرسال البلاغ", "Couldn't submit the report"),
        description: e instanceof ApiError ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md rounded-3xl glass">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="size-5 text-destructive" />
            {L("الإبلاغ عن", "Report")} <span className="meev-aurora-text">{target.displayName}</span>
            {contextLabel && <span className="text-xs text-muted-foreground font-normal">({contextLabel})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 py-1">
          {REPORT_REASONS.map((r) => {
            const labels: Record<string, [string, string]> = {
              harassment: ["تنمّر أو إساءة", "Harassment or bullying"],
              nsfw: ["محتوى غير لائق", "Inappropriate content"],
              spam: ["سبام أو نصب", "Spam or scam"],
              impersonation: ["انتحال شخصية", "Impersonation"],
              other: ["شيء آخر", "Something else"],
            };
            const [ar, en] = labels[r.key] || [r.label, r.label];
            return (
              <button
                key={r.key}
                onClick={() => setReason(r.key)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm text-start transition-all",
                  reason === r.key
                    ? "border-destructive bg-destructive/10 text-foreground"
                    : "border-border/60 bg-card hover:border-destructive/40"
                )}
              >
                {L(ar, en)}
              </button>
            );
          })}
        </div>

        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, 500))}
          placeholder={L("تفاصيل إضافية (اختياري)…", "Extra details (optional)…")}
          className="rounded-xl bg-background/50 min-h-20"
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">
            {L("إلغاء", "Cancel")}
          </Button>
          <Button onClick={submit} disabled={!reason || busy} className="rounded-xl bg-destructive/90 hover:bg-destructive text-white">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Flag className="size-4" />}
            {L("إرسال البلاغ", "Submit report")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Block / unblock toggle with confirm. `blocked` = current state. */
export function BlockButton({
  userId,
  displayName,
  blocked,
  onChange,
  variant = "ghost",
  className,
}: {
  userId: string;
  displayName: string;
  blocked: boolean;
  onChange?: (blocked: boolean) => void;
  variant?: "ghost" | "solid";
  className?: string;
}) {
  const { L } = useI18n();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const toggle = async () => {
    setBusy(true);
    try {
      const r = blocked ? await api.unblock(userId) : await api.block(userId);
      const now = r.blocked;
      toast({
        title: now ? (
          <span className="flex items-center gap-2">
            <VolumeX className="size-4 text-muted-foreground" aria-hidden="true" />
            {L(`تم حظر ${displayName}`, `Blocked ${displayName}`)}
          </span>
        ) : (
          L(`تم فك الحظر عن ${displayName}`, `Unblocked ${displayName}`)
        ),
        description: now
          ? L("لن يتمكن من مراسلتك أو مطابقتك معك.", "They can no longer message or match with you.")
          : undefined,
      });
      onChange?.(now);
      setConfirming(false);
    } catch (e) {
      toast({
        title: L("تعذّر تنفيذ العملية", "Couldn't do that"),
        description: e instanceof ApiError ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  if (blocked) {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggle}
        disabled={busy}
        className={cn("rounded-xl text-emerald-400 hover:text-emerald-300 gap-2", className)}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
        {L("فك الحظر", "Unblock")}
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant === "solid" ? "default" : "ghost"}
        size="sm"
        onClick={() => setConfirming(true)}
        className={cn("rounded-xl gap-2", variant === "ghost" && "text-destructive hover:text-destructive", className)}
      >
        <Ban className="size-4" />
        {L("حظر", "Block")}
      </Button>

      <Dialog open={confirming} onOpenChange={(v) => !v && setConfirming(false)}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="size-5 text-destructive" />
              {L("حظر", "Block")} <span className="meev-aurora-text">{displayName}</span>؟
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {L(
              "لن يتمكن من مراسلتك أو مطابقتك معك، وسيتم إلغاء المتابعة بينكما تلقائياً.",
              "They won't be able to message or match with you, and you'll both unfollow automatically."
            )}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} className="rounded-xl">
              {L("تراجع", "Never mind")}
            </Button>
            <Button onClick={toggle} disabled={busy} className="rounded-xl bg-destructive/90 hover:bg-destructive text-white gap-2">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              {L("حظر نهائي", "Block")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
