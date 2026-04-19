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
Keep replies focused and human-paced (2-6 short paragraphs unless asked otherwise).`;

  const cleanMessages = messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => ({
      role: m.role,
      content: m.content,
    }));

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: filledSystem,
      messages: cleanMessages,
    });

    const text = response.content
      .map((block) => (block.type === "text" ? block.text : ""))
      .filter(Boolean)
      .join("\n");

    return NextResponse.json({
      reply: text,
      usage: response.usage,
      model: response.model,
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
