import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Send a Telegram message via the official Telegram Bot API.
 *  Configure with TELEGRAM_BOT_TOKEN in Vercel env vars (from @BotFather).
 *  "to" is a numeric chat id or an @channelusername the bot can post to.
 *  Telegram's rule: a user must have started a chat with your bot first
 *  (press Start), otherwise the bot can't message them — that's Telegram's rule. */
export async function POST(req: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      {
        error:
          "Telegram abhi connect nahi hai. Vercel → Settings → Environment Variables mein TELEGRAM_BOT_TOKEN add karke redeploy karo (@BotFather se milta hai).",
      },
      { status: 400 },
    );
  }

  let body: { to?: string; text?: string };
  try {
    body = (await req.json()) as { to?: string; text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const to = String(body.to || "").trim();
  const text = String(body.text || "").slice(0, 4000).trim();
  if (!to) {
    return NextResponse.json(
      { error: "Chat id ya @username do (jaise 123456789 ya @mychannel)." },
      { status: 400 },
    );
  }
  if (!text) {
    return NextResponse.json({ error: "Message text khaali hai." }, { status: 400 });
  }

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: to, text }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (!r.ok || !d?.ok) {
      return NextResponse.json(
        { error: d?.description || `Telegram API HTTP ${r.status}` },
        { status: r.ok ? 400 : r.status },
      );
    }
    return NextResponse.json({ ok: true, id: d?.result?.message_id ?? null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Telegram send failed." },
      { status: 500 },
    );
  }
}
