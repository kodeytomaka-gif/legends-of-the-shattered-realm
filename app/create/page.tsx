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
  maxMpFor,
} from "@/lib/game/character";
import { abilityMod, modString } from "@/lib/game/dice";
import { newGame } from "@/lib/game/engine";
import { saveGame } from "@/lib/game/save";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [race, setRace] = useState<RaceId>("human");
  const [klass, setKlass] = useState<ClassId>("warrior");
  const [scores, setScores] = useState<Abilities>(defaultPointBuy);

  const spent = totalSpent(scores);
  const remaining = POINT_BUY_TOTAL - spent;

  const finalScores = useMemo(() => applyRaceBonuses(scores, race), [scores, race]);
  const previewHp = maxHpFor(klass, finalScores.con, 1, false);
  const previewMp = maxMpFor(klass, finalScores[CLASSES[klass].primary], 1);

  function adjust(key: AbilityKey, delta: number) {
    setScores((prev) => {
      const next = { ...prev };
      const target = next[key] + delta;
      if (target < POINT_BUY_MIN || target > POINT_BUY_MAX) return prev;
      const trial = { ...next, [key]: target };
      if (totalSpent(trial) > POINT_BUY_TOTAL) return prev;
      return trial;
    });
  }

  function begin() {
    const character = createCharacter({
      name: name.trim() || "Wanderer",
      race,
      klass,
      abilities: scores,
    });
    const game = newGame(character);
    saveGame(game);
    router.push("/play");
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-8 flex items-center justify-between">
        <Link href="/" className="ghost-btn">
          ← Back
        </Link>
        <h1 className="font-display text-3xl text-gold-400 sm:text-4xl">Forge Your Hero</h1>
        <div className="w-20" />
      </div>

      {/* Name */}
      <section className="rune-card mb-6">
        <label className="block">
          <span className="mb-1 block font-display tracking-wider text-gold-400">Name</span>
          <input
            className="input max-w-sm"
            value={name}
            placeholder="Wanderer"
            maxLength={24}
            onChange={(e) => setName(e.target.value)}
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
              const selected = race === id;
              return (
                <button
                  key={id}
                  onClick={() => setRace(id)}
                  className={`w-full rounded-md border px-4 py-3 text-left transition ${
                    selected
                      ? "border-gold-400 bg-ink-600/60 shadow-glow"
                      : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-parchment-100">{r.name}</span>
                    <span className="text-xs text-gold-400/80">
                      {Object.entries(r.bonuses)
                        .map(([k, v]) => `+${v} ${k.toUpperCase()}`)
                        .join(" ")}
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
              const selected = klass === id;
              return (
                <button
                  key={id}
                  onClick={() => setKlass(id)}
                  className={`w-full rounded-md border px-4 py-3 text-left transition ${
                    selected
                      ? "border-gold-400 bg-ink-600/60 shadow-glow"
                      : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display text-parchment-100">{c.name}</span>
                    <span className="text-xs text-gold-400/80">
                      Primary: {ABILITY_NAMES[c.primary]}
                    </span>
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
          <span
            className={`rounded-md border px-3 py-1 text-sm ${
              remaining === 0
                ? "border-moss-400/40 text-moss-400"
                : "border-gold-400/40 text-gold-400"
            }`}
          >
            {remaining} points left
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ABILITY_KEYS.map((key) => {
            const base = scores[key];
            const bonus = finalScores[key] - base;
            return (
              <div key={key} className="rune-panel">
                <div className="flex items-center justify-between">
                  <span className="font-display text-parchment-100">{ABILITY_NAMES[key]}</span>
                  <span className="text-xs text-gold-400/70">{modString(abilityMod(finalScores[key]))}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <button
                    onClick={() => adjust(key, -1)}
                    disabled={base <= POINT_BUY_MIN}
                    className="ghost-btn h-8 w-8 !px-0 text-lg"
                  >
                    −
                  </button>
                  <span className="font-display text-xl text-gold-400">
                    {finalScores[key]}
                    {bonus > 0 && <span className="ml-1 text-xs text-moss-400">({base}+{bonus})</span>}
                  </span>
                  <button
                    onClick={() => adjust(key, +1)}
                    disabled={base >= POINT_BUY_MAX || remaining <= 0}
                    className="ghost-btn h-8 w-8 !px-0 text-lg"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 text-sm text-parchment-300/60">
          Starting vitals: <span className="text-ember-400">HP {previewHp}</span> ·{" "}
          <span className="text-arcane-400">Weave {previewMp}</span> · Gold {CLASSES[klass].startingGold}
        </p>
      </section>

      <div className="mt-8 flex justify-center">
        <button onClick={begin} className="gold-btn px-10 text-lg">
          Begin Your Legend ⚜
        </button>
      </div>
    </main>
  );
}
