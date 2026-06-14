"use client";

import type { ItemInstance } from "@/lib/game/types";
import { getItem } from "@/lib/game/content";
import { RARITY, affixLabel, instanceValue, PERKS } from "@/lib/game/loot";

export default function ItemCard({ inst, compact }: { inst: ItemInstance; compact?: boolean }) {
  const def = getItem(inst.defId);
  const r = RARITY[inst.rarity];
  return (
    <div className={`rounded-md border ${r.border} bg-ink-900/50 ${compact ? "p-2" : "p-3"}`}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-display ${compact ? "text-sm" : ""} ${r.color}`}>{inst.name}</span>
        <span className={`shrink-0 text-[10px] ${r.color}`}>{r.name}</span>
      </div>
      <p className="text-[11px] capitalize text-parchment-300/60">
        {def.kind}
        {def.damage ? ` · ${def.damage[0]}d${def.damage[1]}${def.damageBonus ? `+${def.damageBonus}` : ""}` : ""}
        {def.ac ? ` · +${def.ac} base AC` : ""}
      </p>
      {inst.affixes.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {inst.affixes.map((a, i) => (
            <li key={i} className={`text-xs ${a.amount >= 0 ? "text-moss-400" : "text-ember-400"}`}>
              {affixLabel(a)}
            </li>
          ))}
        </ul>
      )}
      {inst.perks.length > 0 && (
        <ul className="mt-1.5 space-y-0.5">
          {inst.perks.map((p) => (
            <li key={p} className="text-xs text-gold-300" title={PERKS[p]?.desc}>
              ◆ {PERKS[p]?.name ?? p} <span className="text-parchment-300/50">— {PERKS[p]?.desc}</span>
            </li>
          ))}
        </ul>
      )}
      {!compact && <p className="mt-1.5 text-[10px] text-parchment-300/40">Value ~{instanceValue(inst)}g</p>}
    </div>
  );
}
