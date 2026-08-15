import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Publish a text post to a Facebook Page via the official Meta Graph API.
 *  Configure with META_PAGE_TOKEN (a Page access token with pages_manage_posts)
 *  and META_PAGE_ID in Vercel env vars. */
export async function POST(req: Request) {
  const token = process.env.META_PAGE_TOKEN;
  const pageId = process.env.META_PAGE_ID;
  if (!token || !pageId) {
    return NextResponse.json(
      {
        error:
          "Facebook abhi connect nahi hai. Vercel → Settings → Environment Variables mein META_PAGE_TOKEN aur META_PAGE_ID add karke redeploy karo (Meta Graph API se milte hain).",
      },
      { status: 400 },
    );
  }

  let body: { text?: string };
  try {
    body = (await req.json()) as { text?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const text = String(body.text || "").slice(0, 60000).trim();
  if (!text) {
    return NextResponse.json({ error: "Post text khaali hai." }, { status: 400 });
  }

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, access_token: token }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      error?: { message?: string };
      id?: string;
    };
    if (!r.ok) {
      return NextResponse.json(
        { error: d?.error?.message || `Facebook API HTTP ${r.status}` },
        { status: r.status },
      );
    }
    return NextResponse.json({ ok: true, id: d?.id || null });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Facebook post failed." },
      { status: 500 },
    );
  }
}
