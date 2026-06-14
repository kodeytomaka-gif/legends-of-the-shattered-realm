import type { GameState, Enemy, Character } from "./types";
import { addLog } from "./util";
import {
  armorClass,
  attackBonus,
  weaponDamageRoll,
  removeFromInventory,
  addToInventory,
  grantXp,
  hasItem,
} from "./character";
import { getItem, getAbility } from "./content";
import { roll, rollDice, rollRange, abilityMod, chance, pick } from "./dice";

// ── Selectors ──

function aliveEnemies(state: GameState): Enemy[] {
  return state.combat ? state.combat.enemies.filter((e) => e.hp > 0) : [];
}

function livingAllySeats(state: GameState): number[] {
  return state.party.map((c, i) => (c.hp > 0 ? i : -1)).filter((i) => i >= 0);
}

// Seat of the hero whose turn it is in the player phase, or -1 if the phase is over.
export function currentAllySeat(state: GameState): number {
  if (!state.combat) return -1;
  for (let i = 0; i < state.party.length; i++) {
    if (state.party[i].hp > 0 && !state.combat.acted.includes(i)) return i;
  }
  return -1;
}

function resolveTarget(state: GameState, idx: number): number {
  if (!state.combat) return -1;
  const chosen = state.combat.enemies[idx];
  if (chosen && chosen.hp > 0) return idx;
  return state.combat.enemies.findIndex((e) => e.hp > 0);
}

function buffValue(state: GameState, seat: number, stat: "ac" | "attack"): number {
  const list = state.combat?.buffs[seat] ?? [];
  return list.filter((b) => b.stat === stat).reduce((s, b) => s + b.amount, 0);
}

function raceArmorBonus(char: Character): number {
  return char.race === "dwarf" ? 2 : 0;
}

function effectiveAc(state: GameState, seat: number): number {
  const c = state.party[seat];
  return armorClass(c) + buffValue(state, seat, "ac") + raceArmorBonus(c);
}

function who(state: GameState, seat: number): string {
  return state.party.length > 1 ? state.party[seat].name : "You";
}

// ── Player (hero) actions — always act as the current-seat hero ──

export function playerAttack(state: GameState, targetIdx: number): void {
  if (!state.combat) return;
  const seat = currentAllySeat(state);
  if (seat < 0) return;
  const idx = resolveTarget(state, targetIdx);
  if (idx < 0) return;
  const enemy = state.combat.enemies[idx];
  const char = state.party[seat];
  const name = who(state, seat);

  const atk = attackBonus(char) + buffValue(state, seat, "attack");
  let d20 = roll(20);

  // Halfling luck: one reroll of a missed attack per battle, per hero.
  if (
    char.race === "halfling" &&
    !state.combat.luckUsed[seat] &&
    d20 + atk < enemy.ac &&
    d20 < 20
  ) {
    const reroll = roll(20);
    if (reroll > d20) {
      addLog(state, "roll", `${name}'s Halfling Luck — rerolled the strike.`);
      d20 = reroll;
    }
    state.combat.luckUsed[seat] = true;
  }

  const total = d20 + atk;
  if (d20 === 1) {
    addLog(state, "combat", `${name} swings at the ${enemy.name} and misses wildly. (rolled 1)`);
  } else if (d20 === 20 || total >= enemy.ac) {
    let amount = weaponDamageRoll(char).amount;
    if (d20 === 20) amount = Math.round(amount * 1.8);
    if (char.race === "orc" && char.hp < char.maxHp / 2) amount += 2;
    enemy.hp = Math.max(0, enemy.hp - amount);
    addLog(state, "combat", `${name} strikes the ${enemy.name} for ${amount} damage.${d20 === 20 ? " A critical hit!" : ""}`);
  } else {
    addLog(state, "combat", `${name}'s blow glances off the ${enemy.name}. (${total} vs AC ${enemy.ac})`);
  }

  afterAllyAction(state, seat);
}

