"use client";

// MEEV — Auth gateway (v2): login, register (+ interest onboarding),
// email OTP verification, 2FA step, forgot/reset password, guest.
// Fully bilingual (AR default, RTL) with a fixed language pill that
// works pre-auth, animated paw background, demo one-tap login chips
// and a trust strip. (SMTP runs in demo mode: OTP codes surface in
// a "demo inbox" toast/card.)

import { useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, setToken, ApiError } from "./api";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { interestLabel } from "./i18n-dict";
import { MeevLogoCycle, MeevLogo } from "./logo";
import { INTERESTS } from "@/lib/meev/constants";
import type { AuthResponse } from "./types";
import { cn } from "@/lib/utils";
import { LanguageLaunchButton } from "./language-sheet";
import { Sparkles, Cat, Gift, Zap, Users, MessageCircle, Lock, Eye, EyeOff, ArrowRight, KeyRound, ShieldCheck, PartyPopper, LockKeyhole, Crown, Moon, Gamepad2, Mail } from "lucide-react";
import { PawMark, CatMark } from "./symbols";

type Step = "signin" | "signup" | "verify" | "twofactor" | "forgot" | "reset";

const DEMO_PASSWORD = "Meev1234!";

// v20: the one-tap demo accounts + visible demo passwords are DEV/DEMO
// ONLY. On real hosting (production build) they auto-disappear — no
// visitor ever sees credentials on the login screen. Force-show for a
// live demo by setting NEXT_PUBLIC_MEEV_DEMO=1 at build time.
const SHOW_DEMO =
  process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_MEEV_DEMO === "1";
// v12: demo account glyphs are crisp symbols, not emoji
const DEMO_ACCOUNTS: { u: string; icon: ReactNode; hint: string; pw?: string }[] = [
  { u: "othman", icon: <Crown className="size-5 text-amber-400" aria-hidden="true" />, hint: "owner · CMD", pw: "Meev-Owner-2027" },
  { u: "mochi", icon: <CatMark size={20} />, hint: "lvl 68" },
  { u: "luna", icon: <Moon className="size-5 text-amber-300" aria-hidden="true" />, hint: "lvl 120" },
  { u: "pixel", icon: <Gamepad2 className="size-5 text-primary" aria-hidden="true" />, hint: "lvl 999" },
];

