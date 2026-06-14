"use client";

import type { GameState, Character } from "@/lib/game/types";
import { RACES, CLASSES } from "@/lib/game/content";
import { armorClass } from "@/lib/game/character";

function MiniBar({ value, max, className }: { value: number; max: number; className: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full border border-black/40 bg-ink-900/80">
      <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function HeroCard({ c, active, downed }: { c: Character; active: boolean; downed: boolean }) {
  return (
    <div
      className={`rounded-md border px-2.5 py-1.5 transition ${
        downed
          ? "border-ink-600 bg-ink-900/60 opacity-60"
          : active
            ? "border-gold-400 bg-ink-600/50 shadow-glow"
            : "border-gold-400/20 bg-ink-900/50"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate font-display text-sm text-parchment-100">
          {active && "▸ "}
          {c.name}
          {downed && " 💀"}
        </span>
        <span className="shrink-0 text-[10px] text-parchment-300/60">
          Lv{c.level} {CLASSES[c.klass].name} · 🛡{armorClass(c)}
        </span>
      </div>
      <div className="mt-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="w-7 shrink-0 text-[10px] text-ember-400/80">{Math.max(0, c.hp)}</span>
          <MiniBar value={c.hp} max={c.maxHp} className="bg-gradient-to-r from-ember-500 to-ember-400" />
        </div>
        {c.maxMp > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-7 shrink-0 text-[10px] text-arcane-400/80">{c.mp}</span>
            <MiniBar value={c.mp} max={c.maxMp} className="bg-gradient-to-r from-arcane-500 to-arcane-400" />
          </div>
        )}
      </div>
    </div>
  );
}

export default function HeroBar({ state, activeSeat }: { state: GameState; activeSeat: number }) {
  const solo = state.party.length === 1;
  return (
    <div className="rune-panel">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-display tracking-wide text-gold-400/80">
          {solo ? "Hero" : `Party of ${state.party.length}`}
        </span>
        <div className="flex items-center gap-2">
          <span className="rounded border border-gold-400/30 px-2 py-0.5 text-gold-300" title="Shared gold">⦿ {state.gold}</span>
          {state.campaignId === "shattered" && (
            <span className="rounded border border-arcane-400/40 px-2 py-0.5 text-arcane-400" title="Shards of Aethyr">✦ {state.shards}/3</span>
          )}
        </div>
      </div>
      <div className={`grid gap-2 ${solo ? "grid-cols-1" : "grid-cols-2"}`}>
        {state.party.map((c, i) => (
          <HeroCard key={i} c={c} active={i === activeSeat} downed={c.hp <= 0} />
        ))}
      </div>
    </div>
  );
}
