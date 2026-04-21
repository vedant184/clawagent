"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ChatMessage, CompanyProfile } from "@/lib/types";
import { getRoleMeta } from "@/lib/bots";
import { getChatHistory, saveChatHistory } from "@/lib/storage";
import BotAvatar from "./BotAvatar";
import BrowserAnimation from "./BrowserAnimation";
import SitePreview from "./SitePreview";

interface Props {
  bot: Bot;
  profile: CompanyProfile;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  developer: [
    "Build me a cozy coffee shop landing page",
    "Build me a one-page portfolio website",
    "Design a sleek product page for a fitness app",
    "Fix this Python error: ...",
  ],
  hr: [
    "Draft a job description for a junior designer",
    "Give me an onboarding checklist",
    "What questions should I ask in an interview?",
  ],
  sales: [
    "Write a cold email to a coffee shop owner",
    "Help me handle 'it's too expensive' objection",
    "Draft a follow-up after a demo",
  ],
  support: [
    "Customer wants a refund — draft a polite reply",
    "Write FAQ for a delivery service",
    "Apology message for a late shipment",
  ],
  marketing: [
    "3 Instagram captions for a new product launch",
    "Plan a content calendar for next week",
    "Write a Facebook ad for a tea stall",
  ],
  accountant: [
    "Explain GST in simple Hindi",
    "Help me categorize these expenses: ...",
    "Build me a basic monthly P&L template",
  ],
  writer: [
    "Write a 300-word blog intro about productivity",
    "Landing page hero copy for a fitness app",
    "Rewrite this paragraph to be more clear: ...",
  ],
  researcher: [
    "Compare top 3 competitors in food-delivery in India",
    "Summarize trends in AI tools for small business",
    "Find typical pricing for a yoga studio",
  ],
};

