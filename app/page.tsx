"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hasSave, loadGame, clearSave, loadSettings, saveSettings } from "@/lib/game/save";
import { RACES, CLASSES } from "@/lib/game/content";
import { getCampaign } from "@/lib/game/campaigns";

export default function HomePage() {
  const router = useRouter();
  const [saved, setSaved] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [aiDm, setAiDm] = useState(false);

  useEffect(() => {
    const has = hasSave();
    setSaved(has);
    if (has) {
      const g = loadGame();
      if (g) {
        const camp = getCampaign(g.campaignId);
        const progress = g.campaignId === "shattered" ? ` · ${g.shards}/3 Shards` : "";
        if (g.party.length > 1) {
          const names = g.party.map((c) => c.name).join(", ");
          setSummary(`${names} — party of ${g.party.length}${progress} · ${camp.title}`);
        } else {
          const c = g.party[0];
          setSummary(`${c.name} — Lv ${c.level} ${RACES[c.race].name} ${CLASSES[c.klass].name}${progress} · ${camp.title}`);
        }
      }
    }
    setAiDm(loadSettings().aiDm);
  }, []);

  function toggleAi() {
    const next = !aiDm;
    setAiDm(next);
    saveSettings({ ...loadSettings(), aiDm: next });
  }

  function abandon() {
    if (confirm("Abandon your current legend? This cannot be undone.")) {
      clearSave();
      setSaved(false);
      setSummary(null);
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-16 text-center">
      <div className="animate-fade-in">
        <p className="font-display tracking-[0.4em] text-gold-400/70 text-sm">A FANTASY RPG</p>
        <h1 className="mt-4 font-display text-5xl font-bold leading-tight text-gold-400 drop-shadow-[0_2px_24px_rgba(212,175,55,0.25)] sm:text-6xl md:text-7xl">
          Legends of the
          <br />
          Shattered Realm
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-parchment-200/85">
          The world broke in the Sundering. Forge a hero, gather the three Shards of
          Aethyr, and decide whether to mend the realm — or claim it for your own.
        </p>
      </div>

      <div className="divider-rune mt-10 w-full max-w-sm">✦</div>

      <div className="flex w-full max-w-sm flex-col gap-3">
        {saved && (
          <button
            className="gold-btn w-full text-lg"
            onClick={() => router.push("/play")}
          >
            Continue Your Legend
          </button>
        )}
        {summary && <p className="text-sm text-parchment-300/70">{summary}</p>}

        <Link href="/create" className={saved ? "ghost-btn w-full" : "gold-btn w-full text-lg"}>
          {saved ? "Begin a New Legend" : "Begin Your Legend"}
        </Link>

        <Link href="/online" className="ghost-btn w-full">
          ⚔ Online Co-op (room codes)
        </Link>
        <p className="-mt-1 text-xs text-parchment-300/50">
          Up to 4 players online, or pass-and-play on one device from “New Legend”.
        </p>

        {saved && (
          <button onClick={abandon} className="text-sm text-ember-400/70 underline hover:text-ember-400">
            Abandon current save
          </button>
        )}
      </div>

      <label className="mt-10 flex cursor-pointer items-center gap-3 rounded-lg border border-gold-400/30 bg-ink-800/60 px-4 py-3 text-sm">
        <input
          type="checkbox"
          checked={aiDm}
          onChange={toggleAi}
          className="h-4 w-4 accent-gold-400"
        />
        <span className="text-left text-parchment-200/85">
          <span className="font-display text-gold-400">AI Dungeon Master {aiDm ? "· On" : "· Off"}</span>
          <br />
          <span className="text-parchment-300/60">
            Generates unique narration for every scene and lets you type any action you
            imagine — so no two adventures are the same. Turn off for the classic scripted tale.
          </span>
        </span>
      </label>

      <footer className="mt-12 text-xs text-parchment-300/40">
        Built with Next.js · Runs entirely in your browser · Saves locally
      </footer>
    </main>
  );
}
