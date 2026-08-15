"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clearProfile, getProfile, getMemory, saveMemory } from "@/lib/storage";
import { ALL_ROLES, generateWorkforce, getRoleMeta } from "@/lib/bots";
import { Bot, BotRole, CompanyProfile } from "@/lib/types";
import BotAvatar from "@/components/BotAvatar";

const BOT_COUNT = 500;

/* ---------- helpers ---------- */

function greeting(h: number) {
  if (h < 5) return { text: "Late night grind", emoji: "🌙" };
  if (h < 12) return { text: "Good morning", emoji: "☀️" };
  if (h < 17) return { text: "Good afternoon", emoji: "🌤️" };
  if (h < 21) return { text: "Good evening", emoji: "🌆" };
  return { text: "Night shift on", emoji: "🌙" };
}

const ACTIVITY_TEMPLATES: Record<BotRole, string[]> = {
  developer: ["shipped a landing page", "fixed a production bug", "reviewed a pull request"],
  debugger: ["traced a console error", "fixed a broken button live", "verified a fix in the browser", "audited page performance"],
  hr: ["drafted a job post", "scheduled 3 interviews", "updated the handbook"],
  sales: ["sent 12 cold emails", "booked a demo call", "closed a follow-up"],
  support: ["resolved 8 tickets", "wrote a refund reply", "updated the FAQ"],
  marketing: ["planned a campaign", "wrote 5 ad captions", "published a reel script"],
  accountant: ["reconciled expenses", "prepared a P&L draft", "filed GST notes"],
  writer: ["finished a blog draft", "polished hero copy", "outlined a newsletter"],
  researcher: ["mapped 3 competitors", "summarized a market report", "collected pricing data"],
};

interface Activity {
  id: number;
  name: string;
  role: BotRole;
  action: string;
  seed: string;
  ago: string;
}

interface Recent {
  bot: Bot;
  last: string;
  when: string;
}

