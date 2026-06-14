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
import { roll, rollDice, rollRange, abilityMod, chance } from "./dice";

function aliveEnemies(state: GameState): Enemy[] {
  return state.combat ? state.combat.enemies.filter((e) => e.hp > 0) : [];
}

// Resolve a target index to a living enemy, falling back to the first one alive.
function resolveTarget(state: GameState, idx: number): number {
  if (!state.combat) return -1;
  const chosen = state.combat.enemies[idx];
  if (chosen && chosen.hp > 0) return idx;
  return state.combat.enemies.findIndex((e) => e.hp > 0);
}

function buffValue(state: GameState, stat: "ac" | "attack"): number {
  if (!state.combat) return 0;
  return state.combat.buffs
    .filter((b) => b.stat === stat)
    .reduce((sum, b) => sum + b.amount, 0);
}

function raceArmorBonus(char: Character): number {
  return char.race === "dwarf" ? 2 : 0;
}

function effectiveAc(state: GameState): number {
  return armorClass(state.character) + buffValue(state, "ac") + raceArmorBonus(state.character);
}

// ── Player actions ──

export function playerAttack(state: GameState, targetIdx: number): void {
  if (!state.combat) return;
  const idx = resolveTarget(state, targetIdx);
  if (idx < 0) return;
  const enemy = state.combat.enemies[idx];

  const atk = attackBonus(state.character) + buffValue(state, "attack");
  let d20 = roll(20);
  const char = state.character;

  // Halfling luck: one reroll of a missed attack per battle.
  if (
    char.race === "halfling" &&
    !state.combat.cooldowns["__luck_used"] &&
    d20 + atk < enemy.ac &&
    d20 < 20
  ) {
    const reroll = roll(20);
    if (reroll > d20) {
      addLog(state, "roll", `Halfling Luck — rerolled the strike.`);
      d20 = reroll;
    }
    state.combat.cooldowns["__luck_used"] = 1;
  }

  const total = d20 + atk;
  if (d20 === 1) {
    addLog(state, "combat", `You swing at the ${enemy.name} and miss wildly. (rolled 1)`);
  } else if (d20 === 20 || total >= enemy.ac) {
    const dmg = weaponDamageRoll(char);
    let amount = dmg.amount;
    if (d20 === 20) amount = Math.round(amount * 1.8);
    // Orc savagery
    if (char.race === "orc" && char.hp < char.maxHp / 2) amount += 2;
    enemy.hp = Math.max(0, enemy.hp - amount);
    const critTag = d20 === 20 ? " A critical hit!" : "";
    addLog(state, "combat", `You strike the ${enemy.name} for ${amount} damage.${critTag}`);
  } else {
    addLog(state, "combat", `Your blow glances off the ${enemy.name}. (${total} vs AC ${enemy.ac})`);
  }

  afterPlayerAction(state);
}

export function playerAbility(state: GameState, abilityId: string, targetIdx: number): boolean {
  if (!state.combat) return false;
  const ability = getAbility(abilityId);
  const char = state.character;

  if (char.mp < ability.mpCost) {
    addLog(state, "system", `Not enough Weave for ${ability.name}.`);
    return false;
  }
  if ((state.combat.cooldowns[abilityId] ?? 0) > 0) {
    addLog(state, "system", `${ability.name} is still recovering.`);
    return false;
  }

  char.mp -= ability.mpCost;
  state.combat.cooldowns[abilityId] = ability.cooldown + 1; // +1 so it ticks down this turn

  const scaleMod = ability.scalesWith ? Math.max(0, abilityMod(char.abilities[ability.scalesWith])) : 0;
  const eff = ability.effect;

  if (eff.type === "heal") {
    const amt = eff.amount;
    char.hp = Math.min(char.maxHp, char.hp + amt);
    addLog(state, "combat", `${ability.name} mends ${amt} HP.`);
  } else if (eff.type === "buff") {
    state.combat.buffs.push({ stat: eff.stat, amount: eff.amount, turns: eff.turns + 1 });
    addLog(state, "combat", `${ability.name} — ${eff.stat === "ac" ? "armor" : "attack"} raised by ${eff.amount}.`);
  } else if (eff.type === "damage") {
    const single = resolveTarget(state, targetIdx);
    const targets =
      ability.target === "all-enemies"
        ? aliveEnemies(state)
        : single >= 0
          ? [state.combat.enemies[single]]
          : [];
    for (const t of targets) {
      const dmg = rollDice(eff.dice[0], eff.dice[1]) + scaleMod;
      t.hp = Math.max(0, t.hp - dmg);
      const elem = eff.element ? ` ${eff.element}` : "";
      addLog(state, "combat", `${ability.name} hits the ${t.name} for ${dmg}${elem} damage.`);
    }
  } else if (eff.type === "drain") {
    const di = resolveTarget(state, targetIdx);
    const t = di >= 0 ? state.combat.enemies[di] : undefined;
    if (t && t.hp > 0) {
      t.hp = Math.max(0, t.hp - eff.amount);
      char.hp = Math.min(char.maxHp, char.hp + Math.floor(eff.amount / 2));
      addLog(state, "combat", `${ability.name} drains ${eff.amount} from the ${t.name}.`);
    }
  }

  afterPlayerAction(state);
  return true;
}

