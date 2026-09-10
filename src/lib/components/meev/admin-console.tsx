"use client";

// ============================================================
// MEEV v20 — MeevCMD: the staff console, a real terminal.
//
// A CMD-style interface for the staff ladder (support → moderator
// → admin → superadmin → owner): type commands, read bilingual
// output, browse the audit trail. Commands are parsed and
// permission-checked on the SERVER (src/lib/meev/admin.ts) — the
// console is a thin, honest client over POST /api/admin/command.
//
//   · command history (↑/↓) like a real terminal
//   · boot banner + typed boot sequence
//   · `help` prints the full role × command matrix (v20)
//   · audit log side panel (OWNER only — the boss's oversight)
//   · quick-command chips filtered to YOUR rank's permissions
//   · fully bilingual (AR/EN)
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useMeev } from "./store";
import { useI18n } from "./i18n";
import { api } from "./api";
import { MeevLogo } from "./logo";
import { RoleBadge } from "./username";
import { cn } from "@/lib/utils";
import { Terminal, ChevronRight, ShieldCheck, Loader2, ScrollText, Lock } from "lucide-react";

type Line = { id: number; text: string; kind: "in" | "ok" | "err" | "info" | "sys" };

const BOOT: { text: string; kind: Line["kind"] }[] = [
  { text: "MeevCMD v20 — staff console", kind: "sys" },
  { text: "الوحدة الطرفية للإدارة — أوامر فورية بصلاحيات رتبتك", kind: "info" },
  { text: "اتصال قاعدة البيانات… تم ✓  ·  محرك الصلاحيات… تم ✓  ·  سجل التدقيق… تم ✓", kind: "ok" },
  { text: "اكتب help لعرض مصفوفة الأوامر حسب الرتبة · type help for the role matrix", kind: "info" },
];

// v20: client mirror of ROLE_RANK (admin.ts is server-only — it imports
// Prisma). Used to filter quick chips + the owner-only audit panel.
const RANK: Record<string, number> = {
  user: 0,
  support: 1,
  moderator: 2,
  admin: 3,
  superadmin: 4,
  owner: 5,
};

let lineSeq = 1;

