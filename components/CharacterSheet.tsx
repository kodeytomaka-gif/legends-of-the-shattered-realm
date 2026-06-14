"use client";

import { useState } from "react";
import type { GameState, ItemInstance, EquipSlot } from "@/lib/game/types";
import { ABILITY_KEYS, ABILITY_NAMES } from "@/lib/game/types";
import { ABILITIES, getItem, RACES, CLASSES, getSubclasses } from "@/lib/game/content";
import {
  abilityMod,
  modString,
} from "@/lib/game/dice";
import {
  armorClass,
  attackBonus,
  effectiveMaxHp,
  effectiveMaxMp,
  getInstance,
  equippedMods,
  MASTERY_THRESHOLDS,
  MAX_RANK,
} from "@/lib/game/character";
import { RARITY } from "@/lib/game/loot";
import ItemCard from "@/components/ItemCard";

const SLOT_LABELS: { slot: EquipSlot; label: string }[] = [
  { slot: "weapon", label: "Weapon" },
  { slot: "armor", label: "Armor" },
  { slot: "ring1", label: "Ring I" },
  { slot: "ring2", label: "Ring II" },
  { slot: "amulet", label: "Amulet" },
];

const KIND_SLOT: Record<string, EquipSlot> = {
  weapon: "weapon",
  armor: "armor",
  ring: "ring1",
  amulet: "amulet",
};

