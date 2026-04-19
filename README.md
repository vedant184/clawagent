# 🦾 Clawagent

**Hire 500+ AI employees that think, talk, and work like humans.**
A fully working Next.js + Anthropic Claude web app — sign in, name your company, upload a logo (paste support included), and chat with your workforce.

---

## ✨ Features

- 📧 **Email sign-in** — no password, just email
- 🏢 **Company onboarding** — name + logo (drag, click, or **Ctrl+V paste**)
- 👥 **500-bot workforce** across 8 specialized roles:
  Developer, HR, Sales, Customer Support, Marketing, Accountant, Content Writer, Research Analyst
- 💬 **Real Claude conversations** — every reply comes from Anthropic's Claude API
- 🌐 **Browser-control animation** — when bots research the web, a glowing blue browser window appears
- 🌙 **Dark mode + blue theme** with glassmorphism
- 💾 **Local persistence** — chats and profile saved in your browser
- 🚀 **One-click Vercel deploy ready**

---

## 🛠 Quick start (local)

You need **Node.js 18.17+** installed. Then:

```bash
# 1. Install dependencies
npm install

# 2. Add your Anthropic API key
cp .env.example .env
# Open .env and replace the placeholder with your real key from
# https://console.anthropic.com

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — sign in with any email, name your company, and start chatting!

---

## 🚀 Deploy to Vercel (free)

### Step 1: Push to GitHub
1. Create a new GitHub repo (e.g. `clawagent`)
2. From this folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/<your-username>/clawagent.git
   git push -u origin main
   ```

### Step 2: Import into Vercel
1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** next to your `clawagent` repo
3. Framework preset will auto-detect as **Next.js** ✅
4. Click **Environment Variables** and add:
   - **Key:** `ANTHROPIC_API_KEY`
   - **Value:** your Claude API key (starts with `sk-ant-…`)
5. *(Optional)* Add `ANTHROPIC_MODEL` = `claude-sonnet-4-5` (default)
6. Click **Deploy**

In ~60 seconds Vercel gives you a free URL like
`https://clawagent-<your-name>.vercel.app`

### Step 3: Custom domain (optional)
- The free `*.vercel.app` subdomain is yours forever
- For a `.com` domain, buy one from Namecheap/Google Domains and add it under Vercel → Settings → Domains

> **Note on `clawagent-vercel.com`:** That exact `.com` domain has to be **purchased** (~₹800/year) — Vercel doesn't give `.com` for free. The free option is `clawagent-anything.vercel.app`.

---

## 🗂 Project structure

```
clawagent/
├── app/
│   ├── page.tsx              ← Email sign-in
│   ├── onboarding/page.tsx   ← Company name + logo paste
│   ├── dashboard/page.tsx    ← 500-bot workforce grid
│   ├── chat/[botId]/page.tsx ← Chat with any bot
│   ├── api/chat/route.ts     ← Claude API proxy
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── LogoUploader.tsx      ← Ctrl+V paste support
│   ├── BotCard.tsx
│   ├── BotAvatar.tsx
│   ├── ChatInterface.tsx     ← Streaming chat UI
│   └── BrowserAnimation.tsx  ← Blue glow when bot "browses"
├── lib/
│   ├── bots.ts               ← Roles + 500 deterministic bots
│   ├── storage.ts            ← localStorage helpers
│   └── types.ts
├── .env.example
└── package.json
```

---

## 🤖 How the bots work

Each bot has:
- A **role** (developer, HR, sales, etc.) → loads a tailored system prompt
- A **company-aware identity** (every reply uses your company name)
- **Memory** of the current conversation (last 80 messages stored locally)
- **Browser animation trigger**: when the bot writes a line starting with `[BROWSING]`, the UI swaps in an animated glowing browser window — perfect for "researching" or "looking something up" actions

Example: ask the Research Analyst Bot *"Find typical pricing for a yoga studio"* and it will reply with `[BROWSING] Searching pricing data…` lines that render as the blue browser animation.

---

## ⚠️ What this version does NOT do (and why)

To keep things legal & safe, the following were intentionally left out:
- ❌ **Bots cannot send real emails to strangers** — that's spam (illegal under CAN-SPAM, GDPR, India's IT Act). Bots can *draft* emails for you to send manually.
- ❌ **Bots cannot autonomously charge customers or sign contracts** — humans must approve.
- ❌ **No real-world browsing** — the browser animation is a UI affordance; actual web access would require additional integrations (Anthropic's web search tool, Browserbase, etc.) which you can add later.

---

## 💡 Extending it

Some easy next steps:
- Add Anthropic's **web search tool** so bots can do real research
- Replace `localStorage` with **Supabase / Postgres** for multi-device chats
- Add **streaming** responses (token-by-token) using Anthropic's stream API
- Add **bot-to-bot conversations** (the developer bot pings HR for a hire)
- Add **Stripe** to actually let users pay for upgraded plans

---

## 📜 License

MIT — do whatever you want with it. Built with ❤️ for Vedant.
