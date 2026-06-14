import type { GameState, Enemy, Character, StatusEffect, EnemyAbility } from "./types";
import { addLog } from "./util";
import {
  armorClass,
  attackBonus,
  weaponDamageRoll,
  removeFromInventory,
  addToInventory,
  grantXp,
  hasItem,
  equippedMods,
  effectiveMaxHp,
  effectiveMaxMp,
} from "./character";
import { getItem, getAbility } from "./content";
import { rollGear } from "./loot";
import { roll, rollDice, rollRange, abilityMod, chance, pick } from "./dice";

const EQUIP_KINDS = new Set(["weapon", "armor", "ring", "amulet"]);
function heroPerks(state: GameState, seat: number): string[] {
  return equippedMods(state.party[seat], state.gear).perks;
}

// ── Selectors ──

function aliveEnemies(state: GameState): Enemy[] {
  return state.combat ? state.combat.enemies.filter((e) => e.hp > 0) : [];
}

function livingAllySeats(state: GameState): number[] {
  return state.party.map((c, i) => (c.hp > 0 ? i : -1)).filter((i) => i >= 0);
}

// Seat of the hero whose turn it is in the player phase, or -1 if the phase is
// over. Stunned heroes are skipped for the round.
export function currentAllySeat(state: GameState): number {
  if (!state.combat) return -1;
  for (let i = 0; i < state.party.length; i++) {
    if (state.party[i].hp > 0 && !state.combat.acted.includes(i) && !allyStunned(state, i)) return i;
  }
  return -1;
}

// ── Status effect helpers ──