export default function CharacterSheet({
  state,
  onClose,
  onUsePotion,
  onEquip,
}: {
  state: GameState;
  onClose: () => void;
  onUsePotion: (itemId: string, seat: number) => void;
  onEquip: (uid: string, seat: number) => void;
}) {
  const [seat, setSeat] = useState(Math.min(state.turnPlayer, state.party.length - 1));
  const [inspect, setInspect] = useState<ItemInstance | null>(null);
  const c = state.party[seat] ?? state.party[0];
  const gear = state.gear;
  const multi = state.party.length > 1;
  const canEquip = state.phase === "exploring";
  const mods = equippedMods(c, gear);

  // Gear not currently equipped by anyone is available to equip.
  const equippedUids = new Set<string>();
  for (const h of state.party) for (const u of Object.values(h.equipment)) if (u) equippedUids.add(u);
  const available = gear.filter((g) => !equippedUids.has(g.uid));

  const consumables = state.inventory.reduce<Record<string, number>>((acc, s) => {
    const k = getItem(s.itemId).kind;
    if (k === "potion" || k === "trinket" || k === "key") acc[s.itemId] = (acc[s.itemId] ?? 0) + s.qty;
    return acc;
  }, {});

  const sub = getSubclasses(c.klass).find((s) => s.id === c.subclass);

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <aside
        className="scroll-thin h-full w-full max-w-md overflow-y-auto border-l border-gold-400/30 bg-ink-800 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-gold-400">Party</h2>
          <button onClick={onClose} className="ghost-btn !px-3">✕</button>
        </div>

        {multi && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {state.party.map((h, i) => (
              <button
                key={i}
                onClick={() => setSeat(i)}
                className={`rounded-md border px-2.5 py-1 text-xs font-display transition ${
                  i === seat ? "border-gold-400 bg-ink-600/60 text-gold-300" : "border-gold-400/20 bg-ink-700/40 text-parchment-200/80"
                }`}
              >
                {h.name}{h.hp <= 0 && " 💀"}
              </button>
            ))}
          </div>
        )}

        <p className="font-display text-parchment-100">{c.name}</p>
        <p className="text-sm text-parchment-300/70">
          Level {c.level} {RACES[c.race].name} {CLASSES[c.klass].name}{sub ? ` · ${sub.name}` : ""}
        </p>
        <p className="mt-1 text-xs text-ember-400/80">
          HP {Math.max(0, c.hp)}/{effectiveMaxHp(c, gear)} · Weave {c.mp}/{effectiveMaxMp(c, gear)} · 🛡 AC {armorClass(c, gear)} · ⚔ {modString(attackBonus(c, gear))}
        </p>
        <p className="mt-1 text-xs text-moss-400">{RACES[c.race].trait}</p>

        {/* Ability scores (with gear bonuses) */}
        <h3 className="mt-5 font-display text-gold-400/80">Ability Scores</h3>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ABILITY_KEYS.map((k) => {
            const bonus = mods.abilities[k] ?? 0;
            const total = c.abilities[k] + bonus;
            return (
              <div key={k} className="stat-pill">
                <span className="text-[10px] uppercase tracking-wider text-parchment-300/60">{ABILITY_NAMES[k].slice(0, 3)}</span>
                <span className="font-display text-lg text-parchment-100">
                  {total}{bonus !== 0 && <span className={`ml-0.5 text-[10px] ${bonus > 0 ? "text-moss-400" : "text-ember-400"}`}>({bonus > 0 ? "+" : ""}{bonus})</span>}
                </span>
                <span className="text-[10px] text-gold-400/70">{modString(abilityMod(total))}</span>
              </div>
            );
          })}
        </div>

        {/* Equipment slots */}
        <h3 className="mt-5 font-display text-gold-400/80">Equipment{multi ? ` — ${c.name}` : ""}</h3>
        <div className="mt-2 space-y-1.5">
          {SLOT_LABELS.map(({ slot, label }) => {
            const inst = getInstance(gear, c.equipment[slot]);
            return (
              <div key={slot} className="flex items-center gap-2">
                <span className="w-16 shrink-0 text-[11px] uppercase tracking-wider text-parchment-300/50">{label}</span>
                {inst ? (
                  <button onClick={() => setInspect(inst)} className={`flex-1 truncate rounded border ${RARITY[inst.rarity].border} bg-ink-900/40 px-2 py-1 text-left text-sm ${RARITY[inst.rarity].color}`}>
                    {inst.name}
                  </button>
                ) : (
                  <span className="flex-1 rounded border border-ink-600 bg-ink-900/30 px-2 py-1 text-sm text-parchment-300/40">— empty —</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Stash: gear to equip */}
        <h3 className="mt-5 flex items-center justify-between font-display text-gold-400/80">
          <span>Gear Stash</span>
          <span className="text-xs text-gold-300">⦿ {state.gold} gold</span>
        </h3>
        {!canEquip && <p className="text-[11px] text-parchment-300/50">Finish the battle to change gear.</p>}
        <div className="mt-1 space-y-1.5">
          {available.length === 0 && <p className="text-sm text-parchment-300/50">No spare gear.</p>}
          {available.map((g) => (
            <div key={g.uid} className={`flex items-center justify-between gap-2 rounded border ${RARITY[g.rarity].border} bg-ink-900/40 px-2 py-1.5`}>
              <button onClick={() => setInspect(g)} className={`min-w-0 flex-1 truncate text-left text-sm ${RARITY[g.rarity].color}`}>
                {g.name}
              </button>
              <button
                className="ghost-btn shrink-0 !px-2 !py-1 text-xs"
                disabled={!canEquip}
                onClick={() => onEquip(g.uid, seat)}
              >
                Equip{multi ? ` → ${c.name}` : ""}
              </button>
            </div>
          ))}
        </div>

        {/* Abilities */}
        <h3 className="mt-5 font-display text-gold-400/80">Abilities &amp; Spells</h3>
        <div className="mt-2 space-y-1.5">
          {c.abilityIds.map((id) => {
            const a = ABILITIES[id];
            if (!a) return null;
            const sk = c.skill[id] ?? { uses: 0, rank: 1 };
            const prevT = sk.rank > 1 ? MASTERY_THRESHOLDS[sk.rank - 2] : 0;
            const nextT = sk.rank < MAX_RANK ? MASTERY_THRESHOLDS[sk.rank - 1] : sk.uses;
            const pct = sk.rank >= MAX_RANK ? 100 : Math.min(100, ((sk.uses - prevT) / (nextT - prevT)) * 100);
            return (
              <div key={id} className="rune-panel !p-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm text-parchment-100">
                    {a.name} <span className="text-[10px] text-gold-300">{"★".repeat(sk.rank)}{"☆".repeat(MAX_RANK - sk.rank)}</span>
                  </span>
                  <span className="text-[10px] text-arcane-400">{a.mpCost} Weave{a.dayCooldown ? " · 1/day" : ""}</span>
                </div>
                <p className="mt-0.5 text-xs text-parchment-300/70">{a.desc}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <div className="bar-track !h-1.5"><div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300" style={{ width: `${pct}%` }} /></div>
                  <span className="shrink-0 text-[9px] text-parchment-300/50">{sk.rank >= MAX_RANK ? "MAX" : `Rank ${sk.rank}`}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Consumables */}
        <h3 className="mt-5 font-display text-gold-400/80">Consumables</h3>
        <div className="mt-2 space-y-1.5">
          {Object.keys(consumables).length === 0 && <p className="text-sm text-parchment-300/50">None.</p>}
          {Object.entries(consumables).map(([id, qty]) => {
            const item = getItem(id);
            return (
              <div key={id} className="rune-panel flex items-center justify-between !p-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-display text-sm text-parchment-100">{item.name}</span>
                    {qty > 1 && <span className="text-xs text-parchment-300/60">×{qty}</span>}
                  </div>
                  <p className="truncate text-xs text-parchment-300/60">{item.desc}</p>
                </div>
                {item.kind === "potion" && (
                  <button
                    className="ghost-btn ml-2 shrink-0 !px-2 !py-1 text-xs"
                    disabled={!canEquip}
                    onClick={() => onUsePotion(id, seat)}
                  >
                    Use
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Inspect overlay */}
      {inspect && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setInspect(null)}>
          <div className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <ItemCard inst={inspect} />
            {(() => {
              const slot = KIND_SLOT[getItem(inspect.defId).kind];
              const equipped = slot ? getInstance(gear, c.equipment[slot]) : null;
              const isEquippedItem = equipped?.uid === inspect.uid;
              return (
                <>
                  {equipped && !isEquippedItem && (
                    <div className="mt-2">
                      <p className="mb-1 text-[11px] uppercase tracking-wider text-parchment-300/50">Currently equipped ({c.name}):</p>
                      <ItemCard inst={equipped} compact />
                    </div>
                  )}
                  <div className="mt-3 flex justify-center gap-2">
                    {!isEquippedItem && !equippedUids.has(inspect.uid) && (
                      <button className="gold-btn" disabled={!canEquip} onClick={() => { onEquip(inspect.uid, seat); setInspect(null); }}>
                        Equip{multi ? ` → ${c.name}` : ""}
                      </button>
                    )}
                    <button className="ghost-btn" onClick={() => setInspect(null)}>Close</button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