export function playerAbility(state: GameState, abilityId: string, targetIdx: number): boolean {
  if (!state.combat) return false;
  const seat = currentAllySeat(state);
  if (seat < 0) return false;
  const ability = getAbility(abilityId);
  const char = state.party[seat];
  const name = who(state, seat);
  const cds = (state.combat.cooldowns[seat] ??= {});

  if (!char.abilityIds.includes(abilityId)) return false;
  if (char.mp < ability.mpCost) {
    addLog(state, "system", `${name} hasn't the Weave for ${ability.name}.`);
    return false;
  }
  if ((cds[abilityId] ?? 0) > 0) {
    addLog(state, "system", `${ability.name} is still recovering.`);
    return false;
  }

  char.mp -= ability.mpCost;
  cds[abilityId] = ability.cooldown + 1;

  const scaleMod = ability.scalesWith ? Math.max(0, abilityMod(char.abilities[ability.scalesWith])) : 0;
  const eff = ability.effect;

  if (eff.type === "heal") {
    char.hp = Math.min(char.maxHp, char.hp + eff.amount);
    addLog(state, "combat", `${ability.name} mends ${name} for ${eff.amount} HP.`);
  } else if (eff.type === "buff") {
    (state.combat.buffs[seat] ??= []).push({ stat: eff.stat, amount: eff.amount, turns: eff.turns + 1 });
    addLog(state, "combat", `${name} uses ${ability.name} — ${eff.stat === "ac" ? "armor" : "attack"} +${eff.amount}.`);
  } else if (eff.type === "damage") {
    const single = resolveTarget(state, targetIdx);
    const targets = ability.target === "all-enemies" ? aliveEnemies(state) : single >= 0 ? [state.combat.enemies[single]] : [];
    for (const t of targets) {
      const dmg = rollDice(eff.dice[0], eff.dice[1]) + scaleMod;
      t.hp = Math.max(0, t.hp - dmg);
      addLog(state, "combat", `${name}'s ${ability.name} hits the ${t.name} for ${dmg}${eff.element ? ` ${eff.element}` : ""} damage.`);
    }
  } else if (eff.type === "drain") {
    const di = resolveTarget(state, targetIdx);
    const t = di >= 0 ? state.combat.enemies[di] : undefined;
    if (t && t.hp > 0) {
      t.hp = Math.max(0, t.hp - eff.amount);
      char.hp = Math.min(char.maxHp, char.hp + Math.floor(eff.amount / 2));
      addLog(state, "combat", `${name}'s ${ability.name} drains ${eff.amount} from the ${t.name}.`);
    }
  }

  afterAllyAction(state, seat);
  return true;
}

export function playerUseItem(state: GameState, itemId: string): boolean {
  if (!state.combat) return false;
  const seat = currentAllySeat(state);
  if (seat < 0) return false;
  const item = getItem(itemId);
  if (!hasItem(state.inventory, itemId) || item.kind !== "potion") return false;
  const char = state.party[seat];
  const name = who(state, seat);

  if (item.heal) {
    char.hp = Math.min(char.maxHp, char.hp + item.heal);
    addLog(state, "combat", `${name} drinks the ${item.name} (+${item.heal} HP).`);
  }
  if (item.restoreMp) {
    char.mp = Math.min(char.maxMp, char.mp + item.restoreMp);
    addLog(state, "combat", `${name} drinks the ${item.name} (+${item.restoreMp} Weave).`);
  }
  removeFromInventory(state.inventory, itemId, 1);

  afterAllyAction(state, seat);
  return true;
}

export function playerFlee(state: GameState): boolean {
  if (!state.combat) return false;
  const seat = currentAllySeat(state);
  if (seat < 0) return false;
  const char = state.party[seat];
  const dexMod = abilityMod(char.abilities.dex);
  const d20 = roll(20);
  const r = d20 + dexMod;
  const fleeEntry = addLog(state, "roll", `${who(state, seat)} tries to flee: d20 (${d20})+${dexMod} = ${r} (need 11).`);
  fleeEntry.roll = { d20, mod: dexMod, total: r, dc: 11, success: r >= 11, crit: d20 === 20 ? "hit" : d20 === 1 ? "miss" : null, label: "Escape" };
  if (r >= 11) {
    addLog(state, "system", state.party.length > 1 ? "The party breaks away and escapes!" : "You break away and escape!");
    const flee = state.combat.fleeSceneId ?? state.combat.originSceneId;
    reviveParty(state);
    endCombat(state);
    state.phase = "exploring";
    state.sceneId = flee;
    state.flags["__entered_" + flee] = false;
    return true;
  }
  addLog(state, "system", "The escape fails!");
  // A failed flee still consumes the hero's action.
  afterAllyAction(state, seat);
  return false;
}

// ── Turn flow ──

function afterAllyAction(state: GameState, seat: number): void {
  if (!state.combat) return;
  if (!state.combat.acted.includes(seat)) state.combat.acted.push(seat);

  if (aliveEnemies(state).length === 0) {
    winCombat(state);
    return;
  }
  // If every living hero has acted, the enemies take their turn.
  if (currentAllySeat(state) < 0) {
    enemyPhase(state);
  }
}

