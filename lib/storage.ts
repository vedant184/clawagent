"use client";

import { CompanyProfile, ChatMessage } from "./types";

const PROFILE_KEY = "clawagent.profile";
const CHAT_KEY_PREFIX = "clawagent.chat.";

export function getProfile(): CompanyProfile | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as CompanyProfile) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile: CompanyProfile) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearProfile() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
}

export function getChatHistory(botId: string): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CHAT_KEY_PREFIX + botId);
    return raw ? (JSON.parse(raw) as ChatMessage[]) : [];
  } catch {
    return [];
  }
}

export function saveChatHistory(botId: string, messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  const trimmed = messages.slice(-80);
  window.localStorage.setItem(
    CHAT_KEY_PREFIX + botId,
    JSON.stringify(trimmed),
  );
}

/* ---- Shared Business Memory: every bot remembers this, in every chat ---- */
const MEMORY_KEY = "clawagent.memory";

export function getMemory(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(MEMORY_KEY) || "";
  } catch {
    return "";
  }
}

export function saveMemory(text: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MEMORY_KEY, text.slice(0, 4000));
  } catch {
    /* quota — ignore */
  }
}