export function playerUseItem(state: GameState, itemId: string): boolean {
  if (!state.combat) return false;
  const item = getItem(itemId);
  if (!hasItem(state.character, itemId)) return false;
  if (item.kind !== "potion") return false;

  if (item.heal) {
    state.character.hp = Math.min(state.character.maxHp, state.character.hp + item.heal);
    addLog(state, "combat", `You drink the ${item.name} and recover ${item.heal} HP.`);
  }
  if (item.restoreMp) {
    state.character.mp = Math.min(state.character.maxMp, state.character.mp + item.restoreMp);
    addLog(state, "combat", `The ${item.name} restores ${item.restoreMp} Weave.`);
  }
  removeFromInventory(state.character.inventory, itemId, 1);

  afterPlayerAction(state);
  return true;
}

export function playerFlee(state: GameState): boolean {
  if (!state.combat) return false;
  const dexMod = abilityMod(state.character.abilities.dex);
  const r = roll(20) + dexMod;
  addLog(state, "roll", `Flee check: d20+${dexMod} = ${r} (need 11).`);
  if (r >= 11) {
    addLog(state, "system", "You break away and escape!");
    const flee = state.combat.fleeSceneId ?? state.combat.returnSceneId;
    endCombat(state);
    state.phase = "exploring";
    state.sceneId = flee;
    state.flags["__entered_" + flee] = false; // allow re-narration of flee scene
    return true;
  }
  addLog(state, "system", "You can't break away!");
  enemyTurn(state);
  return false;
}

// ── Turn flow ──

function afterPlayerAction(state: GameState): void {
  if (!state.combat) return;
  if (aliveEnemies(state).length === 0) {
    winCombat(state);
    return;
  }
  enemyTurn(state);
}

function enemyTurn(state: GameState): void {
  if (!state.combat) return;
  const ac = effectiveAc(state);

  for (const enemy of aliveEnemies(state)) {
    const d20 = roll(20);
    const total = d20 + enemy.attack;
    if (d20 === 1) {
      addLog(state, "combat", `The ${enemy.name} stumbles and misses.`);
    } else if (d20 === 20 || total >= ac) {
      let dmg = rollDice(enemy.damage[0], enemy.damage[1]) + enemy.damageBonus;
      if (d20 === 20) dmg = Math.round(dmg * 1.5);
      state.character.hp = Math.max(0, state.character.hp - dmg);
      const critTag = d20 === 20 ? " A brutal critical!" : "";
      addLog(state, "combat", `The ${enemy.name} hits you for ${dmg} damage.${critTag}`);
    } else {
      addLog(state, "combat", `The ${enemy.name} attacks — you turn it aside. (${total} vs AC ${ac})`);
    }
    if (state.character.hp <= 0) {
      loseCombat(state);
      return;
    }
  }

  tickTurn(state);
}

function tickTurn(state: GameState): void {
  if (!state.combat) return;
  state.combat.turn += 1;
  for (const k of Object.keys(state.combat.cooldowns)) {
    if (k.startsWith("__")) continue;
    state.combat.cooldowns[k] = Math.max(0, state.combat.cooldowns[k] - 1);
  }
  state.combat.buffs = state.combat.buffs
    .map((b) => ({ ...b, turns: b.turns - 1 }))
    .filter((b) => b.turns > 0);
  // Passive Weave regeneration in battle.
  if (state.character.mp < state.character.maxMp) {
    state.character.mp = Math.min(state.character.maxMp, state.character.mp + 1);
  }
}

// ── Resolution ──

function winCombat(state: GameState): void {
  if (!state.combat) return;
  const char = state.character;
  let totalXp = 0;
  let totalGold = 0;
  const loot: string[] = [];

  for (const enemy of state.combat.enemies) {
    totalXp += enemy.xp;
    totalGold += rollRange(enemy.goldDrop);
    if (enemy.lootTable) {
      for (const drop of enemy.lootTable) {
        if (chance(drop.chance)) {
          addToInventory(char.inventory, drop.itemId, 1);
          loot.push(getItem(drop.itemId).name);
        }
      }
    }
  }

  char.gold += totalGold;
  addLog(state, "system", "The last foe falls. Silence returns to the realm.");
  if (totalGold > 0) addLog(state, "loot", `You gather ${totalGold} gold.`);
  if (loot.length) addLog(state, "loot", `Found: ${loot.join(", ")}.`);

  const result = grantXp(char, totalXp);
  addLog(state, "system", `You gain ${Math.round(totalXp * (char.race === "human" ? 1.1 : 1))} experience.`);
  if (result.leveled) {
    addLog(state, "level", `⚜ You reach level ${result.newLevel}! Your wounds close (HP & Weave restored).`);
    if (result.newAbility) {
      addLog(state, "level", `You have learned a new ability: ${getAbility(result.newAbility).name}.`);
    }
  }

  const returnScene = state.combat.returnSceneId;
  endCombat(state);
  state.phase = "exploring";
  state.sceneId = returnScene;
  // Let the destination scene re-narrate if it wants to react to the victory.
  state.flags["__entered_" + returnScene] = false;
}

function loseCombat(state: GameState): void {
  addLog(state, "system", "Darkness takes you. Your legend ends here... for now.");
  endCombat(state);
  state.phase = "gameover";
}

export function endCombat(state: GameState): void {
  state.combat = null;
}
