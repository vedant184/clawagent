import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

/* ============================================================================
 * ClawAgent — Browser Operator brain.
 *
 * The ClawAgent Chrome extension sends the CURRENT page's interactive elements +
 * the user's goal + the history of steps so far. This route asks Claude for the
 * NEXT small browser action(s), returned as strict JSON. The extension executes
 * them on the page the user is already on — with the user watching, and a Stop
 * button always available.
 *
 * Safety is enforced here, not just in the UI:
 *  - NEVER type into password / OTP / card / credential fields.
 *  - NEVER attempt CAPTCHAs or bot-checks.
 *  - If a login / payment / captcha is required, STOP and ask the human to do it.
 * ========================================================================== */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

interface El {
  id: number;
  tag?: string;
  type?: string;
  text?: string;
  role?: string;
  name?: string;
}
interface HistoryStep {
  action?: string;
  target?: string;
  result?: string;
}
interface Body {
  goal?: string;
  url?: string;
  title?: string;
  elements?: El[];
  history?: HistoryStep[];
  companyName?: string;
  step?: number;
}

type AgentAction =
  | { type: "click"; id: number; note?: string }
  | { type: "type"; id: number; text: string; enter?: boolean; note?: string }
  | { type: "scroll"; direction: "up" | "down"; note?: string }
  | { type: "navigate"; url: string; note?: string }
  | { type: "wait"; note?: string }
  | { type: "done"; note?: string }
  | { type: "ask"; note: string };

interface AgentReply {
  thought: string;
  actions: AgentAction[];
  done: boolean;
}

const SYSTEM = `You are ClawAgent Browser Operator — an AI that drives a REAL web browser for the
user, the way a careful human assistant would. You are given the CURRENT page and must decide the
NEXT small step toward the user's goal.

You receive:
- goal: what the user wants done
- url + title: where we are right now
- elements: the interactive elements currently visible, each with a numeric "id" you must reference
- history: the steps already taken

Return STRICT JSON (no prose, no markdown fences) shaped exactly like:
{"thought": "<one short human line, in the user's language, e.g. 'Search box me type kar raha hoon'>",
 "actions": [ ...1 to 3 actions... ],
 "done": <true|false>}

Allowed actions (reference elements ONLY by an id from the provided list):
- {"type":"click","id":<id>,"note":"why"}
- {"type":"type","id":<id>,"text":"...","enter":true,"note":"why"}   // enter=true presses Enter after
- {"type":"scroll","direction":"down"|"up","note":"why"}
- {"type":"navigate","url":"https://...","note":"why"}
- {"type":"wait","note":"why"}                                        // page is loading
- {"type":"done","note":"what got accomplished"}                      // goal reached
- {"type":"ask","note":"what you need the human to do"}               // hand control back to human

HARD SAFETY RULES (never break these):
1. NEVER type into a password, OTP/2FA, credit-card, CVV, or any credential/payment field. If the
   task needs a login or payment, return a single {"type":"ask"} telling the human to do that part.
2. NEVER try to solve a CAPTCHA / "I'm not a robot" / bot-check. Return {"type":"ask"}.
3. Do not click irreversible destructive controls (delete account, permanent delete, "send money")
   without the goal explicitly asking; when unsure, {"type":"ask"}.
4. Take SMALL steps — usually one action. Prefer clicking a search box then typing, over guessing.
5. If the goal already appears complete based on history/page, return done:true with a {"type":"done"}.
6. If nothing sensible matches, {"type":"ask"} explaining what you see and what you need.

Keep "thought" short and in the user's language (Hindi/Hinglish is fine). Output ONLY the JSON object.`;

function extractJson(raw: string): AgentReply | null {
  let s = raw.trim();
  // strip ```json fences if the model added them
  s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const start = s.indexOf("{");
  const end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const obj = JSON.parse(s.slice(start, end + 1));
    if (!obj || typeof obj !== "object") return null;
    if (!Array.isArray(obj.actions)) obj.actions = [];
    obj.thought = typeof obj.thought === "string" ? obj.thought : "";
    obj.done = obj.done === true;
    return obj as AgentReply;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not set on the server." },
      { status: 500, headers: CORS },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400, headers: CORS });
  }

  const goal = String(body.goal || "").slice(0, 2000).trim();
  if (!goal) {
    return NextResponse.json({ error: "goal is required." }, { status: 400, headers: CORS });
  }

  // Trim the element list so we never blow the token budget.
  const elements = (Array.isArray(body.elements) ? body.elements : [])
    .slice(0, 120)
    .map((e) => ({
      id: e.id,
      tag: e.tag,
      type: e.type,
      role: e.role,
      text: typeof e.text === "string" ? e.text.slice(0, 120) : "",
      name: typeof e.name === "string" ? e.name.slice(0, 80) : undefined,
    }));

  const history = (Array.isArray(body.history) ? body.history : []).slice(-12);

  const userBlock = JSON.stringify({
    goal,
    url: String(body.url || "").slice(0, 500),
    title: String(body.title || "").slice(0, 200),
    step: body.step || 0,
    elements,
    history,
  });

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5";
    const response = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `Here is the current browser state as JSON:\n${userBlock}\n\nReturn the next-step JSON now.`,
        },
      ],
    });

    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();

    const parsed = extractJson(text);
    if (!parsed) {
      return NextResponse.json(
        {
          thought: "Samajhne me dikkat hui — ek baar phir batao ya khud kar lo.",
          actions: [{ type: "ask", note: "Could not parse a valid plan. Please retry." }],
          done: false,
        },
        { headers: CORS },
      );
    }

    return NextResponse.json(parsed, { headers: CORS });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    return NextResponse.json({ error: `Planner error: ${message}` }, { status: 500, headers: CORS });
  }
}