function allyStatusList(state: GameState, seat: number): StatusEffect[] {
  if (!state.combat) return [];
  return (state.combat.statuses[seat] ??= []);
}
function allyStunned(state: GameState, seat: number): boolean {
  return allyStatusList(state, seat).some((s) => s.type === "stun" && s.turns > 0);
}
function allyDefending(state: GameState, seat: number): boolean {
  return allyStatusList(state, seat).some((s) => s.type === "defend" && s.turns > 0);
}
function enemyStunned(e: Enemy): boolean {
  return (e.statuses ?? []).some((s) => s.type === "stun" && s.turns > 0);
}
// Add/refresh a status on a list (same-type effects refresh rather than stack).
function applyStatus(list: StatusEffect[], eff: StatusEffect): void {
  const existing = list.find((s) => s.type === eff.type);
  if (existing) {
    existing.turns = Math.max(existing.turns, eff.turns);
    existing.magnitude = Math.max(existing.magnitude, eff.magnitude);
  } else {
    list.push({ ...eff });
  }
}
const STATUS_LABEL: Record<string, string> = {
  poison: "poison", burn: "burns", bleed: "bleeds", stun: "is stunned", regen: "regenerates", defend: "braces",
};

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
  const defend = allyDefending(state, seat) ? 4 : 0;
  return armorClass(c, state.gear) + buffValue(state, seat, "ac") + raceArmorBonus(c) + defend;
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

  const perks = heroPerks(state, seat);
  const atk = attackBonus(char, state.gear) + buffValue(state, seat, "attack");
  let d20 = roll(20);

  // One reroll of a missed attack per battle (Halfling trait or the Lucky perk).
  if (
    (char.race === "halfling" || perks.includes("lucky")) &&
    !state.combat.luckUsed[seat] &&
    d20 + atk < enemy.ac &&
    d20 < 20
  ) {
    const reroll = roll(20);
    if (reroll > d20) {
      addLog(state, "roll", `${name}'s luck turns — the strike is rerolled.`);
      d20 = reroll;
    }
    state.combat.luckUsed[seat] = true;
  }

  const critRoll = perks.includes("keen") ? 19 : 20; // Keen perk widens crit range
  const total = d20 + atk;
  if (d20 === 1) {
    addLog(state, "combat", `${name} swings at the ${enemy.name} and misses wildly. (rolled 1)`);
  } else if (d20 >= critRoll || total >= enemy.ac) {
    const isCrit = d20 >= critRoll;
    let amount = weaponDamageRoll(char, state.gear).amount;
    if (isCrit) amount = Math.round(amount * 1.8);
    if (char.race === "orc" && char.hp < char.maxHp / 2) amount += 2;
    enemy.hp = Math.max(0, enemy.hp - amount);
    addLog(state, "combat", `${name} strikes the ${enemy.name} for ${amount} damage.${isCrit ? " A critical hit!" : ""}`);
    if (perks.includes("vampiric")) {
      const drain = Math.max(1, Math.ceil(amount * 0.2));
      char.hp = Math.min(effectiveMaxHp(char, state.gear), char.hp + drain);
      addLog(state, "combat", `${name}'s vampiric weapon drinks ${drain} HP.`);
    }
    if (perks.includes("flaming") && enemy.hp > 0) {
      enemy.statuses ??= [];
      applyStatus(enemy.statuses, { type: "burn", turns: 2, magnitude: 3 });
      addLog(state, "combat", `The ${enemy.name} is set alight!`);
    }
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

  // Heal/revive can target self or a chosen ally seat (targetIdx).
  const allySeat = ability.target === "ally" ? targetIdx : seat;

  if (eff.type === "heal") {
    const t = state.party[allySeat] ?? char;
    t.hp = Math.min(effectiveMaxHp(t, state.gear), t.hp + eff.amount);
    addLog(state, "combat", `${ability.name} mends ${who(state, allySeat)} for ${eff.amount} HP.`);
  } else if (eff.type === "revive") {
    const t = state.party[allySeat];
    if (!t || t.hp > 0) {
      addLog(state, "system", `${ability.name} needs a fallen ally to target.`);
      // Refund the cast — nothing to revive.
      char.mp += ability.mpCost;
      cds[abilityId] = 0;
      return false;
    }
    t.downed = false;
    t.hp = Math.min(effectiveMaxHp(t, state.gear), eff.amount);
    addLog(state, "level", `✦ ${name} raises ${who(state, allySeat)} from the brink! (${t.hp} HP)`);
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
      if (eff.applies && t.hp > 0) {
        t.statuses ??= [];
        applyStatus(t.statuses, eff.applies);
        addLog(state, "combat", `The ${t.name} ${STATUS_LABEL[eff.applies.type] ?? eff.applies.type}!`);
      }
    }
  } else if (eff.type === "drain") {
    const di = resolveTarget(state, targetIdx);
    const t = di >= 0 ? state.combat.enemies[di] : undefined;
    if (t && t.hp > 0) {
      t.hp = Math.max(0, t.hp - eff.amount);
      char.hp = Math.min(effectiveMaxHp(char, state.gear), char.hp + Math.floor(eff.amount / 2));
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

  // Revivify Salts: bring back the first downed ally instead of healing.
  if (itemId === "revive_kit") {
    const downed = state.party.findIndex((c) => c.hp <= 0);
    if (downed < 0) {
      addLog(state, "system", "No fallen ally to revive.");
      return false;
    }
    const t = state.party[downed];
    t.downed = false;
    t.hp = Math.max(1, Math.round(effectiveMaxHp(t, state.gear) * 0.25));
    removeFromInventory(state.inventory, itemId, 1);
    addLog(state, "level", `✦ ${name} uses ${item.name} — ${who(state, downed)} staggers back up! (${t.hp} HP)`);
    afterAllyAction(state, seat);
    return true;
  }

  if (item.heal) {
    char.hp = Math.min(effectiveMaxHp(char, state.gear), char.hp + item.heal);
    addLog(state, "combat", `${name} drinks the ${item.name} (+${item.heal} HP).`);
  }
  if (item.restoreMp) {
    char.mp = Math.min(effectiveMaxMp(char, state.gear), char.mp + item.restoreMp);
    addLog(state, "combat", `${name} drinks the ${item.name} (+${item.restoreMp} Weave).`);
  }
  removeFromInventory(state.inventory, itemId, 1);

  afterAllyAction(state, seat);
  return true;
}

export function playerDefend(state: GameState): boolean {
  if (!state.combat) return false;
  const seat = currentAllySeat(state);
  if (seat < 0) return false;
  applyStatus(allyStatusList(state, seat), { type: "defend", turns: 2, magnitude: 0 });
  addLog(state, "combat", `${who(state, seat)} braces — raising guard (+4 AC, halved damage).`);
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

// Deal damage to a hero, applying Defend mitigation and knockout.
function damageAlly(state: GameState, seat: number, raw: number): number {
  const t = state.party[seat];
  let dmg = raw;
  if (allyDefending(state, seat)) dmg = Math.ceil(dmg / 2);
  t.hp = Math.max(0, t.hp - dmg);
  if (t.hp <= 0 && !t.downed) {
    t.downed = true;
    addLog(state, "combat", `${who(state, seat)} is knocked out!`);
  }
  return dmg;
}

// Damage-over-time on enemies; returns true if it wiped them out.
function tickEnemyStatuses(state: GameState): boolean {
  if (!state.combat) return false;
  for (const e of state.combat.enemies) {
    if (e.hp <= 0 || !e.statuses) continue;
    for (const s of e.statuses) {
      if (s.turns > 0 && (s.type === "poison" || s.type === "burn" || s.type === "bleed")) {
        e.hp = Math.max(0, e.hp - s.magnitude);
        addLog(state, "combat", `The ${e.name} takes ${s.magnitude} ${s.type} damage.`);
      }
    }
    e.statuses = e.statuses.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  }
  return aliveEnemies(state).length === 0;
}

// Try to use one of an enemy's special abilities; returns true if it acted.
function tryEnemyAbility(state: GameState, enemy: Enemy): boolean {
  if (!enemy.abilities) return false;
  for (const ab of enemy.abilities) {
    if (!chance(ab.chance)) continue;
    if (ab.kind === "heal") {
      enemy.hp = Math.min(enemy.maxHp, enemy.hp + ab.amount);
      addLog(state, "combat", `The ${enemy.name} uses ${ab.name}, mending ${ab.amount} HP.`);
      return true;
    }
    if (ab.kind === "aoe") {
      addLog(state, "combat", `The ${enemy.name} uses ${ab.name} — it strikes the whole party!`);
      for (const seat of livingAllySeats(state)) {
        const dmg = damageAlly(state, seat, rollDice(ab.dice[0], ab.dice[1]) + ab.bonus);
        addLog(state, "combat", `${who(state, seat)} takes ${dmg} damage.`);
      }
      return true;
    }
    if (ab.kind === "heavy") {
      const seat = pick(livingAllySeats(state));
      const dmg = damageAlly(state, seat, rollDice(ab.dice[0], ab.dice[1]) + ab.bonus);
      addLog(state, "combat", `The ${enemy.name} uses ${ab.name} on ${who(state, seat)} for ${dmg} damage!`);
      if (ab.lifesteal) {
        enemy.hp = Math.min(enemy.maxHp, enemy.hp + Math.floor(dmg / 2));
        addLog(state, "combat", `The ${enemy.name} drains the life, healing ${Math.floor(dmg / 2)}.`);
      }
      return true;
    }
    if (ab.kind === "status") {
      const seat = pick(livingAllySeats(state));
      applyStatus(allyStatusList(state, seat), { type: ab.status, turns: ab.turns, magnitude: ab.magnitude });
      addLog(state, "combat", `The ${enemy.name} uses ${ab.name} — ${who(state, seat)} ${STATUS_LABEL[ab.status] ?? ab.status}!`);
      return true;
    }
  }
  return false;
}

function enemyPhase(state: GameState): void {
  if (!state.combat) return;
  // Damage-over-time ticks on enemies before they act.
  if (tickEnemyStatuses(state)) {
    winCombat(state);
    return;
  }

  for (const enemy of aliveEnemies(state)) {
    const seats = livingAllySeats(state);
    if (seats.length === 0) break;
    if (enemyStunned(enemy)) {
      addLog(state, "combat", `The ${enemy.name} is stunned and reels.`);
      continue;
    }
    // Bosses & elites may use a signature ability instead of a basic attack.
    if (tryEnemyAbility(state, enemy)) continue;

    const seat = pick(seats);
    const ac = effectiveAc(state, seat);
    const d20 = roll(20);
    const total = d20 + enemy.attack;
    const tname = who(state, seat);

    if (d20 === 1) {
      addLog(state, "combat", `The ${enemy.name} stumbles and misses ${tname}.`);
    } else if (d20 === 20 || total >= ac) {
      let raw = rollDice(enemy.damage[0], enemy.damage[1]) + enemy.damageBonus;
      if (d20 === 20) raw = Math.round(raw * 1.5);
      const dmg = damageAlly(state, seat, raw);
      addLog(state, "combat", `The ${enemy.name} hits ${tname} for ${dmg} damage.${d20 === 20 ? " A brutal critical!" : ""}`);
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
  // Tick ally status effects (DoT, regen) and decrement durations.
  for (const seat of livingAllySeats(state)) {
    const c = state.party[seat];
    const list = allyStatusList(state, seat);
    for (const s of list) {
      if (s.turns <= 0) continue;
      if (s.type === "poison" || s.type === "burn" || s.type === "bleed") {
        c.hp = Math.max(0, c.hp - s.magnitude);
        addLog(state, "combat", `${who(state, seat)} takes ${s.magnitude} ${s.type} damage.`);
      } else if (s.type === "regen") {
        const maxHp = effectiveMaxHp(c, state.gear);
        c.hp = Math.min(maxHp, c.hp + s.magnitude);
      }
    }
    if (c.hp <= 0 && !c.downed) {
      c.downed = true;
      addLog(state, "combat", `${who(state, seat)} succumbs!`);
    }
    state.combat.statuses[seat] = list.map((s) => ({ ...s, turns: s.turns - 1 })).filter((s) => s.turns > 0);
  }
  if (livingAllySeats(state).length === 0) {
    loseCombat(state);
    return;
  }

  // Passive Weave regen + Regenerating perk for living heroes.
  for (const seat of livingAllySeats(state)) {
    const c = state.party[seat];
    const maxMp = effectiveMaxMp(c, state.gear);
    if (c.mp < maxMp) c.mp = Math.min(maxMp, c.mp + 1);
    if (heroPerks(state, seat).includes("regen")) {
      const maxHp = effectiveMaxHp(c, state.gear);
      if (c.hp < maxHp) {
        c.hp = Math.min(maxHp, c.hp + 2);
        addLog(state, "combat", `${who(state, seat)}'s gear regenerates 2 HP.`);
      }
    }
  }

  // If every living hero is stunned, the enemies press their advantage again.
  if (aliveEnemies(state).length > 0 && livingAllySeats(state).length > 0 && currentAllySeat(state) < 0) {
    enemyPhase(state);
  }
}

// ── Resolution ──

function reviveParty(state: GameState): void {
  for (const c of state.party) {
    c.downed = false;
    if (c.hp <= 0) c.hp = Math.max(1, Math.round(effectiveMaxHp(c, state.gear) * 0.25));
  }
}

function winCombat(state: GameState): void {
  if (!state.combat) return;
  let totalXp = 0;
  let totalGold = 0;
  const loot: string[] = [];
  const hasLumen = hasItem(state.inventory, "lumen_charm");

  let topTier = 0;
  for (const enemy of state.combat.enemies) {
    totalXp += enemy.xp;
    totalGold += rollRange(enemy.goldDrop);
    const tier = Math.min(5, Math.floor(enemy.xp / 45)); // tougher foes → better drops
    topTier = Math.max(topTier, tier);
    if (enemy.lootTable) {
      for (const drop of enemy.lootTable) {
        if (chance(drop.chance)) {
          if (EQUIP_KINDS.has(getItem(drop.itemId).kind)) {
            const inst = rollGear(drop.itemId, { tier });
            state.gear.push(inst);
            loot.push(inst.name);
          } else {
            addToInventory(state.inventory, drop.itemId, 1);
            loot.push(getItem(drop.itemId).name);
          }
        }
      }
    }
  }
  // Tougher fights have a chance to drop a bonus enchanted accessory.
  if (topTier >= 2 && chance(0.18 + topTier * 0.04)) {
    const acc = rollGear(chance(0.5) ? "ring" : "amulet", { tier: topTier });
    state.gear.push(acc);
    loot.push(acc.name);
  }

  state.gold += totalGold;
  addLog(state, "system", "The last foe falls.");
  if (totalGold > 0) addLog(state, "loot", `The party gathers ${totalGold} gold.`);
  if (loot.length) addLog(state, "loot", `Found: ${loot.join(", ")}.`);

  // Award XP to every hero who is still standing (downed heroes miss out).
  for (let seat = 0; seat < state.party.length; seat++) {
    const c = state.party[seat];
    if (c.hp <= 0) continue;
    const r = grantXp(c, totalXp, hasLumen, state.gear);
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
