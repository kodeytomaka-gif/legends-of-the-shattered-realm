"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RACES, CLASSES } from "@/lib/game/content";
import {
  ABILITY_KEYS,
  ABILITY_NAMES,
  type AbilityKey,
  type Abilities,
  type RaceId,
  type ClassId,
} from "@/lib/game/types";
import {
  POINT_BUY_TOTAL,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  defaultPointBuy,
  totalSpent,
  applyRaceBonuses,
  createCharacter,
  maxHpFor,
} from "@/lib/game/character";
import { abilityMod, modString } from "@/lib/game/dice";
import { newGame } from "@/lib/game/engine";
import { saveGame } from "@/lib/game/save";
import { CAMPAIGNS } from "@/lib/game/campaigns";

interface Draft {
  name: string;
  race: RaceId;
  klass: ClassId;
  scores: Abilities;
}

function newDraft(): Draft {
  return { name: "", race: "human", klass: "warrior", scores: defaultPointBuy() };
}

export default function CreatePage() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(CAMPAIGNS[0].id);
  const [drafts, setDrafts] = useState<Draft[]>([newDraft()]);
  const [active, setActive] = useState(0);

  const d = drafts[active];
  const spent = totalSpent(d.scores);
  const remaining = POINT_BUY_TOTAL - spent;
  const finalScores = useMemo(() => applyRaceBonuses(d.scores, d.race), [d.scores, d.race]);
  const previewHp = maxHpFor(d.klass, finalScores.con, 1, false);

  function patch(p: Partial<Draft>) {
    setDrafts((prev) => prev.map((x, i) => (i === active ? { ...x, ...p } : x)));
  }

  function setPlayerCount(n: number) {
    setDrafts((prev) => {
      const next = [...prev];
      while (next.length < n) next.push(newDraft());
      next.length = n;
      return next;
    });
    setActive((a) => Math.min(a, n - 1));
  }

  function adjust(key: AbilityKey, delta: number) {
    const target = d.scores[key] + delta;
    if (target < POINT_BUY_MIN || target > POINT_BUY_MAX) return;
    const trial = { ...d.scores, [key]: target };
    if (totalSpent(trial) > POINT_BUY_TOTAL) return;
    patch({ scores: trial });
  }

  function begin() {
    const party = drafts.map((draft, i) =>
      createCharacter({
        name: draft.name.trim() || `Hero ${i + 1}`,
        race: draft.race,
        klass: draft.klass,
        abilities: draft.scores,
      })
    );
    const game = newGame(party, campaignId);
    saveGame(game);
    router.push("/play");
  }

  const partySize = drafts.length;

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="ghost-btn">← Back</Link>
        <h1 className="font-display text-3xl text-gold-400 sm:text-4xl">Forge Your Party</h1>
        <div className="w-20" />
      </div>

      {/* Adventure */}
      <section className="rune-card mb-6">
        <h2 className="mb-4 font-display text-xl text-gold-400">Choose Your Adventure</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {CAMPAIGNS.map((c) => {
            const selected = campaignId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setCampaignId(c.id)}
                className={`rounded-md border px-4 py-3 text-left transition ${
                  selected ? "border-gold-400 bg-ink-600/60 shadow-glow" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"
                }`}
              >
                <div className="font-display text-parchment-100">{c.title}</div>
                <div className="mt-0.5 text-xs uppercase tracking-wider text-gold-400/70">{c.tagline}</div>
                <p className="mt-1.5 text-sm text-parchment-200/70">{c.blurb}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* Players (local pass-and-play) */}
      <section className="rune-card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl text-gold-400">Players (Pass &amp; Play)</h2>
            <p className="mt-1 text-sm text-parchment-200/70">
              Up to 4 heroes on one device — pass it around as turns change. For online play with room
              codes, use{" "}
              <Link href="/online" className="text-gold-400 underline">Online Co-op</Link>.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setPlayerCount(n)}
                className={`h-9 w-9 rounded-md border font-display transition ${
                  partySize === n ? "border-gold-400 bg-ink-600/60 text-gold-300" : "border-gold-400/20 bg-ink-700/40 text-parchment-200/80"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {partySize > 1 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {drafts.map((dr, i) => (
              <button
                key={i}
                onClick={() => setActive(i)}
                className={`rounded-md border px-3 py-1.5 text-sm font-display transition ${
                  i === active ? "border-gold-400 bg-ink-600/60 text-gold-300" : "border-gold-400/20 bg-ink-700/40 text-parchment-200/80"
                }`}
              >
                {dr.name.trim() || `Player ${i + 1}`}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Hero editor for the active player */}
      <section className="rune-card mb-6">
        <label className="block">
          <span className="mb-1 block font-display tracking-wider text-gold-400">
            {partySize > 1 ? `Player ${active + 1} — Name` : "Name"}
          </span>
          <input
            className="input max-w-sm"
            value={d.name}
            placeholder={`Hero ${active + 1}`}
            maxLength={24}
            onChange={(e) => patch({ name: e.target.value })}
          />
        </label>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Race */}
        <section className="rune-card">
          <h2 className="mb-4 font-display text-xl text-gold-400">Lineage</h2>
          <div className="space-y-2">
            {(Object.keys(RACES) as RaceId[]).map((id) => {
              const r = RACES[id];
              const selected = d.race === id;
              return (
                <button
                  key={id}
                  onClick={() => patch({ race: id })}
                  className={`w-full rounded-md border px-4 py-3 text-left transition ${
                    selected ? "border-gold-400 bg-ink-600/60 shadow-glow" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-parchment-100">{r.name}</span>
                    <span className="text-xs text-gold-400/80">
                      {Object.entries(r.bonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ")}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-parchment-200/70">{r.blurb}</p>
                  <p className="mt-1 text-xs text-moss-400">{r.trait}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Class */}
        <section className="rune-card">
          <h2 className="mb-4 font-display text-xl text-gold-400">Calling</h2>
          <div className="space-y-2">
            {(Object.keys(CLASSES) as ClassId[]).map((id) => {
              const c = CLASSES[id];
              const selected = d.klass === id;
              return (
                <button
                  key={id}
                  onClick={() => patch({ klass: id })}
                  className={`w-full rounded-md border px-4 py-3 text-left transition ${
                    selected ? "border-gold-400 bg-ink-600/60 shadow-glow" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-parchment-100">{c.name}</span>
                    <span className="text-xs text-gold-400/80">Primary: {ABILITY_NAMES[c.primary]}</span>
                  </div>
                  <p className="mt-1 text-sm text-parchment-200/70">{c.blurb}</p>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Ability scores */}
      <section className="rune-card mt-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl text-gold-400">Abilities</h2>
          <span className={`rounded-md border px-3 py-1 text-sm ${remaining === 0 ? "border-moss-400/40 text-moss-400" : "border-gold-400/40 text-gold-400"}`}>
            {remaining} points left
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ABILITY_KEYS.map((key) => {
            const base = d.scores[key];
            const bonus = finalScores[key] - base;
            return (
              <div key={key} className="rune-panel">
                <div className="flex items-center justify-between">
                  <span className="font-display text-parchment-100">{ABILITY_NAMES[key]}</span>
                  <span className="text-xs text-gold-400/70">{modString(abilityMod(finalScores[key]))}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button onClick={() => adjust(key, -1)} disabled={base <= POINT_BUY_MIN} className="ghost-btn h-8 w-8 !px-0 text-lg">−</button>
                  <span className="font-display text-xl text-gold-400">
                    {finalScores[key]}
                    {bonus > 0 && <span className="ml-1 text-xs text-moss-400">({base}+{bonus})</span>}
                  </span>
                  <button onClick={() => adjust(key, +1)} disabled={base >= POINT_BUY_MAX || remaining <= 0} className="ghost-btn h-8 w-8 !px-0 text-lg">+</button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-parchment-300/60">
          {partySize > 1 ? `Player ${active + 1} vitals` : "Starting vitals"}:{" "}
          <span className="text-ember-400">HP {previewHp}</span> · Gold pooled across the party
        </p>
      </section>

      <div className="mt-8 flex justify-center">
        <button onClick={begin} className="gold-btn px-10 text-lg">
          {partySize > 1 ? `Begin with ${partySize} Heroes ⚜` : "Begin Your Legend ⚜"}
        </button>
      </div>
    </main>
  );
}
