"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { clearProfile, getProfile } from "@/lib/storage";
import { ALL_ROLES, generateWorkforce, getRoleMeta } from "@/lib/bots";
import { Bot, BotRole, CompanyProfile } from "@/lib/types";
import BotCard from "@/components/BotCard";

const BOT_COUNT = 500;

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [filter, setFilter] = useState<BotRole | "all">("all");
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(60);

  useEffect(() => {
    const p = getProfile();
    if (!p?.companyName) {
      router.replace(p?.email ? "/onboarding" : "/");
      return;
    }
    setProfile(p);
  }, [router]);

  const workforce = useMemo<Bot[]>(() => generateWorkforce(BOT_COUNT), []);

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
    for (const b of workforce) {
      byRole[b.role] = (byRole[b.role] || 0) + 1;
    }
    const active = workforce.filter((b) => b.status === "active").length;
    const working = workforce.filter((b) => b.status === "working").length;
    return { byRole, active, working, total: workforce.length };
  }, [workforce]);

  if (!profile) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-brand-100/60">Loading…</div>
      </main>
    );
  }

  const handleLogout = () => {
    if (confirm("Sign out? Your workspace is saved on this device only.")) {
      clearProfile();
      router.replace("/");
    }
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-brand-500/10 sticky top-0 z-40 backdrop-blur-xl bg-bg/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
          <div className="flex items-center gap-3">
            {profile.logoDataUrl ? (
              <img
                src={profile.logoDataUrl}
                alt=""
                className="w-10 h-10 rounded-lg object-contain bg-white/5 p-1"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-brand-500 to-brand-300 flex items-center justify-center text-xl">
                🦾
              </div>
            )}
            <div>
              <div className="font-bold leading-tight">{profile.companyName}</div>
              <div className="text-xs text-brand-100/50">
                Powered by Clawagent
              </div>
            </div>
          </div>
          <div className="flex-1" />
          <button
            onClick={handleLogout}
            className="text-sm text-brand-100/70 hover:text-brand-100"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <section className="mb-8">
          <h1 className="text-4xl font-extrabold">
            Welcome back,{" "}
            <span className="text-brand-300">
              {profile.companyName.split(" ")[0]}
            </span>{" "}
            👋
          </h1>
          <p className="text-brand-100/60 mt-2">
            Your AI workforce is online and ready to work. Click any employee to
            start a conversation.
          </p>
        </section>

        <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total employees" value={stats.total.toString()} accent />
          <StatCard label="Active right now" value={stats.active.toString()} />
          <StatCard label="Working on tasks" value={stats.working.toString()} />
          <StatCard label="Specialized roles" value={ALL_ROLES.length.toString()} />
        </section>

        <section className="mb-6">
          <div className="flex gap-2 flex-wrap">
            <FilterPill
              label="All roles"
              count={stats.total}
              active={filter === "all"}
              onClick={() => setFilter("all")}
            />
            {ALL_ROLES.map((role) => {
              const meta = getRoleMeta(role);
              return (
                <FilterPill
                  key={role}
                  label={`${meta.emoji} ${meta.title}`}
                  count={stats.byRole[role] || 0}
                  active={filter === role}
                  onClick={() => setFilter(role)}
                />
              );
            })}
          </div>
        </section>

        <section className="mb-6">
          <input
            className="input-field"
            placeholder="Search by name or role…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setVisible(60);
            }}
          />
        </section>

        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {filtered.slice(0, visible).map((bot) => (
            <BotCard key={bot.id} bot={bot} />
          ))}
        </section>

        {visible < filtered.length && (
          <div className="flex justify-center mt-8">
            <button
              className="btn-primary px-8 py-3 rounded-xl font-semibold text-white"
              onClick={() => setVisible((v) => v + 60)}
            >
              Load more ({filtered.length - visible} remaining)
            </button>
          </div>
        )}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-brand-100/60">
            No employees match your search.
          </div>
        )}
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`glass rounded-xl p-5 ${accent ? "border-brand-400/40" : ""}`}
    >
      <div className="text-xs uppercase tracking-wider text-brand-100/50">
        {label}
      </div>
      <div
        className={`text-3xl font-bold mt-1 ${accent ? "text-brand-300" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function FilterPill({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm font-medium transition-all
        ${
          active
            ? "bg-brand-500 text-white shadow-lg shadow-brand-500/30"
            : "bg-bg-card border border-brand-500/20 text-brand-100/80 hover:bg-brand-500/10"
        }`}
    >
      {label}{" "}
      <span className={`ml-1 ${active ? "text-white/70" : "text-brand-100/40"}`}>
        {count}
      </span>
    </button>
  );
}
