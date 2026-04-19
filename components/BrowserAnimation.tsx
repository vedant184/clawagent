"use client";

interface Props {
  url?: string;
  task?: string;
}

export default function BrowserAnimation({
  url = "https://search.clawagent.ai",
  task = "Researching for you…",
}: Props) {
  return (
    <div className="my-3 rounded-xl overflow-hidden animate-browser-glow border border-brand-400/40 bg-bg-card/90 relative">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brand-500/20 bg-bg-soft/80">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        <div className="flex-1 ml-3 px-3 py-1 rounded-md bg-bg/80 border border-brand-500/30 text-xs text-brand-200 font-mono truncate">
          🔒 {url}
        </div>
        <span className="text-[10px] uppercase tracking-wider text-brand-300 px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-400/40 animate-pulse-slow">
          ● Live
        </span>
      </div>
      <div className="relative h-32 bg-gradient-to-br from-bg via-bg-card to-bg overflow-hidden">
        <div className="scan-line" />
        <div className="p-4 space-y-2">
          <div className="h-3 w-2/3 rounded bg-brand-500/20 animate-pulse" />
          <div className="h-3 w-1/2 rounded bg-brand-500/15 animate-pulse" />
          <div className="h-3 w-3/4 rounded bg-brand-500/10 animate-pulse" />
        </div>
        <div className="absolute bottom-2 right-3 text-[11px] text-brand-200 font-medium flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-300 animate-pulse" />
          {task}
        </div>
      </div>
    </div>
  );
}
