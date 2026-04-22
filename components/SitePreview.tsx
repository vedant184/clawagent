"use client";

import { useMemo, useState } from "react";

interface Props {
  html: string;
}

/**
 * Renders a complete HTML document in a sandboxed iframe with a browser-chrome header,
 * plus buttons to download the .html file or open it in a new tab.
 */
export default function SitePreview({ html }: Props) {
  const [expanded, setExpanded] = useState(false);

  const blobUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    try {
      const blob = new Blob([html], { type: "text/html" });
      return URL.createObjectURL(blob);
    } catch {
      return "";
    }
  }, [html]);

  const download = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "website.html";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openNewTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="my-3 rounded-xl overflow-hidden animate-browser-glow border border-brand-400/40 bg-bg-card/90">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-brand-500/20 bg-bg-soft/80">
        <span className="w-2.5 h-2.5 rounded-full bg-rose-400/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-300/80" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
        <div className="flex-1 ml-3 px-3 py-1 rounded-md bg-bg/80 border border-brand-500/30 text-xs text-brand-200 font-mono truncate">
          🔒 preview.clawagent.ai/site
        </div>
        <span className="text-[10px] uppercase tracking-wider text-brand-300 px-2 py-0.5 rounded-full bg-brand-500/15 border border-brand-400/40">
          ● Live preview
        </span>
      </div>

      {/* Iframe preview */}
      <div
        className={`relative bg-white transition-all ${
          expanded ? "h-[600px]" : "h-[380px]"
        }`}
      >
        <iframe
          srcDoc={html}
          title="Website preview"
          sandbox="allow-scripts"
          className="w-full h-full border-0"
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-t border-brand-500/20 bg-bg-soft/80">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="text-xs px-3 py-1.5 rounded-lg text-brand-100/80 hover:text-brand-100 hover:bg-brand-500/10"
        >
          {expanded ? "↕ Shrink" : "↕ Expand"}
        </button>
        <div className="flex-1" />
        <button
          onClick={download}
          className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/20 hover:bg-brand-500/30 border border-brand-400/40 text-brand-100"
        >
          ⬇ Download .html
        </button>
      </div>

      {/* Big "Open full website" CTA — obvious finish-line button */}
      <div className="px-3 py-3 border-t border-brand-500/20 bg-gradient-to-r from-brand-500/10 via-bg-soft/40 to-brand-400/10">
        <button
          onClick={openNewTab}
          disabled={!blobUrl}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-brand-500 to-brand-400 hover:from-brand-400 hover:to-brand-300 text-white font-semibold shadow-lg shadow-brand-500/30 transition-transform active:scale-[0.99] disabled:opacity-50"
        >
          <span className="text-lg">🌐</span>
          Open full website in new tab
          <span className="text-lg">↗</span>
        </button>
        <p className="text-[11px] text-brand-100/50 mt-2 text-center">
          The website is ready — click above to view it in its own tab, or download the .html file.
        </p>
      </div>
    </div>
  );
}
