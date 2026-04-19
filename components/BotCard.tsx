"use client";

import Link from "next/link";
import { Bot } from "@/lib/types";
import { getRoleMeta } from "@/lib/bots";
import BotAvatar from "./BotAvatar";

export default function BotCard({ bot }: { bot: Bot }) {
  const meta = getRoleMeta(bot.role);
  const statusColors: Record<Bot["status"], string> = {
    active: "bg-emerald-400",
    idle: "bg-slate-400",
    working: "bg-amber-400 animate-pulse",
  };
  const statusLabels: Record<Bot["status"], string> = {
    active: "Active",
    idle: "Idle",
    working: "Working",
  };

  return (
    <Link
      href={`/chat/${bot.id}`}
      className="glass rounded-xl p-4 hover:border-brand-400/50 hover:bg-brand-500/5 transition-all flex items-center gap-3 group"
    >
      <BotAvatar seed={bot.avatarSeed} size={44} emoji={meta.emoji} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold truncate">{bot.name}</h3>
          <span
            className={`w-2 h-2 rounded-full ${statusColors[bot.status]}`}
            title={statusLabels[bot.status]}
          />
        </div>
        <p className="text-xs text-brand-100/60 truncate">{meta.title}</p>
      </div>
      <div className="text-brand-300 opacity-0 group-hover:opacity-100 transition-opacity">
        →
      </div>
    </Link>
  );
}
