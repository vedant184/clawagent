import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Send a WhatsApp text message via the official Meta WhatsApp Cloud API.
 *  Configure with WHATSAPP_TOKEN + WHATSAPP_PHONE_ID in Vercel env vars.
 *  Note: to START a conversation, the recipient must have messaged you in the
 *  last 24h OR you must use an approved template — that's Meta's rule, not ours. */
export async function POST(req: Request) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!token || !phoneId) {
    return NextResponse.json(
      {
        error:
          "WhatsApp abhi connect nahi hai. Vercel → Settings → Environment Variables mein WHATSAPP_TOKEN aur WHATSAPP_PHONE_ID add karke redeploy karo (Meta WhatsApp Cloud API se milte hain).",
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

  const to = String(body.to || "").replace(/[^\d]/g, ""); // digits only, with country code
  const text = String(body.text || "").slice(0, 4000);
  if (!to || to.length < 8) {
    return NextResponse.json(
      { error: "Phone number country code ke saath do (jaise 919876543210)." },
      { status: 400 },
    );
  }
  if (!text) {
    return NextResponse.json({ error: "Message text khaali hai." }, { status: 400 });
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body: text },
      }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      error?: { message?: string };
      messages?: { id?: string }[];
    };
    if (!r.ok) {
      return NextResponse.json(
        { error: d?.error?.message || `WhatsApp API HTTP ${r.status}` },
        { status: r.status },
      );
    }
    return NextResponse.json({ ok: true, id: d?.messages?.[0]?.id || null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "WhatsApp send failed." },
      { status: 500 },
    );
  }
}
