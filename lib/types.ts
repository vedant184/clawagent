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
}

export interface CompanyProfile {
  email: string;
  companyName: string;
  logoDataUrl: string | null;
  createdAt: string;
}
