import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface BrowseAction {
  type: "click" | "type" | "scroll" | "wait";
  selector?: string;
  text?: string;
}

interface BrowseBody {
  url: string;
  actions?: BrowseAction[];
}

/** Block private / internal targets so this can't be used to hit the metadata
 *  service or internal network (SSRF protection). */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/:\d+$/, "");
  if (
    h === "localhost" ||
    h === "0.0.0.0" ||
    h.endsWith(".local") ||
    h.endsWith(".internal")
  )
    return true;
  if (h === "127.0.0.1" || h.startsWith("127.")) return true;
  if (h === "::1") return true;
  if (h.startsWith("10.")) return true;
  if (h.startsWith("192.168.")) return true;
  if (h.startsWith("169.254.")) return true; // link-local / cloud metadata
  const m = h.match(/^172\.(\d+)\./);
  if (m && +m[1] >= 16 && +m[1] <= 31) return true;
  return false;
}

function normalizeUrl(raw: string): string | null {
  let u = (raw || "").trim();
  if (!u) return null;
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  try {
    const parsed = new URL(u);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (isBlockedHost(parsed.hostname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

// Remote Chromium pack (matches @sparticuz/chromium-min version) — fetched at
// runtime so the serverless function stays well under Vercel's size limit.
const CHROMIUM_PACK =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

async function launchBrowser() {
  const puppeteer = (await import("puppeteer-core")).default;

  // Local dev/test: use whatever Chromium the machine has (LOCAL_CHROMIUM path).
  if (process.env.LOCAL_CHROMIUM) {
    return puppeteer.launch({
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      defaultViewport: { width: 1280, height: 800 },
      executablePath: process.env.LOCAL_CHROMIUM,
      headless: true,
    });
  }

  // Vercel: minimal chromium, binary pulled from the remote pack at runtime.
  const chromium = (await import("@sparticuz/chromium-min")).default;
  const execPath = await chromium.executablePath(CHROMIUM_PACK);
  // The pack ships its shared libraries next to the binary — make the loader see them.
  const execDir = execPath.substring(0, execPath.lastIndexOf("/"));
  const libPaths = [execDir, execDir + "/lib", "/tmp/al2023/lib", process.env.LD_LIBRARY_PATH || ""]
    .filter(Boolean)
    .join(":");
  process.env.LD_LIBRARY_PATH = libPaths;
  return puppeteer.launch({
    args: [...chromium.args, "--hide-scrollbars", "--disable-web-security"],
    defaultViewport: { width: 1280, height: 800 },
    executablePath: execPath,
    headless: true,
  });
}

export async function POST(req: Request) {
  let body: BrowseBody;
  try {
    body = (await req.json()) as BrowseBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const url = normalizeUrl(body.url);
  if (!url) {
    return NextResponse.json(
      { error: "That URL can't be opened — only public http(s) websites are allowed." },
      { status: 400 },
    );
  }

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 ClawAgentDebug/1.0",
    );

    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 300));
    });
    page.on("pageerror", (e) => consoleErrors.push(String(e instanceof Error ? e.message : e).slice(0, 300)));
    const failedRequests: string[] = [];
    page.on("requestfailed", (r) => {
      const f = r.failure();
      failedRequests.push(`${r.url().slice(0, 120)} — ${f ? f.errorText : "failed"}`);
    });

    const shots: string[] = [];
    let httpStatus = 0;
    try {
      const resp = await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
      httpStatus = resp ? resp.status() : 0;
    } catch {
      // fall back to a looser wait so we still capture something
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      } catch {
        /* keep going — screenshot whatever rendered */
      }
    }

    const first = (await page.screenshot({ type: "jpeg", quality: 55, encoding: "base64" })) as string;
    shots.push(first);

    // Optional agent-driven actions on the live page
    const applied: string[] = [];
    for (const a of (body.actions || []).slice(0, 5)) {
      try {
        if (a.type === "click" && a.selector) {
          await page.waitForSelector(a.selector, { timeout: 4000 });
          await page.click(a.selector);
          applied.push(`clicked ${a.selector}`);
        } else if (a.type === "type" && a.selector) {
          await page.type(a.selector, a.text || "", { delay: 10 });
          applied.push(`typed into ${a.selector}`);
        } else if (a.type === "scroll") {
          await page.evaluate(() => window.scrollBy(0, window.innerHeight));
          applied.push("scrolled");
        } else if (a.type === "wait") {
          await new Promise((r) => setTimeout(r, 1000));
          applied.push("waited");
        }
        const s = (await page.screenshot({ type: "jpeg", quality: 55, encoding: "base64" })) as string;
        shots.push(s);
      } catch (e) {
        applied.push(`failed: ${a.type} (${e instanceof Error ? e.message.slice(0, 60) : "error"})`);
      }
    }

    const title = await page.title().catch(() => "");
    const text = (await page.evaluate(() => document.body?.innerText || "").catch(() => "")).slice(0, 2500);

    // Clickable elements with stable CSS paths — so the agent can PLAN real actions
    const clickables = (await page
      .evaluate(() => {
        function cssPath(start: Element): string {
          const parts: string[] = [];
          let node: Element | null = start;
          for (let d = 0; node && d < 5 && node.tagName.toLowerCase() !== "html"; d++) {
            if (node.id) {
              parts.unshift("#" + CSS.escape(node.id));
              return parts.join(" > ");
            }
            let sel = node.tagName.toLowerCase();
            const parent: Element | null = node.parentElement;
            if (parent) {
              const sibs = Array.from(parent.children).filter(
                (c) => c.tagName === node!.tagName,
              );
              if (sibs.length > 1) sel += `:nth-of-type(${sibs.indexOf(node) + 1})`;
            }
            parts.unshift(sel);
            node = parent;
          }
          return parts.join(" > ");
        }
        const out: { selector: string; text: string; tag: string }[] = [];
        const els = document.querySelectorAll(
          'a, button, input, select, textarea, [role="button"]',
        );
        for (const el of Array.from(els)) {
          if (out.length >= 40) break;
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const anyEl = el as HTMLElement & { value?: string; placeholder?: string };
          const label = (
            anyEl.innerText ||
            anyEl.value ||
            anyEl.placeholder ||
            anyEl.getAttribute("aria-label") ||
            ""
          )
            .trim()
            .replace(/\s+/g, " ")
            .slice(0, 60);
          out.push({ selector: cssPath(el), text: label, tag: el.tagName.toLowerCase() });
        }
        return out;
      })
      .catch(() => [])) as { selector: string; text: string; tag: string }[];

    await browser.close();
    browser = null;

    return NextResponse.json({
      ok: true,
      url,
      httpStatus,
      title,
      text,
      clickables,
      consoleErrors: consoleErrors.slice(0, 20),
      failedRequests: failedRequests.slice(0, 15),
      appliedActions: applied,
      shots, // base64 JPEGs, first = initial load
    });
  } catch (err: unknown) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    const message = err instanceof Error ? err.message : "Unknown browser error.";
    return NextResponse.json(
      { error: `Cloud browser could not open that page: ${message}` },
      { status: 500 },
    );
  }
}
