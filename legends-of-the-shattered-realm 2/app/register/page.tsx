"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "Could not register.");
      setBusy(false);
      return;
    }
    const result = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (result?.error) {
      setError("Registered, but sign-in failed. Try the login page.");
      return;
    }
    router.push("/campaigns");
  }

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl text-gold-400">Take the Quill</h1>
      <p className="mt-2 text-parchment-200/85">Create an account to host and join online campaigns.</p>
      <form onSubmit={onSubmit} className="mt-8 space-y-4 rune-card">
        <Field label="Name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </Field>
        <Field label="Password (min 8)">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="input"
          />
        </Field>
        {error && <p className="text-ember-500 text-sm">{error}</p>}
        <button className="gold-btn w-full" disabled={busy}>
          {busy ? "Inscribing..." : "Register"}
        </button>
        <p className="text-sm text-parchment-200/70 text-center">
          Have an account?{" "}
          <Link href="/login" className="text-gold-400 underline">
            Sign in
          </Link>
        </p>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-display tracking-wider text-gold-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
