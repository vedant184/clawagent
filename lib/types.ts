export type BotRole =
  | "developer"
  | "debugger"
  | "hr"
  | "sales"
  | "support"
  | "marketing"
  | "accountant"
  | "writer"
  | "researcher";

export interface BotRoleMeta {
  role: BotRole;
  title: string;
  emoji: string;
  shortDesc: string;
  systemPrompt: string;
  color: string;
}

export interface Bot {
  id: string;
  name: string;
  role: BotRole;
  status: "active" | "idle" | "working";
  hiredAt: string;
  avatarSeed: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
  isBrowsing?: boolean;
  // Cloud-browser result card (real screenshots of a real page)
  kind?: "browser";
  browseUrl?: string;
  browseTitle?: string;
  shots?: string[]; // base64 JPEGs — kept in memory, not persisted
  consoleErrors?: string[];
  failedRequests?: string[];
  httpStatus?: number;
  appliedActions?: string[]; // agentic steps the bot performed (click/type/scroll)
}

export interface CompanyProfile {
  email: string;
  companyName: string;
  logoDataUrl: string | null;
  createdAt: string;
}
