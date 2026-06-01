"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function TableLanding() {
  const router = useRouter();
  const [name, setName] = useState("The Table");
  const [hostDisplayName, setHostDisplayName] = useState("Game Master");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/campaigns", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, mode: "LOCAL", hostDisplayName }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not begin the table.");
      setBusy(false);
      return;
    }
    const { id } = await res.json();
    router.push(`/campaigns/${id}/character`);
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl text-gold-400">Local Table</h1>
      <p className="mt-2 text-parchment-200/85">
        Pass the device around the table. No accounts needed.
      </p>
      <div className="rune-card mt-8 space-y-4">
        <label className="block">
          <span className="block text-sm font-display tracking-wider text-gold-400 mb-1">Table Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-display tracking-wider text-gold-400 mb-1">Your Name</span>
          <input
            value={hostDisplayName}
            onChange={(e) => setHostDisplayName(e.target.value)}
            className="input"
          />
        </label>
        {error && <p className="text-ember-500 text-sm">{error}</p>}
        <button onClick={start} disabled={busy} className="gold-btn w-full">
          {busy ? "Setting the stage..." : "Begin the Table"}
        </button>
      </div>
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
