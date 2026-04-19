"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getProfile, saveProfile } from "@/lib/storage";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const p = getProfile();
    if (p?.companyName) {
      router.replace("/dashboard");
    } else if (p?.email) {
      router.replace("/onboarding");
    }
  }, [router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const clean = email.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean);
    if (!ok) {
      setError("Sahi email daalo (example: you@company.com)");
      return;
    }
    setLoading(true);
    saveProfile({
      email: clean,
      companyName: "",
      logoDataUrl: null,
      createdAt: new Date().toISOString(),
    });
    setTimeout(() => router.push("/onboarding"), 300);
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-300 shadow-lg shadow-brand-500/40 mb-5">
            <span className="text-3xl">🦾</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight glow-text">
            Clawagent
          </h1>
          <p className="mt-3 text-brand-100/70">
            Hire AI employees that think, talk, and work like humans.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="glass rounded-2xl p-8 space-y-5"
        >
          <div>
            <label className="block text-sm font-medium text-brand-100/80 mb-2">
              Your email
            </label>
            <input
              type="email"
              placeholder="you@company.com"
              className="input-field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              required
            />
          </div>

          {error && (
            <p className="text-rose-300 text-sm bg-rose-500/10 border border-rose-500/30 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3.5 rounded-xl font-semibold text-white"
          >
            {loading ? "Signing in…" : "Continue →"}
          </button>

          <p className="text-center text-xs text-brand-100/50 pt-2">
            No password needed — we just use your email to label your workspace.
          </p>
        </form>

        <div className="mt-10 grid grid-cols-3 gap-3 text-center">
          {[
            ["500+", "AI employees"],
            ["8", "specialized roles"],
            ["24/7", "always working"],
          ].map(([n, l]) => (
            <div
              key={l}
              className="glass rounded-xl py-4 px-2"
            >
              <div className="text-2xl font-bold text-brand-300">{n}</div>
              <div className="text-xs text-brand-100/60 mt-1">{l}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
