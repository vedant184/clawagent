"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { generateWorkforce } from "@/lib/bots";
import { getProfile } from "@/lib/storage";
import { Bot, CompanyProfile } from "@/lib/types";
import ChatInterface from "@/components/ChatInterface";

export default function ChatPage() {
  const params = useParams<{ botId: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const p = getProfile();
    if (!p?.companyName) {
      router.replace(p?.email ? "/onboarding" : "/");
      return;
    }
    setProfile(p);
    setReady(true);
  }, [router]);

  const workforce = useMemo<Bot[]>(() => generateWorkforce(500), []);
  const bot = workforce.find((b) => b.id === params.botId);

  if (!ready) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-brand-100/60">Loading…</div>
      </main>
    );
  }

  if (!bot) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl font-bold mb-2">Employee not found</h1>
        <p className="text-brand-100/60 mb-6">
          This bot doesn&apos;t exist in your workforce.
        </p>
        <button
          className="btn-primary px-6 py-3 rounded-xl text-white font-semibold"
          onClick={() => router.push("/dashboard")}
        >
          ← Back to dashboard
        </button>
      </main>
    );
  }

  return <ChatInterface bot={bot} profile={profile!} />;
}
