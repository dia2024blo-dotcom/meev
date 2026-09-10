"use client";

// MEEV — Servers: Discord-style communities — server rail,
// channels, realtime chat with slash commands, members sidebar,
// create & join servers.

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { api } from "./api";
import { useMeev } from "./store";
import { meevSocket } from "./socket";
import { MeevCat } from "./cat-avatar";
import { MeevName, LevelPill } from "./username";
import { MeevLogo } from "./logo";
import { ChatMessage, TypingDots, SlashHints, timeAgo } from "./chat-shared";
import type { ServerDTO, MessageDTO, MiniUser } from "./types";
import { cn } from "@/lib/utils";
import { Hash, Volume2, Plus, Users, Send, Sparkles, MessageSquare, LogOut, Crown, Search, Megaphone, PartyPopper } from "lucide-react";

const EMOJI_CHOICES = ["🐱", "🎮", "🌸", "💻", "☕", "🎧", "⚽", "🎨", "🚀", "🐉", "🍕", "🌙", "⚡", "💎", "🔥", "🦊"];

export function ServersView() {
  const me = useMeev((s) => s.me);
  const activeServerId = useMeev((s) => s.serverId);
  const activeChannelId = useMeev((s) => s.channelId);
  const openServer = useMeev((s) => s.openServer);
  const openProfile = useMeev((s) => s.openProfile);
  const { toast } = useToast();

  const [servers, setServers] = useState<ServerDTO[]>([]);
  const [messages, setMessages] = useState<MessageDTO[]>([]);
  const [members, setMembers] = useState<{ user: MiniUser; role: string }[]>([]);
  const [input, setInput] = useState("");
  const [typingUsers, setTypingUsers] = useState<MiniUser[]>([]);
  const [showMembers, setShowMembers] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmoji, setCreateEmoji] = useState("🐱");
  const [creating, setCreating] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activeChannelRef = useRef<string | null>(null);
  const typingMap = useRef(new Map<string, { user: MiniUser; at: number }>());

  activeChannelRef.current = activeChannelId;

  useEffect(() => {
    api.servers().then((r) => {
      setServers(r.servers);
      // auto-select first joined server if none
      if (!useMeev.getState().serverId) {
        const joined = r.servers.find((s) => s.myRole);
        if (joined) openServer(joined.id, joined.channels[0]?.id);
      }
    }).catch(() => {});
     
  }, []);

  const server = servers.find((s) => s.id === activeServerId);
  const channel = server?.channels.find((c) => c.id === activeChannelId);

  const loadMessages = useCallback(async (serverId: string, channelId: string) => {
    try {
      const r = await api.channelMessages(serverId, channelId);
      setMessages(r.messages);
      meevSocket.joinServerChannel(channelId);
    } catch { /* not a member? */ }
  }, []);

  const loadMembers = useCallback(async (serverId: string) => {
    try {
      const r = await api.serverMembers(serverId);
      setMembers(r.members);
    } catch { setMembers([]); }
  }, []);

  useEffect(() => {
    if (activeServerId && activeChannelId) {
      setMessages([]);
      meevSocket.leaveServerChannel("__prev__");
      loadMessages(activeServerId, activeChannelId);
      loadMembers(activeServerId);
    }
     
  }, [activeServerId, activeChannelId]);

  // realtime
  useEffect(() => {
    const off: (() => void)[] = [];
    off.push(
      meevSocket.on("server:new", (p) => {
        const d = p as { channelId: string; message: MessageDTO };
        if (d.channelId !== activeChannelRef.current) return;
        setMessages((prev) => (prev.some((m) => m.id === d.message.id) ? prev : [...prev, d.message]));
        typingMap.current.delete(d.message.author.id);
        setTypingUsers(Array.from(typingMap.current.values()).map((v) => v.user));
      }),
      meevSocket.on("server:typing", (p) => {
        const d = p as { channelId: string; user: MiniUser };
        if (d.channelId !== activeChannelRef.current || d.user.id === me?.id) return;
        typingMap.current.set(d.user.id, { user: d.user, at: Date.now() });
        setTypingUsers(Array.from(typingMap.current.values()).map((v) => v.user));
        setTimeout(() => {
          for (const [id, v] of typingMap.current) if (Date.now() - v.at > 4000) typingMap.current.delete(id);
          setTypingUsers(Array.from(typingMap.current.values()).map((v) => v.user));
        }, 4200);
      }),
      meevSocket.on("msg:error", (p) => {
        toast({ title: "Message failed", description: (p as { error?: string }).error, variant: "destructive" });
      })
    );
    return () => off.forEach((f) => f());
     
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const send = () => {
    const content = input.trim();
    if (!content || !activeChannelId) return;
    meevSocket.sendServer(activeChannelId, content);
    setInput("");
  };

  const createServer = async () => {
    if (createName.trim().length < 2) return;
    setCreating(true);
    try {
      const r = await api.createServer({ name: createName.trim(), iconEmoji: createEmoji });
      setServers((prev) => [r.server, ...prev]);
      openServer(r.server.id, r.server.channels[0]?.id);
      setCreateOpen(false);
      setCreateName("");
      toast({
        title: (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            {`${r.server.name} created!`}
          </span>
        ),
        description: "Invite cats and make it home.",
      });
    } catch (e) {
      toast({ title: "Couldn't create server", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const joinServer = async (id: string) => {
    try {
      await api.joinServer(id);
      const r = await api.servers();
      setServers(r.servers);
      const joined = r.servers.find((s) => s.id === id);
      if (joined) openServer(id, joined.channels[0]?.id);
      toast({
        title: (
          <span className="flex items-center gap-2">
            <PartyPopper className="size-4 text-amber-400" aria-hidden="true" />
            Joined!
          </span>
        ),
      });
    } catch (e) {
      toast({ title: "Couldn't join", description: e instanceof Error ? e.message : "", variant: "destructive" });
    }
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* server rail */}
      <div className="w-16 sm:w-[72px] shrink-0 border-r border-border/50 bg-sidebar/60 backdrop-blur-xl flex flex-col items-center gap-2 py-3 overflow-y-auto no-scrollbar">
        <button
          onClick={() => setCreateOpen(true)}
          className="size-11 grid place-items-center rounded-2xl border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors meev-float"
          aria-label="Create server"
        >
          <Plus className="size-5" />
        </button>
        <div className="w-8 h-px bg-border/60" />
        {servers.map((s) => {
          const active = s.id === activeServerId;
          const joined = !!s.myRole;
          return (
            <button
              key={s.id}
              onClick={() => (joined ? openServer(s.id, s.channels[0]?.id) : joinServer(s.id))}
              title={s.name}
              className={cn(
                "relative size-11 sm:size-12 grid place-items-center rounded-2xl text-xl transition-all hover:rounded-xl",
                active ? "bg-primary/20 ring-2 ring-primary/40" : "bg-card border border-border/60 hover:border-primary/40",
                !joined && "opacity-70 grayscale-[35%]"
              )}
            >
              <span>{s.iconEmoji}</span>
              {active && <span className="absolute -left-2 w-1 h-6 rounded-r-full bg-primary" />}
              {!joined && <span className="absolute bottom-0.5 text-[8px] font-bold text-primary">JOIN</span>}
            </button>
          );
        })}
      </div>

      {/* channels */}
      <div className={cn("w-44 sm:w-56 shrink-0 border-r border-border/50 flex flex-col overflow-hidden bg-sidebar/40", activeChannelId ? "hidden sm:flex" : "flex")}>
        <div className="p-3.5 border-b border-border/50 shrink-0">
          <div className="font-bold text-sm truncate flex items-center gap-2" style={{ color: server?.accentColor }}>
            {server?.iconEmoji} {server?.name || "Pick a server"}
          </div>
          {server && <div className="text-[10px] text-muted-foreground mt-0.5">{server.memberCount} members{server.isOfficial && " · official"}</div>}
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {server?.channels.sort((a, b) => a.position - b.position).map((c) => {
            const active = c.id === activeChannelId;
            return (
              <button
                key={c.id}
                onClick={() => openServer(server.id, c.id)}
                className={cn(
                  "w-full flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm text-left transition-colors",
                  active ? "bg-primary/15 text-primary font-medium" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                )}
              >
                {c.kind === "voice" ? <Volume2 className="size-3.5 shrink-0" /> : <Hash className="size-3.5 shrink-0" />}
                <span className="truncate">{c.name}</span>
              </button>
            );
          })}
          {server && (
            <button
              onClick={() => joinServer(server.id)}
              className="w-full mt-2 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-2"
            >
              <Megaphone className="size-3.5" /> Invite cats
            </button>
          )}
          {!server && <div className="p-4 text-xs text-muted-foreground text-center">Join or create a community from the rail ←</div>}
        </div>
        {/* my card */}
        {me && (
          <div className="p-2.5 border-t border-border/50 flex items-center gap-2 shrink-0">
            <MeevCat seed={me.avatarSeed} fallback={me.id} size={32} level={me.level} presence={me.presence} avatarPhoto={me.avatarPhoto} frameKey={me.frameKey} avatarAcc={me.avatarAcc} name={me.displayName} />
            <div className="min-w-0">
              <MeevName displayName={me.displayName} level={me.level} nameColor={me.nameColor} nameFx={me.nameFx} compact />
              <div className="text-[10px] text-muted-foreground">{server?.myRole || "guest"}</div>
            </div>
          </div>
        )}
      </div>

      {/* chat */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {server && channel ? (
          <>
            <div className="p-3 border-b border-border/50 flex items-center gap-2.5 shrink-0 bg-card/40 backdrop-blur-xl">
              <Hash className="size-5 text-muted-foreground" />
              <div className="min-w-0">
                <div className="font-bold text-sm">{channel.name}</div>
                {channel.topic && <div className="text-[11px] text-muted-foreground truncate">{channel.topic}</div>}
              </div>
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" className="rounded-full hidden lg:grid" onClick={() => setShowMembers((v) => !v)} aria-label="Toggle members">
                  <Users className="size-4" />
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto py-3 min-h-0" style={{ backgroundImage: "radial-gradient(rgba(190,177,92,.05) 1px, transparent 1px)", backgroundSize: "24px 24px" }}>
              {messages.length === 0 && (
                <div className="h-full grid place-items-center">
                  <div className="text-center space-y-2 p-6">
                    <MeevLogo size={72} mood="blep" className="mx-auto" />
                    <div className="font-bold">Welcome to #{channel.name}!</div>
                    <div className="text-sm text-muted-foreground">This is the start of the channel. Try /help for commands!</div>
                  </div>
                </div>
              )}
              {messages.map((m) => (
                <ChatMessage key={m.id} message={m} mine={m.author.id === me?.id} />
              ))}
              {typingUsers.length > 0 && (
                <TypingDots label={`${typingUsers.map((u) => u.displayName.split(" ")[0]).join(", ")} ${typingUsers.length > 1 ? "are" : "is"} typing…`} />
              )}
              <div ref={chatEndRef} />
            </div>

            {/* input */}
            <div className="p-3 border-t border-border/50 shrink-0 bg-card/40 backdrop-blur-xl">
              <div className="relative flex items-center gap-2">
                <SlashHints value={input} />
                <input
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    if (activeChannelId && e.target.value && Date.now() % 3 === 0) meevSocket.serverTyping(activeChannelId);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder={`Message #${channel.name} — try /roll or /poll`}
                  className="flex-1 rounded-2xl bg-background/60 border border-border/60 px-4 py-2.5 text-sm outline-none focus:border-primary/50 meev-input-glow"
                  maxLength={2000}
                />
                <Button size="icon" className="rounded-full meev-gradient-btn text-white shrink-0" onClick={send} disabled={!input.trim()} aria-label="Send message">
                  <Send className="size-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 grid place-items-center p-8">
            <div className="text-center space-y-3 max-w-xs">
              <MeevLogo size={100} mood="party" className="mx-auto meev-float" speed={0.9} />
              <div className="font-bold text-lg">Communities</div>
              <div className="text-sm text-muted-foreground">Join a server from the rail or create your own den.</div>
              <Button className="rounded-xl meev-gradient-btn text-white" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" /> Create a server
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* members sidebar */}
      <AnimatePresence>
        {showMembers && server && members.length > 0 && (
          <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="hidden lg:flex flex-col border-l border-border/50 overflow-hidden shrink-0 bg-sidebar/40">
            <div className="p-3 border-b border-border/50 text-xs font-bold uppercase tracking-widest text-muted-foreground shrink-0">
              Members — {members.length}
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {members
                .sort((a, b) => (a.role === "owner" ? -1 : b.role === "owner" ? 1 : 0))
                .map((m) => (
                  <button key={m.user.id} onClick={() => openProfile(m.user.username)} className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-white/5 text-left">
                    <MeevCat seed={m.user.avatarSeed} fallback={m.user.id} size={30} presence={m.user.presence} avatarPhoto={m.user.avatarPhoto} frameKey={m.user.frameKey} avatarAcc={m.user.avatarAcc} name={m.user.displayName} />
                    <div className="min-w-0 flex-1">
                      <MeevName displayName={m.user.displayName} level={m.user.level} nameColor={m.user.nameColor} nameFx={m.user.nameFx} compact />
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        {m.role === "owner" && <Crown className="size-2.5 text-amber-400" />}
                        {m.role}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* create server dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm rounded-3xl glass">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="size-5 text-primary" /> Create your community</DialogTitle>
          </DialogHeader>
          <Input value={createName} onChange={(e) => setCreateName(e.target.value.slice(0, 40))} placeholder="Server name (e.g. Catnip Club)" className="rounded-xl bg-background/50" />
          <div className="grid grid-cols-8 gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                onClick={() => setCreateEmoji(e)}
                className={cn("aspect-square rounded-xl text-xl grid place-items-center border transition-colors", createEmoji === e ? "border-primary bg-primary/15" : "border-border/60 hover:border-primary/40")}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">Starts with #general, #introductions and #random channels.</div>
          <Button className="w-full rounded-xl meev-gradient-btn text-white font-bold" disabled={createName.trim().length < 2 || creating} onClick={createServer}>
            {creating ? "Creating…" : "Create server"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
