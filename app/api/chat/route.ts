import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  systemPrompt: string;
  messages: IncomingMessage[];
  companyName: string;
  botName: string;
  botRole: string;
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "ANTHROPIC_API_KEY is not set. Add it in Vercel → Settings → Environment Variables (or your local .env file).",
      },
      { status: 500 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { systemPrompt, messages, companyName, botName, botRole } = body;

  if (!systemPrompt || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "Missing systemPrompt or messages." },
      { status: 400 },
    );
  }

  const filledSystem = `${systemPrompt
    .replace(/\{\{COMPANY\}\}/g, companyName || "the company")
    .trim()}

Your name is ${botName}. You are a ${botRole}.
Always stay in character. Never claim you sent emails, made phone calls, charged credit cards,
or took external real-world actions — you can DRAFT them and the human owner will execute.
Keep conversational replies focused and human-paced (2-6 short paragraphs), BUT when producing
code, HTML, or a full website, output the complete file — never truncate mid-way.`;

  const cleanMessages = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

    // Give the bot a LIVE web_search tool (server-executed by Anthropic) so it can
    // actually look up current info, latest docs, and real-world data instead of
    // just pretending with the [BROWSING] marker. Uses the Messages API tools param.
    // Disable with WEB_SEARCH_ENABLED=false env var if needed.
    const webSearchEnabled = process.env.WEB_SEARCH_ENABLED !== "false";

    // Typed loosely so the SDK accepts the server-tool shape without complaining.
    const tools = webSearchEnabled
      ? ([
          {
            type: "web_search_20250305",
            name: "web_search",
            max_uses: 5,
          },
        ] as unknown as Anthropic.Messages.Tool[])
      : undefined;

    const response = await client.messages.create({
      model,
      max_tokens: 8192,
      system: filledSystem,
      messages: cleanMessages,
      ...(tools ? { tools } : {}),
    });

    // Stitch together all text blocks. Tool-use / tool-result blocks are emitted by
    // the server-side web_search tool — we skip them here; the final text block
    // already contains the assistant's synthesized answer with citations.
    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    // Count how many web searches Claude actually ran, so the UI could show a badge.
    const webSearches = response.content.filter(
      (b) =>
        ((b.type as string) === "server_tool_use" &&
          (b as { name?: string }).name === "web_search") ||
        (b.type as string) === "web_search_tool_result",
    ).length;

    return NextResponse.json({
      reply: text,
      usage: response.usage,
      model: response.model,
      webSearches,
    });
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error talking to Claude.";
    console.error("Claude API error:", err);
    return NextResponse.json(
      { error: `Claude API error: ${message}` },
      { status: 500 },
    );
  }
}