export default function ChatInterface({ bot, profile }: Props) {
  const meta = useMemo(() => getRoleMeta(bot.role), [bot.role]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // load history
  useEffect(() => {
    const h = getChatHistory(bot.id);
    if (h.length === 0) {
      const greeting: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: `Hi ${profile.companyName.split(" ")[0]}! I'm ${bot.name}, your ${meta.title.toLowerCase()} at ${profile.companyName}. ${meta.shortDesc}. How can I help you today?`,
        createdAt: new Date().toISOString(),
      };
      setMessages([greeting]);
      saveChatHistory(bot.id, [greeting]);
    } else {
      setMessages(h);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id]);

  // autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || sending) return;

    setError(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: uid(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    const next = [...messages, userMsg];
    setMessages(next);
    saveChatHistory(bot.id, next);
    setSending(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: meta.systemPrompt,
          companyName: profile.companyName,
          botName: bot.name,
          botRole: meta.title,
          messages: next
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || "Bot couldn't reply right now.");
      }

      const reply: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: data.reply || "(no reply)",
        createdAt: new Date().toISOString(),
        isBrowsing: /\[BROWSING\]/i.test(data.reply || ""),
      };
      const next2 = [...next, reply];
      setMessages(next2);
      saveChatHistory(bot.id, next2);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  const clearChat = () => {
    if (!confirm("Clear this conversation?")) return;
    setMessages([]);
    saveChatHistory(bot.id, []);
    // re-trigger greeting on next render
    setTimeout(() => {
      const greeting: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: `Fresh start! I'm ${bot.name}. What do you need?`,
        createdAt: new Date().toISOString(),
      };
      setMessages([greeting]);
      saveChatHistory(bot.id, [greeting]);
    }, 100);
  };

  const suggestions = SUGGESTIONS_BY_ROLE[bot.role] || [];
  const showSuggestions = messages.length <= 1;

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <header className="border-b border-brand-500/15 bg-bg/80 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="text-brand-100/70 hover:text-brand-100 text-sm pr-2"
            aria-label="Back to dashboard"
          >
            ←
          </Link>
          <BotAvatar seed={bot.avatarSeed} size={40} emoji={meta.emoji} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold truncate">{bot.name}</div>
            <div className="text-xs text-brand-100/60 truncate flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {meta.title} · Online
            </div>
          </div>
          <button
            onClick={clearChat}
            className="text-xs text-brand-100/50 hover:text-brand-100 px-3 py-1.5 rounded-lg hover:bg-brand-500/10"
          >
            Clear
          </button>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
          {messages.map((m) => (
            <MessageBubble key={m.id} msg={m} bot={bot} />
          ))}

          {sending && (
            <div className="flex items-start gap-3">
              <BotAvatar seed={bot.avatarSeed} size={36} emoji={meta.emoji} />
              <div className="glass rounded-2xl rounded-tl-sm px-4 py-3 inline-flex items-center">
                <span className="bot-typing-dot" />
                <span className="bot-typing-dot" />
                <span className="bot-typing-dot" />
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 rounded-xl px-4 py-3 text-sm">
              <strong>Connection error:</strong> {error}
            </div>
          )}

          {showSuggestions && suggestions.length > 0 && (
            <div className="pt-4">
              <p className="text-xs uppercase tracking-wider text-brand-100/40 mb-2">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-sm px-3 py-2 rounded-full glass hover:border-brand-400/50 hover:bg-brand-500/10 text-brand-100/90 text-left"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Composer */}
      <div className="border-t border-brand-500/15 bg-bg/80 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-end gap-2 glass rounded-2xl p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={`Message ${bot.name}…`}
              rows={1}
              className="flex-1 bg-transparent border-0 outline-none resize-none px-3 py-2 text-brand-100 placeholder:text-brand-100/40 max-h-40"
              style={{ minHeight: 40 }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="btn-primary px-5 py-2.5 rounded-xl text-white font-semibold"
            >
              Send
            </button>
          </div>
          <p className="text-[11px] text-brand-100/40 mt-2 text-center">
            ↵ to send · Shift+↵ for newline · Bots can make mistakes — double-check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ msg, bot }: { msg: ChatMessage; bot: Bot }) {
  const meta = getRoleMeta(bot.role);
  const isUser = msg.role === "user";

  if (isUser) {
    return (
      <div className="flex items-start gap-3 justify-end">
        <div className="bg-gradient-to-br from-brand-500 to-brand-400 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[80%] shadow-lg shadow-brand-500/20">
          <p className="whitespace-pre-wrap text-white leading-relaxed">
            {msg.content}
          </p>
        </div>
      </div>
    );
  }

  // Assistant: render with optional browser animation / live site preview
  const segments = parseAssistantContent(msg.content);
  const hasSite = segments.some((s) => s.type === "site");

  return (
    <div className="flex items-start gap-3">
      <BotAvatar seed={bot.avatarSeed} size={36} emoji={meta.emoji} />
      <div
        className={`glass rounded-2xl rounded-tl-sm px-4 py-3 ${
          hasSite ? "max-w-[95%] w-full" : "max-w-[85%]"
        }`}
      >
        {segments.map((seg, i) => {
          if (seg.type === "browser") {
            return (
              <BrowserAnimation
                key={i}
                task={seg.text || "Working in the browser…"}
              />
            );
          }
          if (seg.type === "site") {
            return <SitePreview key={i} html={seg.text} />;
          }
          return (
            <p
              key={i}
              className="whitespace-pre-wrap text-brand-50 leading-relaxed"
            >
              {seg.text}
            </p>
          );
        })}
      </div>
    </div>
  );
}

interface Segment {
  type: "text" | "browser" | "site";
  text: string;
}

/**
 * Parse an assistant message into segments:
 * - ```html-site ... ```  → live website preview
 * - [BROWSING] ...         → browser-control animation
 * - everything else        → plain text
 */
function parseAssistantContent(content: string): Segment[] {
  const out: Segment[] = [];
  const siteRegex = /```html-site\s*\n([\s\S]*?)```/gi;

  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = siteRegex.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index);
    if (before.trim().length) out.push(...splitOnBrowsing(before));
    out.push({ type: "site", text: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }
  const tail = content.slice(lastIndex);
  if (tail.trim().length) out.push(...splitOnBrowsing(tail));
  if (out.length === 0) out.push({ type: "text", text: content });
  return out;
}

function splitOnBrowsing(content: string): Segment[] {
  const lines = content.split("\n");
  const out: Segment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length) {
      const text = buffer.join("\n").trim();
      if (text.length) out.push({ type: "text", text });
      buffer = [];
    }
  };

  for (const line of lines) {
    const m = line.match(/^\s*\[BROWSING\]\s*(.*)$/i);
    if (m) {
      flush();
      out.push({ type: "browser", text: m[1] });
    } else {
      buffer.push(line);
    }
  }
  flush();
  return out;
}
