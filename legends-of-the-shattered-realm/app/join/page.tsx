"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [displayName, setDisplayName] = useState("Adventurer");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns/join", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inviteCode: code.toUpperCase(), displayName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Invalid code.");
      setBusy(false);
      return;
    }
    const { campaignId } = await res.json();
    router.push(`/campaigns/${campaignId}/character`);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl text-gold-400">Join with Code</h1>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rune-card">
        <label className="block">
          <span className="block text-sm font-display tracking-wider text-gold-400 mb-1">Invite Code</span>
          <input
            className="input font-mono uppercase tracking-widest"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            required
            maxLength={8}
          />
        </label>
        <label className="block">
          <span className="block text-sm font-display tracking-wider text-gold-400 mb-1">Display Name</span>
          <input
            className="input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>
        {error && <p className="text-ember-500 text-sm">{error}</p>}
        <button className="gold-btn w-full" disabled={busy}>
          {busy ? "Entering..." : "Step Through"}
        </button>
      </form>
      <style jsx>{`
        :global(.input) {
          width: 100%;
          background: rgba(15, 12, 8, 0.6);
          border: 1px solid rgba(212, 175, 55, 0.35);
          color: #ede0bf;
          padding: 0.6rem 0.8rem;
          border-radius: 0.4rem;
        }
        :global(.input:focus) {
          outline: none;
          border-color: #d4af37;
          box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.15);
        }
      `}</style>
    </main>
  );
}
