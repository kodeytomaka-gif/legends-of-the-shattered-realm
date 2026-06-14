"use client";

import type { GameState } from "@/lib/game/types";
import { ABILITY_KEYS, ABILITY_NAMES } from "@/lib/game/types";
import { ABILITIES, getItem, RACES, CLASSES } from "@/lib/game/content";
import { abilityMod, modString } from "@/lib/game/dice";

export default function CharacterSheet({
  state,
  onClose,
  onUsePotion,
  onEquip,
}: {
  state: GameState;
  onClose: () => void;
  onUsePotion: (itemId: string) => void;
  onEquip: (itemId: string) => void;
}) {
  const c = state.character;
  const canUsePotions = state.phase === "exploring";

  // Group inventory by item id with counts.
  const grouped = c.inventory.reduce<Record<string, number>>((acc, s) => {
    acc[s.itemId] = (acc[s.itemId] ?? 0) + s.qty;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="scroll-thin h-full w-full max-w-md overflow-y-auto border-l border-gold-400/30 bg-ink-800 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold-400">{c.name}</h2>
          <button onClick={onClose} className="ghost-btn !px-3">✕</button>
        </div>
        <p className="text-sm text-parchment-300/70">
          Level {c.level} {RACES[c.race].name} {CLASSES[c.klass].name}
        </p>
        <p className="mt-1 text-xs text-moss-400">{RACES[c.race].trait}</p>

        {/* Abilities */}
        <h3 className="mt-5 font-display text-gold-400/80">Abilities</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ABILITY_KEYS.map((k) => (
            <div key={k} className="stat-pill">
              <span className="text-[10px] uppercase tracking-wider text-parchment-300/60">{ABILITY_NAMES[k].slice(0, 3)}</span>
              <span className="font-display text-lg text-parchment-100">{c.abilities[k]}</span>
              <span className="text-[10px] text-gold-400/70">{modString(abilityMod(c.abilities[k]))}</span>
            </div>
          ))}
        </div>

        {/* Known abilities */}
        <h3 className="mt-5 font-display text-gold-400/80">Abilities & Spells</h3>
        <div className="mt-2 space-y-1.5">
          {c.abilityIds.map((id) => {
            const a = ABILITIES[id];
            if (!a) return null;
            return (
              <div key={id} className="rune-panel !p-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm text-parchment-100">{a.name}</span>
                  <span className="text-[10px] text-arcane-400">{a.mpCost} Weave</span>
                </div>
                <p className="mt-0.5 text-xs text-parchment-300/70">{a.desc}</p>
              </div>
            );
          })}
        </div>

        {/* Inventory */}
        <h3 className="mt-5 font-display text-gold-400/80">Inventory</h3>
        <div className="mt-2 space-y-1.5">
          {Object.keys(grouped).length === 0 && (
            <p className="text-sm text-parchment-300/50">Your pack is empty.</p>
          )}
          {Object.entries(grouped).map(([id, qty]) => {
            const item = getItem(id);
            const equipped = c.equippedWeapon === id || c.equippedArmor === id;
            const equippable = item.kind === "weapon" || item.kind === "armor";
            return (
              <div key={id} className="rune-panel flex items-center justify-between !p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm text-parchment-100">
                      {item.name}
                    </span>
                    {qty > 1 && <span className="text-xs text-parchment-300/60">×{qty}</span>}
                    {equipped && <span className="text-[10px] text-moss-400">equipped</span>}
                  </div>
                  <p className="truncate text-xs text-parchment-300/60">{item.desc}</p>
                </div>
                <div className="ml-2 shrink-0">
                  {item.kind === "potion" && (
                    <button
                      className="ghost-btn !px-2 !py-1 text-xs"
                      disabled={!canUsePotions}
                      onClick={() => onUsePotion(id)}
                      title={canUsePotions ? "" : "Use potions during battle from the combat panel"}
                    >
                      Use
                    </button>
                  )}
                  {equippable && !equipped && (
                    <button className="ghost-btn !px-2 !py-1 text-xs" onClick={() => onEquip(id)}>
                      Equip
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
