"use client";

import type { Character } from "@/lib/game/types";
import { RACES, CLASSES } from "@/lib/game/content";
import { armorClass, attackBonus, xpToNext } from "@/lib/game/character";
import { modString } from "@/lib/game/dice";

function Bar({
  value,
  max,
  className,
  label,
}: {
  value: number;
  max: number;
  className: string;
  label: string;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className="min-w-0 flex-1">
      <div className="mb-0.5 flex items-baseline justify-between text-xs">
        <span className="font-display tracking-wide text-parchment-300/70">{label}</span>
        <span className="tabular-nums text-parchment-200/80">
          {value}/{max}
        </span>
      </div>
      <div className="bar-track">
        <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function HeroBar({ character }: { character: Character }) {
  const c = character;
  const ac = armorClass(c);
  const atk = attackBonus(c);
  const nextXp = xpToNext(c.level);

  return (
    <div className="rune-panel">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h2 className="truncate font-display text-lg text-gold-400">{c.name}</h2>
          <p className="text-xs text-parchment-300/70">
            Lv {c.level} {RACES[c.race].name} {CLASSES[c.klass].name}
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded border border-gold-400/30 px-2 py-1" title="Armor Class">
            🛡 AC {ac}
          </span>
          <span className="rounded border border-gold-400/30 px-2 py-1" title="Attack Bonus">
            ⚔ {modString(atk)}
          </span>
          <span className="rounded border border-gold-400/30 px-2 py-1 text-gold-300" title="Gold">
            ⦿ {c.gold}
          </span>
          <span className="rounded border border-arcane-400/40 px-2 py-1 text-arcane-400" title="Shards of Aethyr">
            ✦ {c.shards}/3
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:gap-4">
        <Bar value={c.hp} max={c.maxHp} label="Health" className="bg-gradient-to-r from-ember-500 to-ember-400" />
        <Bar value={c.mp} max={c.maxMp} label="Weave" className="bg-gradient-to-r from-arcane-500 to-arcane-400" />
        <Bar value={c.xp} max={nextXp} label="Experience" className="bg-gradient-to-r from-gold-500 to-gold-300" />
      </div>
    </div>
  );
}