export function AuthView() {
  const { toast } = useToast();
  const { L, lang } = useI18n();
  const setMe = useMeev((s) => s.setMe);
  const [step, setStep] = useState<Step>("signin");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demoInbox, setDemoInbox] = useState<{ code: string; purpose: string } | null>(null);

  // form fields
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [interests, setInterests] = useState<string[]>([]);

  const finishAuth = (data: AuthResponse) => {
    setToken(data.accessToken);
    setMe(data.user);
    toast({
      title: (
        <span className="flex items-center gap-2">
          <CatMark size={16} className="text-amber-500" />
          {L(`أهلاً بك، ${data.user.displayName}!`, `Welcome, ${data.user.displayName}!`)}
        </span>
      ),
      description: L(`أنت داخل. المستوى ${data.user.level}.`, `You're in. Level ${data.user.level}.`),
    });
  };

  const strength = (() => {
    let s = 0;
    if (password.length >= 8) s++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const doLogin = async (withOtp?: string, creds?: { identifier: string; password: string }) => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.login({
        identifier: creds?.identifier ?? identifier,
        password: creds?.password ?? password,
        otp: withOtp,
      });
      finishAuth(data);
    } catch (e) {
      if (e instanceof ApiError && e.message === "2FA_REQUIRED") {
        setStep("twofactor");
        try {
          const r = await api.resendOtp({
            email: (creds?.identifier ?? identifier).includes("@") ? (creds?.identifier ?? identifier) : "",
            purpose: "twofactor",
          });
          if (r.devOtp) setDemoInbox(r.devOtp);
        } catch { /* ignore */ }
        toast({
          title: L("أُرسل كود التحقق بخطوتين", "Two-factor code sent"),
          description: L("افحص صندوق العرض التجريبي لكودك.", "Check the demo inbox for your code."),
        });
      } else {
        setError(e instanceof Error ? e.message : L("فشل تسجيل الدخول", "Login failed"));
      }
    } finally {
      setBusy(false);
    }
  };

  /** one-tap demo login: prefill the form AND submit immediately */
  const quickLogin = (u: string, pw?: string) => {
    const password = pw || DEMO_PASSWORD;
    setIdentifier(u);
    setPassword(password);
    setError(null);
    void doLogin(undefined, { identifier: u, password });
  };

  const doRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api.register({
        username,
        email,
        password,
        displayName: displayName || username,
        interests,
      });
      if (data.devOtp) setDemoInbox(data.devOtp);
      setStep("verify");
      toast({
        title: (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            {L("أُنشئ الحساب!", "Account created!")}
          </span>
        ),
        description: L("أرسلنا كوداً من 6 أرقام لتوثيق بريدك.", "We sent a 6-digit code to verify your email."),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : L("فشل التسجيل", "Registration failed"));
    } finally {
      setBusy(false);
    }
  };

  const doVerify = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.verifyEmail({ email, code: otp });
      // login after verification
      const data = await api.login({ identifier: email, password });
      finishAuth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : L("فشل التوثيق", "Verification failed"));
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.forgotPassword({ email });
      if (r.devOtp) setDemoInbox({ code: r.devOtp.code, purpose: "reset" });
      setStep("reset");
      toast({
        title: L("أُرسل كود الاستعادة", "Reset code sent"),
        description: L("إن كان هذا البريد موجوداً، فالكود في الطريق.", "If that email exists, a code is on the way."),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : L("حدث خطأ ما", "Something went wrong"));
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.resetPassword({ email, code: otp, newPassword });
      toast({
        title: (
          <span className="flex items-center gap-2">
            <LockKeyhole className="size-4 text-amber-400" aria-hidden="true" />
            {L("تم تحديث كلمة المرور", "Password updated")}
          </span>
        ),
        description: L(
          "أُنهيت جميع الجلسات القديمة. سجّل الدخول بكلمة المرور الجديدة.",
          "All old sessions were revoked. Sign in with your new password."
        ),
      });
      setPassword("");
      setStep("signin");
    } catch (e) {
      setError(e instanceof Error ? e.message : L("فشل التعيين", "Reset failed"));
    } finally {
      setBusy(false);
    }
  };

  const doGuest = async () => {
    setBusy(true);
    try {
      const data = await api.guest();
      finishAuth(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : L("فشل وضع الزائر", "Guest mode failed"));
    } finally {
      setBusy(false);
    }
  };

  const toggleInterest = (key: string) => {
    setInterests((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : prev.length >= 8 ? prev : [...prev, key]
    );
  };

  const stepTitle = (): { title: string; sub: string } => {
    switch (step) {
      case "signup":
        return { title: L("أنشئ حسابك في ميف", "Create your Meev account"), sub: L("انضم لأكثر مجتمع ودّي على الإنترنت", "Join the friendliest community on the internet") };
      case "verify":
        return { title: L("افحص بريدك", "Check your inbox"), sub: L("أدخل الكود المكوّن من 6 أرقام", "Enter the 6-digit code we sent you") };
      case "forgot":
      case "reset":
        return { title: L("استعادة كلمة المرور", "Reset password"), sub: L("بكود بريدي آمن", "With a secure email code") };
      case "twofactor":
        return { title: L("التحقق بخطوتين", "Two-factor auth"), sub: L("طبقة أمان إضافية لحسابك", "An extra layer for your account") };
      default:
        return { title: L("أهلاً بعودتك", "Welcome back"), sub: L("سجّل الدخول لمواصلة الأجواء", "Sign in to continue the vibe") };
    }
  };
  const { title, sub } = stepTitle();

  return (
    // v18: BgCanvas removed (same as app.tsx) — the auth screen is back to
    // the clean page background + aurora wash.
    <div className="min-h-dvh flex flex-col relative bg-background">
      <div className="meev-bg-aurora" />

      {/* v11: language quick-switcher — the round glass globe opens the
          LanguageSheet (a glass dialog with all 6 languages). Picking a new
          one persists it (pre-auth via localStorage, no profile call) and
          does a LIGHT RESTART of the site (paw-pulse → reload → boot splash
          in the new language). Sits at the top corner, clear of the form,
          and never submits anything. */}
      <div className="fixed top-4 end-4 z-50">
        <LanguageLaunchButton size="lg" />
      </div>

      {/* sticky footer */}
      <div className="mt-auto py-3 text-center text-xs text-muted-foreground border-t border-border/60 bg-background/40 backdrop-blur-sm relative z-10">
        <span className="inline-flex items-center justify-center flex-wrap gap-x-1">
          Meev © 2027 · {L("صُنع بـ", "made with")} <PawMark size={12} className="mx-0.5 text-amber-500" aria-hidden="true" /> · {L("كل طرق التواصل", "every way to hang out")}
        </span>
      </div>
      <div className="flex-1 grid lg:grid-cols-2 items-center -mt-[52px] pt-[52px] relative z-10">
        {/* ---------- brand hero ---------- */}
        <div className="hidden lg:flex flex-col items-center justify-center gap-8 p-10 h-full">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 120, damping: 14 }}
          >
            <MeevLogoCycle size={150} />
          </motion.div>
          <div className="text-center space-y-3">
            <h1 className="text-6xl font-black tracking-tighter font-display">
              <span className="meev-aurora-text">Meev</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-md mx-auto leading-relaxed">
              {L(
                "تطبيق واحد. كل طرق التواصل — مجتمعات، خلاصات، قصص، غرف 1v1 عشوائية، هدايا ومستويات.",
                "One app. Every way to hang out — communities, feeds, stories, random 1v1 rooms, gifts & levels."
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg">
            {[
              { icon: Cat, ar: "تميمة حيّة", en: "Living mascot" },
              { icon: Users, ar: "مجتمعات", en: "Servers" },
              { icon: Sparkles, ar: "قصص", en: "Stories" },
              { icon: MessageCircle, ar: "1v1 مباشر", en: "1v1 live" },
              { icon: Gift, ar: "هدايا", en: "Gifting" },
              { icon: Zap, ar: "خبرة ومستويات", en: "XP & levels" },
            ].map((f, i) => (
              <motion.span
                key={f.en}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="glass rounded-full px-4 py-1.5 text-sm flex items-center gap-2"
              >
                <f.icon className="size-4 text-primary" />
                {L(f.ar, f.en)}
              </motion.span>
            ))}
          </div>

          {/* trust strip */}
          <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <PawMark size={12} className="text-primary" />
              {L("١٥ قطة متصلة الآن", "15 cats online right now")}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-emerald-400" />
              {L("كلمات مرور مشفّرة", "Argon2-grade security")}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="size-3.5 text-amber-400" />
              {L("لحظي بالكامل", "Fully realtime")}
            </span>
          </div>
        </div>

        {/* ---------- auth card ---------- */}
        <div className="flex items-center justify-center p-4 pt-16 sm:p-8 sm:pt-8">
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-full max-w-md glass rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden"
          >
            <div className="absolute -top-24 -end-24 size-56 rounded-full bg-primary/20 blur-3xl pointer-events-none" />

            <div className="flex items-center gap-3 mb-6">
              <MeevLogo size={46} mood="default" speed={1} glow />
              <div>
                <div className="text-xl font-black tracking-tight">{title}</div>
                <div className="text-xs text-muted-foreground">{sub}</div>
              </div>
            </div>

            {/* demo inbox */}
            {demoInbox && (step === "verify" || step === "twofactor" || step === "reset") && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-3"
              >
                <KeyRound className="size-5 text-amber-500 shrink-0" />
                <div className="text-sm">
                  <span className="text-muted-foreground">
                    {L("صندوق تجريبي (وضع SMTP التجريبي): الكود", "Demo inbox (SMTP demo mode): code")}
                  </span>{" "}
                  <b className="font-mono text-lg tracking-[0.3em] text-amber-400">{demoInbox.code}</b>
                </div>
              </motion.div>
            )}

            {error && (
              <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.div key={step} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>

                {step === "signin" && (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <Label>{L("البريد الإلكتروني أو اسم المستخدم", "Email or username")}</Label>
                      <Input
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder={L("mochi أو you@catmail.com", "mochi or you@catmail.com")}
                        autoComplete="username"
                        className="h-11 rounded-xl bg-background/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{L("كلمة المرور", "Password")}</Label>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          autoComplete="current-password"
                          className="h-11 rounded-xl bg-background/60 pe-10"
                          onKeyDown={(e) => e.key === "Enter" && doLogin()}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          aria-label={showPw ? L("إخفاء كلمة المرور", "Hide password") : L("إظهار كلمة المرور", "Show password")}
                          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || !identifier || !password}
                      onClick={() => doLogin()}
                    >
                      {busy ? L("جارٍ تسجيل الدخول…", "Signing in…") : L("تسجيل الدخول", "Sign in")}{" "}
                      <ArrowRight className="size-4 flip-rtl" />
                    </Button>
                    <div className="flex items-center justify-between text-sm">
                      <button
                        className="text-muted-foreground hover:text-foreground hover:underline"
                        onClick={() => { setStep("forgot"); setError(null); }}
                      >
                        {L("نسيت كلمة المرور؟", "Forgot password?")}
                      </button>
                      <button
                        className="text-primary hover:underline font-medium"
                        onClick={() => { setStep("signup"); setError(null); }}
                      >
                        {L("إنشاء حساب", "Create account")}
                      </button>
                    </div>
                    <div className="relative my-2">
                      <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-3 text-muted-foreground uppercase tracking-widest">
                          {L("أو", "or")}
                        </span>
                      </div>
                    </div>
                    <Button variant="outline" className="w-full h-11 rounded-xl" disabled={busy} onClick={doGuest}>
                      <Cat className="size-4" /> {L("أكمل كزائر", "Continue as guest")}
                    </Button>

                    {/* one-tap demo accounts — v20: hidden automatically in production hosting */}
                    {SHOW_DEMO && (
                    <div className="space-y-2">
                      <div className="text-xs text-muted-foreground text-center">
                        {L("حسابات تجريبية بلمسة واحدة:", "One-tap demo accounts:")}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {DEMO_ACCOUNTS.map((d) => (
                          <button
                            key={d.u}
                            type="button"
                            disabled={busy}
                            onClick={() => quickLogin(d.u, d.pw)}
                            className={cn(
                              "rounded-2xl border transition-all px-2 py-2.5 flex flex-col items-center gap-0.5 disabled:opacity-50",
                              d.u === "othman"
                                ? "border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-400/60"
                                : "border-border/60 bg-white/5 hover:bg-primary/10 hover:border-primary/40"
                            )}
                          >
                            <span className="text-xl leading-none" aria-hidden="true">{d.icon}</span>
                            <span className="text-xs font-bold">{d.u}</span>
                            <span className="text-[9px] text-muted-foreground">{d.hint}</span>
                          </button>
                        ))}
                      </div>
                      <div className="text-center text-[10px] text-muted-foreground">
                        {L(
                          "كلمة مرور التجربة: Meev1234! · المالك: Meev-Owner-2027 (غيّرها بعد أول دخول)",
                          "Demo password: Meev1234! · Owner: Meev-Owner-2027 (change it after first sign-in)"
                        )}
                      </div>
                    </div>
                    )}
                  </div>
                )}

                {step === "signup" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label>{L("اسم المستخدم", "Username")}</Label>
                        <Input
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                          placeholder="coolcat"
                          className="h-11 rounded-xl bg-background/60"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>{L("الاسم المعروض", "Display name")}</Label>
                        <Input
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder={L("قط لطيف", "Cool Cat")}
                          className="h-11 rounded-xl bg-background/60"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>{L("البريد الإلكتروني", "Email")}</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@catmail.com"
                        className="h-11 rounded-xl bg-background/60"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>{L("كلمة المرور", "Password")}</Label>
                      <div className="relative">
                        <Input
                          type={showPw ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="8+ chars, Aa1!"
                          className="h-11 rounded-xl bg-background/60 pe-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPw(!showPw)}
                          aria-label={showPw ? L("إخفاء كلمة المرور", "Hide password") : L("إظهار كلمة المرور", "Show password")}
                          className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <div className="flex gap-1 pt-1">
                        {[1, 2, 3, 4].map((i) => (
                          <div
                            key={i}
                            className={cn(
                              "h-1.5 flex-1 rounded-full transition-colors",
                              strength >= i
                                ? strength <= 1
                                  ? "bg-destructive"
                                  : strength <= 2
                                    ? "bg-amber-500"
                                    : strength <= 3
                                      ? "bg-yellow-400"
                                      : "bg-emerald-500"
                                : "bg-border"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label>
                        {L("اختر اهتماماتك", "Pick your interests")}{" "}
                        <span className="text-muted-foreground font-normal">
                          {L("(اختياري، 8 كحد أقصى — يشغّل اقتراحات الأصدقاء)", "(optional, max 8 — powers friend suggestions)")}
                        </span>
                      </Label>
                      <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1">
                        {INTERESTS.map((i) => (
                          <button
                            key={i.key}
                            type="button"
                            onClick={() => toggleInterest(i.key)}
                            className={cn(
                              "rounded-full px-2.5 py-1 text-xs border transition-all",
                              interests.includes(i.key)
                                ? "border-primary bg-primary/15 text-primary font-medium"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                            )}
                          >
                            {i.emoji} {interestLabel(i.key, i.label, lang)}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || !username || !email || !password}
                      onClick={doRegister}
                    >
                      {busy ? L("جارٍ الإنشاء…", "Creating…") : L("إنشاء الحساب", "Create account")}{" "}
                      <Sparkles className="size-4" />
                    </Button>
                    <div className="text-center text-sm">
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => { setStep("signin"); setError(null); }}
                      >
                        {L("لديك حساب بالفعل؟", "Already have an account?")}{" "}
                        <span className="text-primary hover:underline">{L("سجّل الدخول", "Sign in")}</span>
                      </button>
                    </div>
                  </div>
                )}

                {step === "verify" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {L("أرسلنا كوداً من 6 أرقام إلى", "We sent a 6-digit code to")}{" "}
                      <b className="text-foreground">{email}</b>.{" "}
                      {L("ينتهي خلال 15 دقيقة.", "It expires in 15 minutes.")}
                    </p>
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="••••••"
                      inputMode="numeric"
                      className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl bg-background/60"
                      onKeyDown={(e) => e.key === "Enter" && doVerify()}
                    />
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || otp.length !== 6}
                      onClick={doVerify}
                    >
                      {busy ? L("جارٍ التوثيق…", "Verifying…") : L("توثيق البريد", "Verify email")}{" "}
                      <ArrowRight className="size-4 flip-rtl" />
                    </Button>
                    <div className="flex justify-between text-sm">
                      <button className="text-muted-foreground hover:text-foreground" onClick={() => setStep("signin")}>
                        {L("رجوع لتسجيل الدخول", "Back to sign in")}
                      </button>
                      <button
                        className="text-primary hover:underline"
                        onClick={async () => {
                          const r = await api.resendOtp({ email, purpose: "verify" });
                          if (r.devOtp) setDemoInbox(r.devOtp);
                          toast({
                            title: (
                              <span className="flex items-center gap-2">
                                <Mail className="size-4 text-primary" aria-hidden="true" />
                                {L("أُعيد إرسال الكود", "Code resent")}
                              </span>
                            ),
                          });
                        }}
                      >
                        {L("إعادة إرسال الكود", "Resend code")}
                      </button>
                    </div>
                    <div className="text-center">
                      <button
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={async () => {
                          try {
                            const data = await api.login({ identifier: email, password });
                            finishAuth(data);
                          } catch {
                            toast({
                              title: L("وثّق أولاً لفتح كل شيء", "Verify first to unlock everything"),
                              description: L(
                                "أو سجّل الدخول غير موثّق — يمكنك التوثيق لاحقاً من الإعدادات.",
                                "Or sign in unverified — you can verify later from settings."
                              ),
                            });
                            const data = await api.login({ identifier: email, password }).catch(() => null);
                            if (data) finishAuth(data);
                          }
                        }}
                      >
                        {L("التخطي الآن (توثيق لاحقاً)", "Skip for now (verify later)")}
                      </button>
                    </div>
                  </div>
                )}

                {step === "twofactor" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="size-4 text-primary shrink-0" />
                      {L("حسابك مفعّل عليه التحقق بخطوتين.", "Your account has 2FA enabled.")}
                    </div>
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={L("كود 6 أرقام", "6-digit code")}
                      inputMode="numeric"
                      className="h-14 text-center text-2xl font-mono tracking-[0.5em] rounded-xl bg-background/60"
                      onKeyDown={(e) => e.key === "Enter" && doLogin(otp)}
                    />
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || otp.length !== 6}
                      onClick={() => doLogin(otp)}
                    >
                      {L("تحقّق وسجّل الدخول", "Verify & sign in")}
                    </Button>
                    <button
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setStep("signin")}
                    >
                      {L("رجوع", "Back")}
                    </button>
                  </div>
                )}

                {step === "forgot" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {L("أدخل بريد حسابك — سنرسل كود استعادة.", "Enter your account email — we'll send a reset code.")}
                    </p>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@catmail.com"
                      className="h-11 rounded-xl bg-background/60"
                    />
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || !email}
                      onClick={doForgot}
                    >
                      {L("إرسال كود الاستعادة", "Send reset code")}
                    </Button>
                    <button
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setStep("signin")}
                    >
                      {L("رجوع لتسجيل الدخول", "Back to sign in")}
                    </button>
                  </div>
                )}

                {step === "reset" && (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {L(
                        "أدخل الكود + كلمة المرور الجديدة. سيتم تسجيل الخروج من بقية الجلسات.",
                        "Enter the code + your new password. All other sessions will be signed out."
                      )}
                    </p>
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder={L("كود 6 أرقام", "6-digit code")}
                      inputMode="numeric"
                      className="h-11 rounded-xl bg-background/60 font-mono tracking-[0.3em]"
                    />
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder={L("كلمة المرور الجديدة", "New password")}
                      className="h-11 rounded-xl bg-background/60"
                    />
                    <Button
                      className="w-full h-11 rounded-xl meev-gradient-btn text-white font-bold"
                      disabled={busy || otp.length !== 6 || !newPassword}
                      onClick={doReset}
                    >
                      {L("تعيين كلمة المرور", "Reset password")}
                    </Button>
                    <button
                      className="w-full text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => setStep("signin")}
                    >
                      {L("رجوع لتسجيل الدخول", "Back to sign in")}
                    </button>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