function timeAgo(ts: number) {
  if (!ts) return "";
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "abhi";
  if (m < 60) return `${m}m pehle`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h pehle`;
  return `${Math.floor(h / 24)}d pehle`;
}

/* ---------- page ---------- */

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [filter, setFilter] = useState<BotRole | "all">("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(48);
  const [now, setNow] = useState<Date | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [recents, setRecents] = useState<Recent[]>([]);
  const [memOpen, setMemOpen] = useState(false);
  const [memText, setMemText] = useState("");
  const [memSaved, setMemSaved] = useState(false);
  const [connOpen, setConnOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [pairCode, setPairCode] = useState("····-····");
  const [notify, setNotify] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (memOpen) setMemText(getMemory());
  }, [memOpen]);

  useEffect(() => {
    if (!browserOpen) return;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const gen = (n: number) =>
      Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    setPairCode(`${gen(4)}-${gen(4)}`);
    setNotify(false);
  }, [browserOpen]);

  useEffect(() => {
    const p = getProfile();
    if (!p?.companyName) {
      router.replace(p?.email ? "/onboarding" : "/");
      return;
    }
    setProfile(p);
  }, [router]);

  /* live clock */
  useEffect(() => {
    setNow(new Date());
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const workforce = useMemo<Bot[]>(() => generateWorkforce(BOT_COUNT), []);

  /* recent conversations from local history */
  useEffect(() => {
    if (!profile) return;
    try {
      const items: { bot: Bot; last: string; ts: number }[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i) || "";
        if (!k.startsWith("clawagent.chat.")) continue;
        const botId = k.slice("clawagent.chat.".length);
        const bot = workforce.find((b) => b.id === botId);
        if (!bot) continue;
        const msgs = JSON.parse(window.localStorage.getItem(k) || "[]");
        if (!Array.isArray(msgs) || msgs.length < 2) continue;
        const lastMsg = msgs[msgs.length - 1] as { content?: string; createdAt?: string };
        items.push({
          bot,
          last: (lastMsg.content || "").replace(/\s+/g, " ").slice(0, 90),
          ts: Date.parse(lastMsg.createdAt || "") || 0,
        });
      }
      items.sort((a, b) => b.ts - a.ts);
      setRecents(items.slice(0, 4).map((x) => ({ bot: x.bot, last: x.last, when: timeAgo(x.ts) })));
    } catch {
      /* localStorage unreadable — skip */
    }
  }, [profile, workforce]);

  /* rotating activity feed */
  useEffect(() => {
    if (!workforce.length) return;
    let id = 0;
    const make = (): Activity => {
      const b = workforce[Math.floor(Math.random() * workforce.length)];
      const acts = ACTIVITY_TEMPLATES[b.role];
      return {
        id: id++,
        name: b.name,
        role: b.role,
        action: acts[Math.floor(Math.random() * acts.length)],
        seed: b.avatarSeed,
        ago: "just now",
      };
    };
    setActivities([make(), make(), make(), make()]);
    const iv = setInterval(() => {
      setActivities((prev) => {
        const aged = prev.map((a, i) => ({
          ...a,
          ago: i === 0 ? "1m ago" : i === 1 ? "3m ago" : i === 2 ? "6m ago" : "9m ago",
        }));
        return [make(), ...aged].slice(0, 4);
      });
    }, 4000);
    return () => clearInterval(iv);
  }, [workforce]);

  /* "/" focuses search, Ctrl+K opens command palette */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") setPaletteOpen(false);
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    let list = workforce;
    if (filter !== "all") list = list.filter((b) => b.role === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          getRoleMeta(b.role).title.toLowerCase().includes(q),
      );
    }
    return list;
  }, [workforce, filter, search]);

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const b of workforce) byRole[b.role] = (byRole[b.role] || 0) + 1;
    const active = workforce.filter((b) => b.status === "active").length;
    const working = workforce.filter((b) => b.status === "working").length;
    return { byRole, active, working, total: workforce.length };
  }, [workforce]);

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#081210] text-emerald-100/60">
        Loading your office…
      </main>
    );
  }

  const handleLogout = () => {
    if (confirm("Sign out? Your workspace is saved on this device only.")) {
      clearProfile();
      router.replace("/");
    }
  };

  const g = greeting(now ? now.getHours() : 12);
  const firstName = profile.companyName.split(" ")[0];

  return (
    <main className="min-h-screen bg-[#081210] text-emerald-50 lg:flex" style={{ backgroundImage: "radial-gradient(900px 500px at 85% -5%, rgba(16,185,129,0.14), transparent 60%), radial-gradient(700px 450px at -5% 100%, rgba(245,158,11,0.08), transparent 60%)" }}>
      <style>{`
        @keyframes caFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        @keyframes caSlideIn { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: none; } }
        @keyframes caRing { 0% { box-shadow: 0 0 0 0 rgba(16,185,129,.45); } 100% { box-shadow: 0 0 0 9px rgba(16,185,129,0); } }
        .ca-up { animation: caFadeUp .5s ease both; }
        .ca-slide { animation: caSlideIn .45s ease both; }
        .ca-ring { animation: caRing 2s ease-out infinite; }
        .ca-card { background: rgba(10, 24, 20, 0.75); border: 1px solid rgba(16, 185, 129, 0.14); backdrop-filter: blur(12px); }
        .ca-card:hover { border-color: rgba(16, 185, 129, 0.4); }
      `}</style>

      {/* ---------- Sidebar (desktop) ---------- */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-emerald-500/10 bg-[#0a1613]/80 backdrop-blur-xl sticky top-0 h-screen">
        <div className="p-6 flex items-center gap-3 border-b border-emerald-500/10">
          {profile.logoDataUrl ? (
            <img src={profile.logoDataUrl} alt="" className="w-11 h-11 rounded-xl object-contain bg-white/5 p-1" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-400 flex items-center justify-center text-2xl">🦾</div>
          )}
          <div className="min-w-0">
            <div className="font-bold truncate">{profile.companyName}</div>
            <div className="text-[11px] text-amber-300/80 tracking-wide uppercase">HQ · Mission Control</div>
          </div>
        </div>

        <div className="p-4 text-[11px] uppercase tracking-widest text-emerald-100/40">Departments</div>
        <nav className="px-3 space-y-1 overflow-y-auto flex-1">
          <DeptButton active={filter === "all"} onClick={() => { setFilter("all"); setVisible(48); }} emoji="🏢" label="Poora office" count={stats.total} />
          {ALL_ROLES.map((role) => {
            const meta = getRoleMeta(role);
            return (
              <DeptButton key={role} active={filter === role} onClick={() => { setFilter(role); setVisible(48); }} emoji={meta.emoji} label={meta.title} count={stats.byRole[role] || 0} />
            );
          })}
        </nav>

        <div className="p-4 border-t border-emerald-500/10">
          <button
            onClick={() => setMemOpen(true)}
            className="w-full text-left text-sm px-3 py-2 mb-1 rounded-lg text-amber-300/90 hover:bg-amber-500/10 transition-colors"
          >
            🧠 Business Memory
          </button>
          <button
            onClick={() => setConnOpen(true)}
            className="w-full text-left text-sm px-3 py-2 mb-1 rounded-lg text-cyan-300/90 hover:bg-cyan-500/10 transition-colors"
          >
            🔌 Connections
          </button>
          <button
            onClick={() => setBrowserOpen(true)}
            className="w-full text-left text-sm px-3 py-2 mb-1 rounded-lg text-sky-300/90 hover:bg-sky-500/10 transition-colors flex items-center gap-2"
          >
            🖥️ Connect Browser
            <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/25">soon</span>
          </button>
          <div className="text-xs text-emerald-100/50 mb-2">Powered by Clawagent</div>
          <button onClick={handleLogout} className="w-full text-left text-sm px-3 py-2 rounded-lg text-emerald-100/70 hover:bg-rose-500/10 hover:text-rose-300 transition-colors">
            ⎋ Sign out
          </button>
        </div>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-40 border-b border-emerald-500/10 bg-[#081210]/80 backdrop-blur-xl">
          <div className="px-5 lg:px-8 py-3.5 flex items-center gap-3">
            <button className="lg:hidden text-xl" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">☰</button>
            <div className="lg:hidden font-bold truncate">{profile.companyName}</div>
            <div className="flex-1 max-w-xl hidden sm:block">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-100/40 text-sm">🔎</span>
                <input
                  ref={searchRef}
                  className="w-full bg-emerald-950/40 border border-emerald-500/15 focus:border-emerald-400/50 outline-none rounded-xl pl-9 pr-16 py-2.5 text-sm placeholder:text-emerald-100/35"
                  placeholder="Employee ya role dhundo…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setVisible(48); }}
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] border border-emerald-500/25 rounded px-1.5 py-0.5 text-emerald-100/40">/</kbd>
              </div>
            </div>
            <div className="flex-1 sm:hidden" />
            <div className="text-right">
              <div className="font-mono text-sm tabular-nums text-amber-300">
                {now ? now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "--:--:--"}
              </div>
              <div className="text-[10px] text-emerald-100/40 flex items-center justify-end gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 ca-ring" /> office live
              </div>
            </div>
            <button onClick={handleLogout} className="hidden lg:hidden" />
            <button onClick={handleLogout} className="lg:hidden text-xs text-emerald-100/60 border border-emerald-500/20 rounded-lg px-2.5 py-1.5">Sign out</button>
          </div>

          {/* Mobile departments drawer */}
          {menuOpen && (
            <div className="lg:hidden border-t border-emerald-500/10 px-4 py-3 flex gap-2 flex-wrap bg-[#0a1613]">
              <MobilePill active={filter === "all"} onClick={() => { setFilter("all"); setMenuOpen(false); }} label={`🏢 All · ${stats.total}`} />
              {ALL_ROLES.map((role) => {
                const meta = getRoleMeta(role);
                return <MobilePill key={role} active={filter === role} onClick={() => { setFilter(role); setMenuOpen(false); }} label={`${meta.emoji} ${meta.title} · ${stats.byRole[role] || 0}`} />;
              })}
            </div>
          )}
        </header>

        <div className="px-5 lg:px-8 py-7 max-w-6xl">
          {/* Greeting */}
          <section className="ca-up mb-7">
            <div className="text-amber-300/90 text-sm font-medium tracking-wide">{g.emoji} {g.text}</div>
            <h1 className="text-3xl lg:text-[2.6rem] leading-tight font-black mt-1">
              {firstName} ka office <span className="bg-gradient-to-r from-emerald-300 to-teal-200 bg-clip-text text-transparent">full speed</span> par hai
            </h1>
            <p className="text-emerald-100/55 mt-2 max-w-2xl">
              {stats.active} employees abhi active hain. Kisi par bhi click karo aur seedha kaam batao — baaki wo sambhal lenge.
            </p>
          </section>

          {/* Stats */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-7">
            <Stat label="Team size" value={stats.total} suffix="" tone="emerald" delay={0} />
            <Stat label="Abhi active" value={stats.active} suffix="" tone="amber" delay={80} />
            <Stat label="Tasks par lage" value={stats.working} suffix="" tone="teal" delay={160} />
            <Stat label="Departments" value={ALL_ROLES.length} suffix="" tone="emerald" delay={240} />
          </section>

          {/* Recent conversations */}
          {recents.length > 0 && (
            <section className="mb-7">
              <h2 className="text-xs uppercase tracking-widest text-emerald-100/50 mb-3">🕑 Recent baat-cheet</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {recents.map((r) => (
                  <Link key={r.bot.id} href={`/chat/${r.bot.id}`} className="ca-card ca-up rounded-2xl p-3.5 flex items-center gap-3 group hover:-translate-y-0.5 transition-all">
                    <BotAvatar seed={r.bot.avatarSeed} size={38} emoji={getRoleMeta(r.bot.role).emoji} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold truncate">{r.bot.name}</span>
                        <span className="text-[10px] text-emerald-100/35 shrink-0">{r.when}</span>
                      </div>
                      <div className="text-xs text-emerald-100/55 truncate">{r.last}</div>
                    </div>
                    <span className="text-amber-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">→</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* Activity feed */}
          <section className="ca-card rounded-2xl p-4 mb-8 overflow-hidden">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">📡</span>
              <h2 className="text-xs uppercase tracking-widest text-emerald-100/50">Live office feed</h2>
            </div>
            <div className="space-y-2">
              {activities.map((a) => (
                <div key={a.id} className="ca-slide flex items-center gap-3 text-sm">
                  <BotAvatar seed={a.seed} size={26} emoji={getRoleMeta(a.role).emoji} />
                  <span className="font-semibold text-emerald-50">{a.name}</span>
                  <span className="text-emerald-100/60 truncate">{a.action}</span>
                  <span className="ml-auto shrink-0 text-[11px] text-emerald-100/35">{a.ago}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Team */}
          <section className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">
              {filter === "all" ? "Poori team" : `${getRoleMeta(filter).emoji} ${getRoleMeta(filter).title} floor`}
              <span className="ml-2 text-sm font-normal text-emerald-100/45">{filtered.length} log</span>
            </h2>
            {filter !== "all" && (
              <button onClick={() => setFilter("all")} className="text-xs text-amber-300 hover:text-amber-200">← Poora office dekho</button>
            )}
          </section>

          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.slice(0, visible).map((bot, i) => (
              <EmployeeCard key={bot.id} bot={bot} index={i} />
            ))}
          </section>

          {visible < filtered.length && (
            <div className="flex justify-center mt-8">
              <button
                className="px-8 py-3 rounded-xl font-semibold text-emerald-950 bg-gradient-to-r from-emerald-400 to-teal-300 hover:brightness-110 shadow-lg shadow-emerald-500/25 transition-all"
                onClick={() => setVisible((v) => v + 48)}
              >
                Aur dikhao ({filtered.length - visible} baaki)
              </button>
            </div>
          )}

          {filtered.length === 0 && (
            <div className="text-center py-16 text-emerald-100/50">
              Koi employee nahi mila — spelling check karke dobara try karo.
            </div>
          )}

          <footer className="mt-12 pb-8 text-center text-[11px] text-emerald-100/30">
            {profile.companyName} HQ · sab systems green ✅ · <kbd className="border border-emerald-500/25 rounded px-1">Ctrl</kbd>+<kbd className="border border-emerald-500/25 rounded px-1">K</kbd> se kisi ko bhi bulao
          </footer>
        </div>
      </div>

      {paletteOpen && (
        <CommandPalette
          workforce={workforce}
          onClose={() => setPaletteOpen(false)}
          onPick={(id) => { setPaletteOpen(false); router.push(`/chat/${id}`); }}
        />
      )}

      {memOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/60 backdrop-blur-sm" onClick={() => setMemOpen(false)}>
          <div className="ca-up w-full max-w-xl rounded-2xl overflow-hidden border border-amber-400/30 bg-[#0a1815] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5">
              <h3 className="font-bold text-lg">🧠 Business Memory</h3>
              <p className="text-xs text-emerald-100/55 mt-1">
                Yahan apne business ki details likho — <b>saare 500 employees</b> har chat mein inhe yaad rakhenge. Kabhi bhi update kar sakte ho.
              </p>
            </div>
            <div className="p-5">
              <textarea
                value={memText}
                onChange={(e) => { setMemText(e.target.value); setMemSaved(false); }}
                rows={8}
                placeholder={"Jaise:\n- Hum Jaipur mein ek sweet shop chalate hain — 'Raj Mishthan'\n- Speciality: ghewar aur kaju katli\n- Customers se Hindi mein baat karo, tone friendly\n- Website: rajmishthan.com · Insta: @rajmishthan"}
                className="w-full bg-emerald-950/40 border border-emerald-500/20 focus:border-amber-400/50 outline-none rounded-xl p-3 text-sm placeholder:text-emerald-100/30 resize-none"
              />
              <div className="flex items-center gap-3 mt-3">
                <button
                  onClick={() => { saveMemory(memText); setMemSaved(true); setTimeout(() => setMemOpen(false), 700); }}
                  className="px-6 py-2.5 rounded-xl font-semibold text-emerald-950 bg-gradient-to-r from-amber-400 to-amber-300 hover:brightness-110 transition-all"
                >
                  {memSaved ? "✓ Save ho gaya!" : "Save karo"}
                </button>
                <button onClick={() => setMemOpen(false)} className="text-sm text-emerald-100/60 hover:text-emerald-100">Band karo</button>
                <span className="ml-auto text-[11px] text-emerald-100/35">{memText.length}/4000</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {connOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] px-4 bg-black/60 backdrop-blur-sm" onClick={() => setConnOpen(false)}>
          <div className="ca-up w-full max-w-xl rounded-2xl overflow-hidden border border-cyan-400/30 bg-[#0a1815] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5">
              <h3 className="font-bold text-lg">🔌 Connections — WhatsApp & Facebook</h3>
              <p className="text-xs text-emerald-100/55 mt-1">
                Sales, Support aur Marketing bots <b>real WhatsApp messages</b> bhej sakte hain aur{" "}
                <b>Facebook Page pe post</b> kar sakte hain — official Meta APIs se. Har message aapke
                click ke baad hi jata hai.
              </p>
            </div>
            <div className="p-5 space-y-4 text-sm max-h-[60vh] overflow-y-auto">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-4">
                <div className="font-semibold text-emerald-300 mb-1.5">💬 WhatsApp (Meta Cloud API)</div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-100/70 text-[13px]">
                  <li><span className="text-emerald-100">developers.facebook.com</span> pe app banao → WhatsApp product add karo</li>
                  <li>Wahan se <b>Access Token</b> aur <b>Phone Number ID</b> copy karo</li>
                  <li>Vercel → Project → Settings → <b>Environment Variables</b> mein add karo:</li>
                </ol>
                <div className="mt-2 font-mono text-[12px] bg-black/40 rounded-lg p-2.5 text-cyan-200">
                  WHATSAPP_TOKEN=EAAB…<br />WHATSAPP_PHONE_ID=1234567890
                </div>
              </div>
              <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4">
                <div className="font-semibold text-blue-300 mb-1.5">📘 Facebook Page (Graph API)</div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-100/70 text-[13px]">
                  <li>Usi Meta app mein <b>Page access token</b> generate karo (permission: pages_manage_posts)</li>
                  <li>Apni Page ki <b>Page ID</b> note karo</li>
                  <li>Vercel env vars mein add karo:</li>
                </ol>
                <div className="mt-2 font-mono text-[12px] bg-black/40 rounded-lg p-2.5 text-cyan-200">
                  META_PAGE_TOKEN=EAAB…<br />META_PAGE_ID=9876543210
                </div>
              </div>
              <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4">
                <div className="font-semibold text-sky-300 mb-1.5">✈️ Telegram (Bot API)</div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-100/70 text-[13px]">
                  <li>Telegram me <b>@BotFather</b> kholo → <b>/newbot</b> → naam do</li>
                  <li>Wo ek <b>Bot Token</b> dega — copy karo</li>
                  <li>Vercel env vars mein add karo:</li>
                </ol>
                <div className="mt-2 font-mono text-[12px] bg-black/40 rounded-lg p-2.5 text-cyan-200">
                  TELEGRAM_BOT_TOKEN=123456:ABC-DEF…
                </div>
                <p className="text-[11px] text-emerald-100/45 mt-1.5">Sabse easy setup — 1 minute me ho jata hai. Customer ko pehle bot pe <b>Start</b> dabana padta hai (Telegram ka rule).</p>
              </div>
              <p className="text-[12px] text-emerald-100/50">
                Env vars add karne ke baad Vercel pe <b>Redeploy</b> karo. Phir kisi Sales/Support/Marketing
                bot se bolo — <i>&quot;9198… pe WhatsApp bhejo ki order ready hai&quot;</i> — bot ek send-card
                banayega, aap Send dabaoge, message chala jayega. ✅
                <br />Note: WhatsApp ka niyam — naye customer ko pehle template message ya unke reply ke 24h
                window mein hi bhej sakte ho (ye Meta ka rule hai).
              </p>
              <div className="flex">
                <button onClick={() => setConnOpen(false)} className="ml-auto text-sm text-emerald-100/60 hover:text-emerald-100">Band karo</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {browserOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[6vh] px-4 bg-black/60 backdrop-blur-sm" onClick={() => setBrowserOpen(false)}>
          <div className="ca-up w-full max-w-2xl rounded-2xl overflow-hidden border border-sky-400/30 bg-[#0a1815] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 pt-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg flex items-center gap-2">
                  🖥️ Connect Browser
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-400/15 text-amber-300 border border-amber-400/30">Coming soon</span>
                </h3>
                <p className="text-xs text-emerald-100/55 mt-1">
                  Apna browser jodo — phir bots aapke <b>saamne</b> Google, Facebook, WhatsApp jaise sites pe kaam karte hue dikhein. Live preview neeche 👇
                </p>
              </div>
              <button onClick={() => setBrowserOpen(false)} className="text-emerald-100/50 hover:text-emerald-100 text-lg leading-none">✕</button>
            </div>

            <div className="p-5 space-y-4 max-h-[66vh] overflow-y-auto">
              {/* LIVE control preview — the CONTROLLED site is what shows, being driven */}
              <LiveBrowserDemo />

              {/* pairing code */}
              <div className="rounded-xl border border-sky-500/20 bg-sky-950/20 p-4 text-center">
                <div className="text-[11px] uppercase tracking-widest text-sky-200/60 mb-1">Pairing code (demo)</div>
                <div className="font-mono text-2xl font-bold tracking-[0.3em] text-sky-200">{pairCode}</div>
                <p className="text-[11px] text-emerald-100/45 mt-1">Jab extension ready hoga, ye code usme daalke browser paired ho jayega.</p>
              </div>

              {/* how it will work */}
              <div className="text-sm">
                <div className="font-semibold text-emerald-200 mb-1.5">Ye aise kaam karega:</div>
                <ol className="list-decimal list-inside space-y-1 text-emerald-100/70 text-[13px]">
                  <li>ClawAgent ka <b>Chrome extension</b> install karo</li>
                  <li>Upar wala <b>pairing code</b> extension me daalo</li>
                  <li>Bots aapke saamne current page pe kaam karein — aap kabhi bhi rok sakte ho</li>
                </ol>
              </div>

              {/* honest note */}
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 p-3 text-[12px] text-amber-100/70">
                <b className="text-amber-300">Dhyan do:</b> Browser control tabhi chalega jab aap saamne ho (safety ke liye). Facebook/Google/WhatsApp par <b>auto-login nahi</b> hota — wo platforms bots ko ban karte hain. Un par real, apne-aap sending ke liye 🔌 <b>Connections</b> (official API) use karo.
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setNotify(true)}
                  disabled={notify}
                  className="px-5 py-2 rounded-xl font-semibold text-emerald-950 bg-gradient-to-r from-sky-400 to-emerald-300 hover:brightness-110 transition-all disabled:opacity-70"
                >
                  {notify ? "✓ Ready hone par bata denge!" : "🔔 Ready ho toh notify karo"}
                </button>
                <button onClick={() => setBrowserOpen(false)} className="text-sm text-emerald-100/60 hover:text-emerald-100">Band karo</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

/* An animated preview of a browser being driven by the AI. Pure front-end demo:
   the CONTROLLED site (Google/Facebook/WhatsApp) is what shows on screen, with a
   moving cursor + live caption — so the user sees "the thing being controlled",
   not ClawAgent's own UI. Clearly watermarked Preview/Demo. */
const DEMO_STEPS = [
  { url: "google.com", tint: "from-blue-500/20 to-emerald-500/10", icon: "🔍", cap: "Google khol raha hoon…", cursor: [46, 40], target: "search" },
  { url: "google.com/search?q=best+cafe+near+me", tint: "from-blue-500/20 to-blue-400/10", icon: "🔍", cap: "Search type karke Enter daba raha hoon…", cursor: [30, 66], target: "result" },
  { url: "facebook.com/yourpage", tint: "from-blue-600/25 to-indigo-500/10", icon: "📘", cap: "Facebook page khol raha hoon…", cursor: [70, 52], target: "post" },
  { url: "facebook.com/yourpage/composer", tint: "from-blue-600/25 to-indigo-500/10", icon: "📘", cap: "Post likhkar Share daba raha hoon…", cursor: [82, 74], target: "share" },
  { url: "web.whatsapp.com", tint: "from-emerald-500/25 to-teal-500/10", icon: "💬", cap: "WhatsApp pe customer ko reply bhej raha hoon…", cursor: [80, 78], target: "send" },
  { url: "✓ saare kaam done", tint: "from-emerald-500/25 to-emerald-400/10", icon: "✅", cap: "Kaam ho gaya!", cursor: [50, 48], target: "done" },
];

function LiveBrowserDemo() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((p) => (p + 1) % DEMO_STEPS.length), 1900);
    return () => clearInterval(iv);
  }, []);
  const s = DEMO_STEPS[i];
  return (
    <div className="rounded-lg overflow-hidden border border-emerald-500/15 bg-[#0d1a17] relative">
      {/* title bar */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-black/40 border-b border-emerald-500/10">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
        <div className="ml-2 flex-1 h-6 rounded-md bg-emerald-950/60 border border-emerald-500/10 flex items-center px-2 gap-1.5 text-[11px] text-emerald-100/60 font-mono min-w-0">
          <span>🔒</span><span className="truncate">{s.url}</span>
        </div>
        <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-400/30 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 ca-ring" /> live
        </span>
      </div>
      {/* screen — the site being controlled */}
      <div className={`relative h-40 bg-gradient-to-br ${s.tint} p-4 overflow-hidden`}>
        <div className="text-3xl mb-2">{s.icon}</div>
        <div className="space-y-1.5">
          <div className="h-2.5 w-2/3 rounded bg-white/10" />
          <div className="h-2.5 w-1/2 rounded bg-white/10" />
          <div
            className={`h-7 w-44 rounded-md mt-2 border flex items-center px-2 text-[11px] transition-colors ${
              s.target === "done" ? "bg-emerald-400/20 border-emerald-300/40 text-emerald-100" : "bg-white/10 border-white/15 text-white/70"
            }`}
          >
            {s.target === "search" && "best cafe near me|"}
            {s.target === "result" && "▸ Top result open kar raha hoon"}
            {s.target === "post" && "＋ Naya post banao"}
            {s.target === "share" && "Share ▶"}
            {s.target === "send" && "Send ▶"}
            {s.target === "done" && "✓ complete"}
          </div>
        </div>
        {/* animated cursor moving over the controlled page */}
        <div
          className="absolute text-lg transition-all duration-700 ease-out pointer-events-none drop-shadow-lg"
          style={{ left: `${s.cursor[0]}%`, top: `${s.cursor[1]}%` }}
        >
          🖱️
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[13px] font-bold uppercase tracking-[0.25em] text-white/10 -rotate-6 pointer-events-none select-none">
          Preview • Demo
        </div>
      </div>
      {/* caption */}
      <div className="px-3 py-2 bg-black/40 border-t border-emerald-500/10 text-[12px] text-sky-200/85 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-sky-400 ca-ring shrink-0" />
        <span className="truncate">🤖 ClawAgent aapka browser control kar raha hai — {s.cap}</span>
      </div>
    </div>
  );
}

function CommandPalette({ workforce, onClose, onPick }: { workforce: Bot[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    let list = workforce;
    if (query) {
      list = workforce.filter(
        (b) => b.name.toLowerCase().includes(query) || getRoleMeta(b.role).title.toLowerCase().includes(query),
      );
    }
    return list.slice(0, 8);
  }, [q, workforce]);

  useEffect(() => { setSel(0); }, [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[sel]) { e.preventDefault(); onPick(results[sel].id); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="ca-up w-full max-w-lg rounded-2xl overflow-hidden border border-emerald-400/25 bg-[#0a1815] shadow-2xl shadow-emerald-950" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 border-b border-emerald-500/15">
          <span className="text-emerald-300">⌘</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKey}
            placeholder="Kisko bulana hai? Naam ya role likho…"
            className="flex-1 bg-transparent outline-none py-3.5 text-sm placeholder:text-emerald-100/35"
          />
          <kbd className="text-[10px] border border-emerald-500/25 rounded px-1.5 py-0.5 text-emerald-100/40">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto py-2">
          {results.map((b, i) => {
            const meta = getRoleMeta(b.role);
            return (
              <button
                key={b.id}
                onMouseEnter={() => setSel(i)}
                onClick={() => onPick(b.id)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm ${i === sel ? "bg-emerald-500/15" : ""}`}
              >
                <BotAvatar seed={b.avatarSeed} size={30} emoji={meta.emoji} />
                <span className="font-medium">{b.name}</span>
                <span className="text-emerald-100/45 text-xs">{meta.title}</span>
                <span className={`ml-auto text-[10px] ${i === sel ? "text-amber-300" : "text-emerald-100/25"}`}>↵ chat</span>
              </button>
            );
          })}
          {results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-emerald-100/40">Koi nahi mila 🤷</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- pieces ---------- */

function DeptButton({ active, onClick, emoji, label, count }: { active: boolean; onClick: () => void; emoji: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
        active
          ? "bg-gradient-to-r from-emerald-500/25 to-teal-500/10 text-emerald-50 border border-emerald-400/40"
          : "text-emerald-100/65 hover:bg-emerald-500/10 border border-transparent"
      }`}
    >
      <span className="text-base">{emoji}</span>
      <span className="flex-1 text-left truncate">{label}</span>
      <span className={`text-xs tabular-nums ${active ? "text-amber-300" : "text-emerald-100/35"}`}>{count}</span>
    </button>
  );
}

function MobilePill({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs ${active ? "bg-emerald-500 text-emerald-950 font-semibold" : "border border-emerald-500/25 text-emerald-100/70"}`}
    >
      {label}
    </button>
  );
}