function enemyPhase(state: GameState): void {
  if (!state.combat) return;
  for (const enemy of aliveEnemies(state)) {
    const seats = livingAllySeats(state);
    if (seats.length === 0) break;
    const seat = pick(seats);
    const target = state.party[seat];
    const ac = effectiveAc(state, seat);
    const d20 = roll(20);
    const total = d20 + enemy.attack;
    const tname = who(state, seat);

    if (d20 === 1) {
      addLog(state, "combat", `The ${enemy.name} stumbles and misses ${tname}.`);
    } else if (d20 === 20 || total >= ac) {
      let dmg = rollDice(enemy.damage[0], enemy.damage[1]) + enemy.damageBonus;
      if (d20 === 20) dmg = Math.round(dmg * 1.5);
      target.hp = Math.max(0, target.hp - dmg);
      addLog(state, "combat", `The ${enemy.name} hits ${tname} for ${dmg} damage.${d20 === 20 ? " A brutal critical!" : ""}`);
      if (target.hp <= 0) {
        target.downed = true;
        addLog(state, "combat", `${tname} is knocked out!`);
      }
    } else {
      addLog(state, "combat", `The ${enemy.name} attacks ${tname} — turned aside. (${total} vs AC ${ac})`);
    }
  }

  if (livingAllySeats(state).length === 0) {
    loseCombat(state);
    return;
  }
  endRound(state);
}

function endRound(state: GameState): void {
  if (!state.combat) return;
  state.combat.round += 1;
  state.combat.acted = [];
  for (const seatKey of Object.keys(state.combat.cooldowns)) {
    const cds = state.combat.cooldowns[Number(seatKey)];
    for (const k of Object.keys(cds)) cds[k] = Math.max(0, cds[k] - 1);
  }
  for (const seatKey of Object.keys(state.combat.buffs)) {
    const seat = Number(seatKey);
    state.combat.buffs[seat] = state.combat.buffs[seat]
      .map((b) => ({ ...b, turns: b.turns - 1 }))
      .filter((b) => b.turns > 0);
  }
  // Passive Weave regen for living heroes.
  for (const seat of livingAllySeats(state)) {
    const c = state.party[seat];
    if (c.mp < c.maxMp) c.mp = Math.min(c.maxMp, c.mp + 1);
  }
}

// ── Resolution ──

function reviveParty(state: GameState): void {
  for (const c of state.party) {
    c.downed = false;
    if (c.hp <= 0) c.hp = Math.max(1, Math.round(c.maxHp * 0.25));
  }
}

function winCombat(state: GameState): void {
  if (!state.combat) return;
  let totalXp = 0;
  let totalGold = 0;
  const loot: string[] = [];
  const hasLumen = hasItem(state.inventory, "lumen_charm");

  for (const enemy of state.combat.enemies) {
    totalXp += enemy.xp;
    totalGold += rollRange(enemy.goldDrop);
    if (enemy.lootTable) {
      for (const drop of enemy.lootTable) {
        if (chance(drop.chance)) {
          addToInventory(state.inventory, drop.itemId, 1);
          loot.push(getItem(drop.itemId).name);
        }
      }
    }
  }

  state.gold += totalGold;
  addLog(state, "system", "The last foe falls.");
  if (totalGold > 0) addLog(state, "loot", `The party gathers ${totalGold} gold.`);
  if (loot.length) addLog(state, "loot", `Found: ${loot.join(", ")}.`);

  // Award XP to every hero who is still standing (downed heroes miss out).
  for (let seat = 0; seat < state.party.length; seat++) {
    const c = state.party[seat];
    if (c.hp <= 0) continue;
    const r = grantXp(c, totalXp, hasLumen);
    if (r.leveled) {
      addLog(state, "level", `⚜ ${who(state, seat)} reaches level ${r.newLevel}! (HP & Weave restored)`);
      if (r.newAbility) addLog(state, "level", `${who(state, seat)} learned ${getAbility(r.newAbility).name}.`);
    }
  }
  addLog(state, "system", `Each survivor gains ${totalXp} experience.`);

  reviveParty(state);
  const returnScene = state.combat.returnSceneId;
  endCombat(state);
  state.phase = "exploring";
  state.sceneId = returnScene;
  state.flags["__entered_" + returnScene] = false;
}

function loseCombat(state: GameState): void {
  addLog(state, "system", state.party.length > 1 ? "The whole party has fallen. Your legend ends here... for now." : "Darkness takes you. Your legend ends here... for now.");
  endCombat(state);
  state.phase = "gameover";
}

export function endCombat(state: GameState): void {
  state.combat = null;
}
