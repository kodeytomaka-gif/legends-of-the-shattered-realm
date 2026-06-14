"use client";

import { useEffect, useState } from "react";
import type { GameState } from "@/lib/game/types";
import { ABILITIES, ITEMS, getItem } from "@/lib/game/content";
import { currentAllySeat } from "@/lib/game/combat";
import { enemyGlyph } from "@/lib/game/art";
import { EnemyArt } from "@/components/Portrait";

const STATUS_ICON: Record<string, string> = {
  poison: "☠", burn: "🔥", bleed: "🩸", stun: "💫", regen: "✚", defend: "🛡",
};

export default function CombatPanel({
  state,
  canAct,
  onAttack,
  onAbility,
  onItem,
  onFlee,
  onDefend,
  disabled,
}: {
  state: GameState;
  canAct: boolean; // false in online mode when it isn't this client's hero
  onAttack: (idx: number) => void;
  onAbility: (id: string, idx: number) => void;
  onItem: (id: string) => void;
  onFlee: () => void;
  onDefend: () => void;
  disabled?: boolean;
}) {
  const combat = state.combat;
  const [target, setTarget] = useState(0);
  const [allyPick, setAllyPick] = useState<string | null>(null);

  useEffect(() => {
    if (!combat) return;
    if (!combat.enemies[target] || combat.enemies[target].hp <= 0) {
      const next = combat.enemies.findIndex((e) => e.hp > 0);
      if (next >= 0) setTarget(next);
    }
  }, [combat, target]);

  if (!combat) return null;
  const seat = currentAllySeat(state);
  const hero = seat >= 0 ? state.party[seat] : null;
  const multi = state.party.length > 1;
  const off = disabled || !canAct || !hero;

  const cooldowns = (seat >= 0 && combat.cooldowns[seat]) || {};
  const potions = state.inventory
    .filter((s) => getItem(s.itemId).kind === "potion")
    .reduce<Record<string, number>>((acc, s) => {
      acc[s.itemId] = (acc[s.itemId] ?? 0) + s.qty;
      return acc;
    }, {});

  return (
    <div className="space-y-3">
      {/* Turn banner */}
      {hero && (
        <div className={`rounded-md border px-3 py-1.5 text-center text-sm ${canAct ? "border-gold-400/60 bg-ink-600/40" : "border-gold-400/20 bg-ink-800/60"}`}>
          {multi ? (
            <span className="font-display text-gold-300">
              {canAct ? `▸ ${hero.name}'s turn` : `Waiting for ${hero.name}…`}
            </span>
          ) : (
            <span className="font-display text-gold-300">Your turn</span>
          )}
          <span className="ml-2 text-xs text-parchment-300/60">Round {combat.round + 1}</span>
          {seat >= 0 && (combat.statuses[seat] ?? []).filter((s) => s.turns > 0).map((s) => (
            <span key={s.type} title={`${s.type} (${s.turns})`} className="ml-1">{STATUS_ICON[s.type]}</span>
          ))}
        </div>
      )}

      {/* Enemies */}
      <div className="space-y-2">
        {combat.enemies.map((e, i) => {
          const dead = e.hp <= 0;
          const selected = i === target;
          const pct = Math.max(0, (e.hp / e.maxHp) * 100);
          return (
            <button
              key={`${e.id}_${i}`}
              disabled={dead}
              onClick={() => setTarget(i)}
              className={`w-full rounded-md border px-3 py-2 text-left transition ${
                dead
                  ? "border-ink-600 opacity-40"
                  : selected
                    ? "border-ember-400 bg-ink-600/50 shadow-glow"
                    : "border-gold-400/20 bg-ink-700/40 hover:border-ember-400/60"
              }`}
            >
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 font-display text-parchment-100">
                  <EnemyArt glyph={enemyGlyph(e.id)} size={24} />
                  {selected && !dead ? "🎯 " : ""}
                  {e.name} {dead && "(slain)"}
                  {(e.statuses ?? []).filter((s) => s.turns > 0).map((s) => (
                    <span key={s.type} title={`${s.type} (${s.turns})`} className="ml-1">{STATUS_ICON[s.type]}</span>
                  ))}
                </span>
                <span className="tabular-nums text-parchment-300/70">{Math.max(0, e.hp)}/{e.maxHp}</span>
              </div>
              <div className="bar-track mt-1.5">
                <div className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-400 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Ally target picker (e.g., Raise the Fallen) */}
      {allyPick && (
        <div className="rounded-md border border-arcane-400/40 bg-ink-700/50 p-2">
          <p className="mb-1.5 text-center text-xs font-display text-arcane-400">
            {ABILITIES[allyPick]?.name}: choose a target
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {state.party.map((h, i) => {
              const reviveAbility = ABILITIES[allyPick]?.effect.type === "revive";
              const valid = reviveAbility ? h.hp <= 0 : h.hp > 0;
              return (
                <button
                  key={i}
                  disabled={!valid}
                  className={`rounded border px-2 py-1 text-xs font-display transition ${valid ? "border-arcane-400/60 bg-ink-600/50 text-parchment-100" : "border-ink-600 text-parchment-300/40"}`}
                  onClick={() => { onAbility(allyPick, i); setAllyPick(null); }}
                >
                  {h.name}{h.hp <= 0 ? " 💀" : ""}
                </button>
              );
            })}
            <button className="rounded border border-ember-400/40 px-2 py-1 text-xs text-ember-400" onClick={() => setAllyPick(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Current hero's actions */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button className="gold-btn" disabled={off} onClick={() => onAttack(target)}>
          ⚔ Attack
        </button>

        {hero?.abilityIds.map((id) => {
          const a = ABILITIES[id];
          if (!a) return null;
          const cd = cooldowns[id] ?? 0;
          const tooExpensive = hero.mp < a.mpCost;
          const usedToday = !!a.dayCooldown && state.dailyUsed[`${seat}:${id}`] === state.time.day;
          return (
            <button
              key={id}
              className="ghost-btn flex-col !items-start !py-1.5 text-left"
              disabled={off || cd > 0 || tooExpensive || usedToday}
              title={a.desc}
              onClick={() => (a.target === "ally" ? setAllyPick(id) : onAbility(id, target))}
            >
              <span className="text-sm">
                {a.name}
                {(hero.skill[id]?.rank ?? 1) > 1 && <span className="ml-1 text-[9px] text-gold-300">{"★".repeat(hero.skill[id]?.rank ?? 1)}</span>}
              </span>
              <span className="text-[10px] text-arcane-400/80">
                {a.mpCost} Weave{cd > 0 ? ` · CD ${cd}` : ""}{usedToday ? " · used today" : a.dayCooldown ? " · 1/day" : ""}
              </span>
            </button>
          );
        })}

        {Object.entries(potions).map(([id, qty]) => (
          <button
            key={id}
            className="ghost-btn flex-col !items-start !py-1.5 text-left"
            disabled={off}
            title={ITEMS[id].desc}
            onClick={() => onItem(id)}
          >
            <span className="text-sm">{ITEMS[id].name}</span>
            <span className="text-[10px] text-moss-400">×{qty}</span>
          </button>
        ))}

        <button className="ghost-btn" disabled={off} onClick={onDefend} title="Brace: +4 AC and halved damage until your next turn">
          🛡 Defend
        </button>

        <button className="ghost-btn !border-ember-400/30 text-ember-400" disabled={off} onClick={onFlee}>
          🏃 Flee
        </button>
      </div>
    </div>
  );
}