function Stat({ label, value, suffix, tone, delay }: { label: string; value: number; suffix: string; tone: "emerald" | "amber" | "teal"; delay: number }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const dur = 900;
    const start = window.setTimeout(() => {
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0 - delay) / dur);
        setShown(Math.round(value * (1 - Math.pow(1 - Math.max(0, p), 3))));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => { clearTimeout(start); cancelAnimationFrame(raf); };
  }, [value, delay]);

  const tones = {
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    teal: "text-teal-300",
  } as const;

  return (
    <div className="ca-card ca-up rounded-2xl p-4" style={{ animationDelay: `${delay}ms` }}>
      <div className="text-[11px] uppercase tracking-widest text-emerald-100/45">{label}</div>
      <div className={`text-3xl font-black mt-1 tabular-nums ${tones[tone]}`}>{shown}{suffix}</div>
    </div>
  );
}

function EmployeeCard({ bot, index }: { bot: Bot; index: number }) {
  const meta = getRoleMeta(bot.role);
  const statusMap = {
    active: { dot: "bg-emerald-400", label: "Active" },
    idle: { dot: "bg-slate-400", label: "Free" },
    working: { dot: "bg-amber-400 animate-pulse", label: "Busy" },
  } as const;
  const st = statusMap[bot.status];

  return (
    <Link
      href={`/chat/${bot.id}`}
      className="ca-card ca-up rounded-2xl p-4 flex items-center gap-3.5 group transition-all hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(index, 24) * 30}ms` }}
    >
      <div className="relative shrink-0">
        <BotAvatar seed={bot.avatarSeed} size={46} emoji={meta.emoji} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a1814] ${st.dot}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold truncate group-hover:text-emerald-200 transition-colors">{bot.name}</div>
        <div className="text-xs text-emerald-100/50 truncate">{meta.title} · <span className="text-emerald-100/35">{st.label}</span></div>
      </div>
      <span className="shrink-0 text-xs font-semibold text-emerald-950 bg-gradient-to-r from-emerald-400 to-teal-300 rounded-lg px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
        Chat →
      </span>
    </Link>
  );
}
