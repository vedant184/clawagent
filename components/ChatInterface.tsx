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

const URL_RE = /\bhttps?:\/\/[^\s<>()"']+/i;
const BARE_RE =
  /\b((?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|in|app|dev|co|ai|xyz|shop|store|me|info|biz|us|uk|site|online|tech))(?:\/[^\s<>()"']*)?/i;

function extractUrl(text: string): string | null {
  const m = text.match(URL_RE);
  if (m) return m[0].replace(/[.,)]+$/, "");
  const b = text.match(BARE_RE);
  if (b) return b[0].replace(/[.,)]+$/, "");
  return null;
}

/** Screenshots are big — keep them in memory but never write them to
 *  localStorage (would blow the quota). */
function stripShots(list: ChatMessage[]): ChatMessage[] {
  return list.map((m) => (m.shots ? { ...m, shots: undefined } : m));
}

/* ---- Voice input (Web Speech API — built into Chrome/Edge) ---- */
interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: {
        results: { length: number; [i: number]: { 0: { transcript: string } } };
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getSpeechRecognition(): (new () => SpeechRecLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecLike;
    webkitSpeechRecognition?: new () => SpeechRecLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  developer: [
    "Build me a cozy coffee shop landing page",
    "Build me a one-page portfolio website",
    "Design a sleek product page for a fitness app",
    "Fix this Python error: ...",
    "Meri site tooti hai — fix karke live chala kar dikhao: (code ya URL do)",
  ],
  debugger: [
    "Mera button click par kuch nahi karta — ye code debug karo: ...",
    "Is console error ka matlab samjhao: ...",
    "Ye page mobile par toota dikh raha hai — fix karke live dikhao",
    "Meri site slow lagti hai — performance audit karo",
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
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<SpeechRecLike | null>(null);
  const voiceBaseRef = useRef("");

  // stop mic when leaving the chat
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, []);

  const toggleMic = () => {
    if (listening) {
      try {
        recRef.current?.stop();
      } catch {
        /* ignore */
      }
      return;
    }
    const Ctor = getSpeechRecognition();
    if (!Ctor) {
      setError("Voice input sirf Chrome/Edge browser mein chalta hai.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = "hi-IN"; // Hindi + English mix samajhta hai
    rec.continuous = true;
    rec.interimResults = true;
    voiceBaseRef.current = input.trim();
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      const base = voiceBaseRef.current;
      setInput((base ? base + " " : "") + t.trim());
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };
    rec.onerror = () => {
      setListening(false);
    };
    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      setError("Mic start nahi hua — browser permission check karo.");
    }
  };

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
    let convo = [...messages, userMsg];
    setMessages(convo);
    saveChatHistory(bot.id, stripShots(convo));
    setSending(true);

    // ---- CLOUD BROWSER: a Debug Agent asked about a real URL actually opens
    // it in a real headless Chromium and shows real screenshots. ----
    let browseFacts = "";
    if (bot.role === "debugger" || bot.role === "developer") {
      const found = extractUrl(text);
      if (found) {
        try {
          setStreamingId("browsing");
          const br = await fetch("/api/browse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: found }),
          });
          const data = await br.json();
          if (br.ok && data.ok) {
            const card: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: "",
              createdAt: new Date().toISOString(),
              kind: "browser",
              browseUrl: data.url,
              browseTitle: data.title,
              shots: data.shots,
              consoleErrors: data.consoleErrors,
              failedRequests: data.failedRequests,
              httpStatus: data.httpStatus,
            };
            convo = [...convo, card];
            setMessages(convo);
            saveChatHistory(bot.id, stripShots(convo));
            browseFacts =
              `\n\n[LIVE BROWSER RESULT — I just opened ${data.url} in a real cloud Chromium]\n` +
              `HTTP status: ${data.httpStatus}\nPage title: ${data.title}\n` +
              (data.consoleErrors?.length
                ? `Console errors:\n- ${data.consoleErrors.join("\n- ")}\n`
                : "Console: no errors.\n") +
              (data.failedRequests?.length
                ? `Failed requests:\n- ${data.failedRequests.join("\n- ")}\n`
                : "") +
              `Visible text (excerpt):\n${(data.text || "").slice(0, 1500)}\n` +
              `Use these REAL observations — refer to what you actually saw on the page.`;
          } else {
            const card: ChatMessage = {
              id: uid(),
              role: "assistant",
              content: `⚠️ Cloud browser ${found} khol nahi paya: ${data.error || "unknown error"}`,
              createdAt: new Date().toISOString(),
            };
            convo = [...convo, card];
            setMessages(convo);
            saveChatHistory(bot.id, stripShots(convo));
          }
        } catch {
          /* browse failed — continue with a normal chat reply */
        } finally {
          setStreamingId(null);
        }
      }
    }

    try {
      const outgoing = convo
        .filter(
          (m) =>
            m.role === "user" ||
            (m.role === "assistant" && m.kind !== "browser" && m.content.trim().length > 0),
        )
        .map((m) => ({ role: m.role, content: m.content }));
      if (browseFacts) {
        for (let i = outgoing.length - 1; i >= 0; i--) {
          if (outgoing[i].role === "user") {
            outgoing[i] = { ...outgoing[i], content: outgoing[i].content + browseFacts };
            break;
          }
        }
      }

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: meta.systemPrompt,
          companyName: profile.companyName,
          botName: bot.name,
          botRole: meta.title,
          stream: true,
          messages: outgoing,
        }),
      });

      const ct = resp.headers.get("content-type") || "";

      if (resp.ok && ct.includes("text/event-stream") && resp.body) {
        // ---- Live streaming: reply types out token-by-token ----
        const draftId = uid();
        let acc = "";
        let streamErr: string | null = null;
        setStreamingId(draftId);
        setMessages((cur) => [
          ...cur,
          { id: draftId, role: "assistant", content: "", createdAt: new Date().toISOString() },
        ]);
        try {
          const reader = resp.body.getReader();
          const dec = new TextDecoder();
          let buf = "";
          for (;;) {
            const chunk = await reader.read();
            if (chunk.done) break;
            buf += dec.decode(chunk.value, { stream: true });
            const lines = buf.split("\n");
            buf = lines.pop() || "";
            for (const ln of lines) {
              if (!ln.startsWith("data:")) continue;
              let ev: { t?: string; error?: string } = {};
              try { ev = JSON.parse(ln.slice(5)); } catch { continue; }
              if (ev.t) {
                acc += ev.t;
                const now = acc;
                setMessages((cur) => cur.map((m) => (m.id === draftId ? { ...m, content: now } : m)));
              }
              if (ev.error) streamErr = ev.error;
            }
          }
        } catch {
          /* network drop mid-stream — keep whatever arrived */
        }
        if (!acc.trim()) {
          setMessages(convo);
          throw new Error(streamErr || "Bot couldn't reply right now.");
        }
        const reply: ChatMessage = {
          id: draftId,
          role: "assistant",
          content: acc,
          createdAt: new Date().toISOString(),
          isBrowsing: /\[BROWSING\]/i.test(acc),
        };
        const finalList = [...convo, reply];
        setMessages(finalList);
        saveChatHistory(bot.id, stripShots(finalList));
      } else {
        // ---- Fallback: classic JSON reply ----
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
        const finalList = [...convo, reply];
        setMessages(finalList);
        saveChatHistory(bot.id, stripShots(finalList));
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setSending(false);
      setStreamingId(null);
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
            onClick={() => {
              const txt = messages
                .map((m) => `${m.role === "user" ? profile.companyName : bot.name}: ${m.content}`)
                .join("\n\n---\n\n");
              const blob = new Blob([txt], { type: "text/plain" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${bot.name.replace(/\s+/g, "-")}-chat.txt`;
              a.click();
              setTimeout(() => URL.revokeObjectURL(a.href), 2000);
            }}
            className="text-xs text-brand-100/50 hover:text-brand-100 px-3 py-1.5 rounded-lg hover:bg-brand-500/10"
          >
            ⬇ Export
          </button>
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

          {sending && !streamingId && (
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
              onClick={toggleMic}
              title={listening ? "Recording band karo" : "Bol kar likho (Hindi/English)"}
              aria-label="Voice input"
              className={`px-3 py-2.5 rounded-xl text-lg transition-all ${
                listening
                  ? "bg-rose-500/25 text-rose-300 animate-pulse ring-1 ring-rose-400/50"
                  : "text-brand-100/60 hover:text-brand-100 hover:bg-brand-500/10"
              }`}
            >
              {listening ? "🔴" : "🎤"}
            </button>
            <button
              onClick={() => send()}
              disabled={!input.trim() || sending}
              className="btn-primary px-5 py-2.5 rounded-xl text-white font-semibold"
            >
              Send
            </button>
          </div>
          <p className="text-[11px] text-brand-100/40 mt-2 text-center">
            ↵ to send · Shift+↵ for newline · 🎤 se bol kar likho · Bots can make mistakes — double-check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

function BrowserResultCard({ msg }: { msg: ChatMessage }) {
  const shots = msg.shots || [];
  return (
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-lg shrink-0">
        🌐
      </div>
      <div className="glass rounded-2xl rounded-tl-sm overflow-hidden max-w-[96%] w-full border border-cyan-400/30">
        <div className="flex items-center gap-2 px-3 py-2 bg-black/30 border-b border-white/10">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 text-xs font-mono truncate text-brand-100/80">
            🔒 {msg.browseUrl}
          </span>
          <span className="ml-auto shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
            ● LIVE{msg.httpStatus ? " " + msg.httpStatus : ""}
          </span>
        </div>
        {shots.length > 0 ? (
          <div className="space-y-2 p-2">
            {shots.map((s, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:image/jpeg;base64,${s}`}
                alt={`Live screenshot ${i + 1}`}
                className="w-full rounded-lg border border-white/10"
              />
            ))}
          </div>
        ) : (
          <div className="px-3 py-3 text-xs text-brand-100/50">
            🌐 Opened {msg.browseUrl} — real screenshot (reload hone par expire ho jata hai).
          </div>
        )}
        {msg.browseTitle ? (
          <div className="px-3 pb-2 text-xs text-brand-100/70">
            <b>Title:</b> {msg.browseTitle}
          </div>
        ) : null}
        {msg.consoleErrors && msg.consoleErrors.length > 0 && (
          <div className="px-3 pb-3">
            <div className="text-[11px] uppercase tracking-wider text-rose-300/80 mb-1">
              Console errors ({msg.consoleErrors.length})
            </div>
            <ul className="text-xs text-rose-200/90 space-y-0.5 font-mono">
              {msg.consoleErrors.slice(0, 6).map((e, i) => (
                <li key={i} className="truncate">
                  • {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MessageBubble({ msg, bot }: { msg: ChatMessage; bot: Bot }) {
  const meta = getRoleMeta(bot.role);
  const isUser = msg.role === "user";

  if (msg.kind === "browser") {
    return <BrowserResultCard msg={msg} />;
  }

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