export function AdminConsole() {
  const me = useMeev((s) => s.me);
  const { L, dir } = useI18n();
  const [lines, setLines] = useState<Line[]>(BOOT.map((b) => ({ id: lineSeq++, ...b })));
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<
    { id: string; action: string; actionAr: string; summary: string; by: string; createdAt: string }[] | null
  >(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myRank = RANK[me?.role ?? "user"] ?? 0;
  const isOwner = me?.role === "owner";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines, busy]);

  const loadLogs = useCallback(async () => {
    try {
      const r = await api.adminLogs(1);
      setLogs(r.logs);
    } catch {
      setLogs([]);
    }
  }, []);

  useEffect(() => {
    if (showLogs) loadLogs();
  }, [showLogs, loadLogs]);

  const run = async () => {
    const command = input.trim();
    if (!command || busy) return;
    setInput("");
    setHistory((h) => [command, ...h].slice(0, 50));
    setHistIdx(-1);
    setLines((prev) => [...prev, { id: lineSeq++, text: `${dir === "rtl" ? "❯" : "$"} ${command}`, kind: "in" }]);
    setBusy(true);
    try {
      const r = await api.adminCommand(command);
      setLines((prev) => [
        ...prev,
        ...r.lines.map((text) => ({ id: lineSeq++, text, kind: r.ok ? ("ok" as const) : ("err" as const) })),
      ]);
      if (showLogs) loadLogs();
    } catch (e) {
      setLines((prev) => [
        ...prev,
        { id: lineSeq++, text: e instanceof Error ? `✗ ${e.message}` : "✗ connection failed", kind: "err" },
      ]);
    } finally {
      setBusy(false);
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length) {
        const next = Math.min(history.length - 1, histIdx + 1);
        setHistIdx(next);
        setInput(history[next] ?? "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const next = histIdx - 1;
      if (next < 0) {
        setHistIdx(-1);
        setInput("");
      } else {
        setHistIdx(next);
        setInput(history[next] ?? "");
      }
    }
  };

  if (!me || (me.role !== "owner" && me.role !== "superadmin" && me.role !== "admin" && me.role !== "support" && me.role !== "moderator")) {
    return (
      <div className="h-full grid place-items-center">
        <div className="glass rounded-3xl p-10 flex flex-col items-center gap-4 text-center max-w-sm">
          <span className="size-14 rounded-2xl grid place-items-center bg-destructive/15 border border-destructive/30">
            <Lock className="size-7 text-destructive" />
          </span>
          <div className="font-black text-lg">{L("وصول محدود", "Restricted access")}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {L(
              "هذه اللوحة مخصصة لفريق Meev فقط — الرتب: Support · Moderator · Admin · Super Admin · Owner.",
              "This console is for the Meev staff only — roles: Support · Moderator · Admin · Super Admin · Owner.",
            )}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-4 pb-20 md:pb-6 space-y-3">
        {/* header */}
        <header className="flex items-center gap-3">
          <span className="size-11 rounded-2xl grid place-items-center bg-black border border-emerald-500/30 shadow-[0_0_18px_-4px_rgba(16,185,129,.5)]">
            <Terminal className="size-5 text-emerald-400" />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-black tracking-tight flex items-center gap-2">
              MeevCMD
              <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                v5.0
              </span>
            </h1>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              {L("طرفية الإدارة", "the staff console")} ·
              <RoleBadge role={me.role} size={14} />
              <span className="font-mono">@{me.username}</span>
            </div>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowLogs((v) => !v)}
              className={cn(
                "ms-auto h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors",
                showLogs
                  ? "border-emerald-500/50 bg-emerald-500/15 text-emerald-400"
                  : "border-border/60 bg-white/5 text-muted-foreground hover:text-foreground",
              )}
              aria-pressed={showLogs}
            >
              <ScrollText className="size-3.5" />
              <span className="hidden sm:inline">{L("سجل التدقيق", "Audit log")}</span>
            </button>
          )}
        </header>

        {/* audit log panel */}
        {showLogs && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl border-border/60 p-3">
            <div className="flex items-center gap-2 text-xs font-bold mb-2">
              <ShieldCheck className="size-4 text-emerald-400" />
              {L("آخر عمليات الإدارة", "Recent staff actions")}
              <button onClick={loadLogs} className="ms-auto text-[10px] text-muted-foreground hover:text-foreground">
                {L("تحديث", "Refresh")}
              </button>
            </div>
            <div className="max-h-40 overflow-y-auto space-y-1 text-[11px] font-mono">
              {logs === null && (
                <div className="flex items-center gap-2 text-muted-foreground p-2">
                  <Loader2 className="size-3.5 animate-spin" /> {L("جارٍ التحميل…", "Loading…")}
                </div>
              )}
              {logs?.length === 0 && <div className="p-2 text-muted-foreground">{L("لا عمليات بعد", "No actions yet")}</div>}
              {logs?.map((l) => (
                <div key={l.id} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2 py-1.5">
                  <span className="text-amber-400 shrink-0 font-bold">{l.actionAr}</span>
                  <span className="text-muted-foreground truncate" title={l.summary}>{l.summary}</span>
                  <span className="ms-auto text-muted-foreground/70 shrink-0">
                    @{l.by} · {new Date(l.createdAt).toLocaleTimeString(dir === "rtl" ? "ar" : undefined, { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* the terminal */}
        <div
          className="rounded-3xl overflow-hidden border border-[#1f2b24] shadow-2xl bg-[#050807]"
          dir={dir}
          role="application"
          aria-label="MeevCMD"
        >
          {/* window chrome */}
          <div className="flex items-center gap-2 px-4 h-10 bg-[#0a100c] border-b border-[#1f2b24]">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
            <span className="ms-2 text-[11px] font-mono text-emerald-400/70 flex items-center gap-1.5">
              <MeevLogo size={14} mood="default" speed={0.5} /> meev — {me.role}@meev
            </span>
          </div>

          {/* output */}
          <div
            className="h-[52dvh] min-h-[300px] overflow-y-auto p-4 font-mono text-[13px] leading-relaxed cursor-text"
            onClick={() => inputRef.current?.focus()}
          >
            {lines.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "whitespace-pre-wrap break-words",
                  l.kind === "in" && "text-emerald-300 font-bold",
                  l.kind === "ok" && "text-emerald-400/90",
                  l.kind === "err" && "text-rose-400",
                  l.kind === "info" && "text-sky-300/80",
                  l.kind === "sys" && "text-amber-300 font-bold",
                )}
              >
                {l.text}
              </div>
            ))}
            {busy && (
              <div className="text-emerald-400/60 flex items-center gap-2">
                <Loader2 className="size-3.5 animate-spin" />
                {L("جارٍ التنفيذ…", "executing…")}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* input line */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-[#1f2b24] bg-[#0a100c]">
            <ChevronRight className="size-4 text-emerald-400 shrink-0 flip-rtl" />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, 300))}
              onKeyDown={onKey}
              disabled={busy}
              placeholder={L("اكتب أمراً… (help)", "type a command… (help)")}
              className="flex-1 bg-transparent outline-none font-mono text-[13px] text-emerald-300 placeholder:text-emerald-700 caret-emerald-400"
              autoComplete="off"
              spellCheck={false}
              aria-label={L("سطر الأوامر", "Command line")}
            />
            <span className="w-2 h-4 bg-emerald-400/80 animate-pulse" aria-hidden="true" />
          </div>
        </div>

        {/* quick commands — v20: filtered to what YOUR rank may run */}
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { cmd: "help", label: L("الأوامر", "help"), min: 0 },
              { cmd: "tickets open", label: L("التذاكر", "tickets"), min: 1 },
              { cmd: "whois @", label: "whois", min: 1 },
              { cmd: "mute @ 30m", label: L("كتم ٣٠د", "mute 30m"), min: 2 },
              { cmd: "unmute @", label: "unmute", min: 2 },
              { cmd: "strikes @", label: "strikes", min: 2 },
              { cmd: "ban @ 7d", label: L("حظر ٧د", "ban 7d"), min: 4 },
              { cmd: "verify @", label: L("توثيق", "verify"), min: 4 },
              { cmd: "coins @ +500", label: "coins +500", min: 4 },
              { cmd: "audit", label: L("سجل التدقيق", "audit"), min: 5 },
              { cmd: "role @ support", label: "role", min: 5 },
              { cmd: "delete @ confirm", label: L("حذف", "delete"), min: 5 },
            ] as { cmd: string; label: string; min: number }[]
          )
            .filter((q) => myRank >= q.min)
            .map((q) => (
              <button
                key={q.cmd}
                onClick={() => {
                  setInput(q.cmd);
                  inputRef.current?.focus();
                }}
                className="rounded-full border border-border/60 bg-white/[0.04] hover:border-emerald-500/40 hover:text-emerald-400 px-3 py-1 text-[11px] font-mono text-muted-foreground transition-colors"
              >
                {q.label}
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
