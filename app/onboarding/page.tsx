"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LogoUploader from "@/components/LogoUploader";
import { getProfile, saveProfile } from "@/lib/storage";

type Step = 1 | 2;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [companyName, setCompanyName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const p = getProfile();
    if (!p?.email) {
      router.replace("/");
      return;
    }
    setEmail(p.email);
    if (p.companyName) setCompanyName(p.companyName);
    if (p.logoDataUrl) setLogo(p.logoDataUrl);
  }, [router]);

  const next = () => {
    if (step === 1) {
      if (!companyName.trim()) return;
      setStep(2);
      return;
    }
    saveProfile({
      email,
      companyName: companyName.trim(),
      logoDataUrl: logo,
      createdAt: new Date().toISOString(),
    });
    router.push("/dashboard");
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl">
        <div className="flex items-center gap-3 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                step >= s ? "bg-brand-400" : "bg-brand-900/60"
              }`}
            />
          ))}
        </div>

        <div className="glass rounded-2xl p-8">
          {step === 1 && (
            <>
              <h1 className="text-3xl font-bold mb-2">
                Give your company name
              </h1>
              <p className="text-brand-100/60 mb-6">
                This is how your AI employees will refer to your business.
              </p>

              <input
                className="input-field text-lg"
                placeholder="e.g. Sharma Tea Stall, Vedant Tech, Acme Inc."
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && companyName.trim()) next();
                }}
              />

              <div className="flex justify-end mt-6">
                <button
                  className="btn-primary px-6 py-3 rounded-xl font-semibold text-white"
                  disabled={!companyName.trim()}
                  onClick={next}
                >
                  Continue →
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="text-3xl font-bold mb-2">Choose your company logo</h1>
              <p className="text-brand-100/60 mb-6">
                Upload, drop a file, or just <strong>paste</strong> from your
                clipboard.
              </p>

              <LogoUploader value={logo} onChange={setLogo} />

              <div className="flex justify-between items-center mt-6">
                <button
                  className="text-brand-200 hover:text-brand-100 text-sm"
                  onClick={() => setStep(1)}
                >
                  ← Back
                </button>
                <div className="flex gap-3">
                  <button
                    className="text-brand-100/70 hover:text-brand-100 text-sm px-4"
                    onClick={() => {
                      setLogo(null);
                      next();
                    }}
                  >
                    Skip for now
                  </button>
                  <button
                    className="btn-primary px-6 py-3 rounded-xl font-semibold text-white"
                    onClick={next}
                  >
                    Enter dashboard →
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-xs text-brand-100/40 mt-6">
          Logged in as {email}
        </p>
      </div>
    </main>
  );
}
