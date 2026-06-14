import type { GameState, Character, AbilityKey, InventorySlot } from "./types";
import { ABILITY_NAMES } from "./types";
import type { SceneContext } from "./scene";
import { getScene, getCampaign, AI_ITEM_UNION, AI_ENEMY_UNION } from "./campaigns";
import { spawnEnemy } from "./enemies";
import {
  addToInventory,
  removeFromInventory,
  hasItem,
  grantXp,
  startingKit,
} from "./character";
import { abilityCheck, type CheckResult } from "./dice";
import { getAbility, ITEMS } from "./content";
import { addLog, clone } from "./util";
import {
  playerAttack,
  playerAbility,
  playerUseItem,
  playerFlee,
} from "./combat";
import type { AiAction, AiEffect } from "./dm";

export const SAVE_VERSION = 2;

export function newGame(party: Character[], campaignId = "shattered"): GameState {
  const campaign = getCampaign(campaignId);
  const heroes = party.length ? party : [];

  // Pool starting gold and non-equipped items into shared party resources.
  const inventory: InventorySlot[] = [];
  let gold = 0;
  for (const hero of heroes) {
    const kit = startingKit(hero.klass);
    gold += kit.gold;
    for (const id of kit.items) addToInventory(inventory, id, 1);
  }

  const state: GameState = {
    version: SAVE_VERSION,
    campaignId: campaign.id,
    phase: "exploring",
    party: heroes,
    gold,
    inventory,
    shards: 0,
    turnPlayer: 0,
    sceneId: campaign.startScene,
    visited: [],
    flags: {},
    log: [],
    combat: null,
    pendingChoiceLock: false,
  };
  const intro =
    heroes.length > 1
      ? `${heroes.map((h) => h.name).join(", ")} begin their legend together.`
      : `${heroes[0]?.name ?? "A hero"}'s legend begins.`;
  addLog(state, "system", intro);
  enterScene(state, campaign.startScene);
  return state;
}

// The hero currently making exploration decisions.
function activeHero(state: GameState) {
  return state.party[Math.min(state.turnPlayer, state.party.length - 1)] ?? state.party[0];
}

function livingSeats(state: GameState): number[] {
  return state.party.map((c, i) => (c.hp > 0 ? i : -1)).filter((i) => i >= 0);
}

// Pass exploration control to the next living hero (no-op for a solo party).
export function rotateTurn(state: GameState): void {
  const living = livingSeats(state);
  if (living.length <= 1) return;
  const after = living.find((s) => s > state.turnPlayer);
  state.turnPlayer = after ?? living[0];
}

// Builds the toolbox passed to scene/choice code. Mutates `state` directly.
function makeContext(state: GameState): SceneContext & { _navTarget: string | null } {
  const ctx: SceneContext & { _navTarget: string | null } = {
    state,
    _navTarget: null as string | null,
    log: (text: string) => {
      addLog(state, "dm", text);
    },
    say: (text: string) => {
      addLog(state, "system", text);
    },
    check: (ability: AbilityKey, dc: number, extra = 0): CheckResult => {
      const hero = activeHero(state);
      // Elf keen senses helps perception-style (wis) checks a touch.
      const elfBonus = hero.race === "elf" && ability === "wis" ? 2 : 0;
      const result = abilityCheck(hero.abilities, ability, dc, extra + elfBonus);
      const tag = state.party.length > 1 ? `${hero.name}: ` : "";
      const entry = addLog(
        state,
        "roll",
        `🎲 ${tag}d20 (${result.d20}) ${result.mod >= 0 ? "+" : ""}${result.mod} = ${result.total} vs DC ${dc} — ${
          result.success ? "SUCCESS" : "FAILURE"
        }${result.crit === "hit" ? " (natural 20!)" : result.crit === "miss" ? " (natural 1!)" : ""}`
      );
      entry.roll = {
        d20: result.d20,
        mod: result.mod,
        total: result.total,
        dc,
        success: result.success,
        crit: result.crit,
        label: ABILITY_NAMES[ability],
      };
      return result;
    },
    goto: (sceneId: string) => {
      ctx._navTarget = sceneId;
    },
    combat: (enemyIds, opts) => {
      // A hero killed by pre-combat effects can't then be thrown into a fight.
      if (state.phase === "gameover") return;
      const sc = opts.scale ?? 0;
      const enemies = enemyIds.map((id) => spawnEnemy(id, sc));
      state.combat = {
        enemies,
        round: 0,
        acted: [],
        cooldowns: {},
        buffs: {},
        luckUsed: {},
        originSceneId: state.sceneId,
        returnSceneId: opts.onWin,
        fleeSceneId: opts.onFlee,
      };
      state.phase = "combat";
      if (opts.intro) addLog(state, "narration", opts.intro);
      addLog(state, "combat", `⚔ Battle begins — ${enemies.map((e) => e.name).join(", ")}.`);
    },
    give: (itemId, qty = 1) => {
      addToInventory(state.inventory, itemId, qty);
    },
    take: (itemId, qty = 1) => removeFromInventory(state.inventory, itemId, qty),
    has: (itemId) => hasItem(state.inventory, itemId),
    gold: (delta) => {
      state.gold = Math.max(0, state.gold + delta);
    },
    heal: (amount) => {
      const hero = activeHero(state);
      hero.hp = Math.min(hero.maxHp, hero.hp + amount);
    },
    hurt: (amount) => {
      const hero = activeHero(state);
      hero.hp = Math.max(0, hero.hp - amount);
      if (hero.hp <= 0) hero.downed = true;
      if (livingSeats(state).length === 0) {
        addLog(state, "system", "The party has fallen...");
        state.phase = "gameover";
      }
    },
    restoreMp: (amount) => {
      const hero = activeHero(state);
      hero.mp = Math.min(hero.maxMp, hero.mp + amount);
    },
    restParty: () => {
      for (const c of state.party) {
        c.hp = c.maxHp;
        c.mp = c.maxMp;
        c.downed = false;
      }
    },
    addShard: () => {
      state.shards += 1;
    },
    xp: (amount) => {
      const hasLumen = hasItem(state.inventory, "lumen_charm");
      let leveledAny = false;
      for (const hero of state.party) {
        if (hero.hp <= 0) continue;
        const r = grantXp(hero, amount, hasLumen);
        if (r.leveled) {
          leveledAny = true;
          addLog(state, "level", `⚜ ${state.party.length > 1 ? hero.name : "You"} reach${state.party.length > 1 ? "es" : ""} level ${r.newLevel}!`);
          if (r.newAbility) addLog(state, "level", `Learned ${getAbility(r.newAbility).name}.`);
        }
      }
      addLog(state, "system", `${state.party.length > 1 ? "The party gains" : "You gain"} ${amount} experience.`);
      void leveledAny;
    },
    setFlag: (key, value = true) => {
      state.flags[key] = value;
    },
    getFlag: (key) => state.flags[key],
    bumpFlag: (key, by = 1) => {
      const cur = typeof state.flags[key] === "number" ? (state.flags[key] as number) : 0;
      state.flags[key] = cur + by;
      return cur + by;
    },
  };
  return ctx;
}

export function enterScene(state: GameState, id: string): void {
  state.sceneId = id;
  const scene = getScene(id);
  const enteredKey = "__entered_" + id;
  const firstTime = !state.flags[enteredKey];

  const text = scene.text(state);
  const lines = Array.isArray(text) ? text : [text];
  for (const line of lines) addLog(state, "dm", line);

  if (!state.visited.includes(id)) state.visited.push(id);

  if (firstTime) {
    state.flags[enteredKey] = true;
    if (scene.onEnter) {
      const ctx = makeContext(state);
      scene.onEnter(ctx);
      if (ctx._navTarget && ctx._navTarget !== id) {
        enterScene(state, ctx._navTarget);
      }
    }
  }
}

export function chooseOption(prev: GameState, choiceId: string): GameState {
  const state = clone(prev);
  if (state.phase !== "exploring") return state;

  const scene = getScene(state.sceneId);
  const choice = scene.choices(state).find((c) => c.id === choiceId);
  if (!choice) return state;
  if (choice.show && !choice.show(state)) return state;
  if (choice.enabled && !choice.enabled(state)) return state;

  // Echo the player's decision into the log.
  const label = typeof choice.label === "function" ? choice.label(state) : choice.label;
  addLog(state, "player", `➤ ${label}`);

  const ctx = makeContext(state);
  choice.run(ctx);

  if (state.phase === "exploring" && ctx._navTarget) {
    enterScene(state, ctx._navTarget);
    // Co-op: pass exploration control to the next hero on each new scene.
    rotateTurn(state);
  }

  return state;
}

// ── Combat action wrappers (clone + resolve + maybe re-narrate) ──

function resolveAfterCombat(state: GameState): void {
  // If combat ended in a win or flee, narrate the destination scene.
  if (state.phase === "exploring" && state.combat === null) {
    enterScene(state, state.sceneId);
    rotateTurn(state);
  }
}

export function combatAttack(prev: GameState, targetIdx: number): GameState {
  const state = clone(prev);
  if (state.phase !== "combat") return state;
  playerAttack(state, targetIdx);
  resolveAfterCombat(state);
  return state;
}

export function combatAbility(prev: GameState, abilityId: string, targetIdx: number): GameState {
  const state = clone(prev);
  if (state.phase !== "combat") return state;
  playerAbility(state, abilityId, targetIdx);
  resolveAfterCombat(state);
  return state;
}

export function combatItem(prev: GameState, itemId: string): GameState {
  const state = clone(prev);
  if (state.phase !== "combat") return state;
  playerUseItem(state, itemId);
  resolveAfterCombat(state);
  return state;
}

export function combatFlee(prev: GameState): GameState {
  const state = clone(prev);
  if (state.phase !== "combat") return state;
  playerFlee(state);
  resolveAfterCombat(state);
  return state;
}

// Append an AI-DM narration line without otherwise touching game state.
export function appendNarration(prev: GameState, text: string): GameState {
  const state = clone(prev);
  addLog(state, "narration", text);
  return state;
}

// ── AI free-form action resolution (guardrailed) ──

function clampInt(n: unknown, min: number, max: number): number {
  const v = Math.round(typeof n === "number" && isFinite(n) ? n : 0);
  return Math.max(min, Math.min(max, v));
}

// Apply a DM-adjudicated action. Narration is always shown; each effect is
// re-validated and clamped here so the model can never break the game (no shards,
// no teleporting, no game-ending, no out-of-range numbers, no unknown ids).
export function applyAiAction(prev: GameState, action: AiAction): GameState {
  const state = clone(prev);
  if (state.phase !== "exploring") {
    addLog(state, "narration", action.narration);
    return state;
  }

  addLog(state, "narration", action.narration);

  const effects = Array.isArray(action.effects) ? action.effects.slice(0, 3) : [];
  for (const raw of effects) {
    const eff = raw as AiEffect;
    if (!eff || typeof eff.type !== "string") continue;

    const hero = activeHero(state);
    const nm = state.party.length > 1 ? hero.name : "You";
    if (eff.type === "heal") {
      const amt = clampInt((eff as { amount?: number }).amount, 1, 12);
      hero.hp = Math.min(hero.maxHp, hero.hp + amt);
      addLog(state, "system", `${nm} (+${amt} HP)`);
    } else if (eff.type === "hurt") {
      const amt = clampInt((eff as { amount?: number }).amount, 1, 12);
      hero.hp = Math.max(0, hero.hp - amt);
      if (hero.hp <= 0) hero.downed = true;
      addLog(state, "combat", `${nm} (-${amt} HP)`);
      if (livingSeats(state).length === 0) {
        addLog(state, "system", "The party has fallen...");
        state.phase = "gameover";
        return state;
      }
    } else if (eff.type === "gold") {
      const amt = clampInt((eff as { amount?: number }).amount, -15, 15);
      state.gold = Math.max(0, state.gold + amt);
      addLog(state, "loot", amt >= 0 ? `(+${amt} gold)` : `(${amt} gold)`);
    } else if (eff.type === "xp") {
      const amt = clampInt((eff as { amount?: number }).amount, 0, 25);
      if (amt > 0) {
        const hasLumen = hasItem(state.inventory, "lumen_charm");
        const r = grantXp(hero, amt, hasLumen);
        addLog(state, "system", `${nm} (+${amt} XP)`);
        if (r.leveled) {
          addLog(state, "level", `⚜ ${nm} reach${state.party.length > 1 ? "es" : ""} level ${r.newLevel}!`);
          if (r.newAbility) addLog(state, "level", `Learned ${getAbility(r.newAbility).name}.`);
        }
      }
    } else if (eff.type === "item") {
      const id = (eff as { id?: string }).id ?? "";
      if (AI_ITEM_UNION.includes(id)) {
        addToInventory(state.inventory, id, 1);
        addLog(state, "loot", `Found: ${ITEMS[id].name}.`);
      }
    } else if (eff.type === "combat") {
      const ids = Array.isArray((eff as { enemies?: string[] }).enemies)
        ? (eff as { enemies: string[] }).enemies
        : [];
      const valid = ids.filter((e) => AI_ENEMY_UNION.includes(e)).slice(0, 2);
      if (valid.length) {
        const sc = Math.max(0, hero.level - 1);
        state.combat = {
          enemies: valid.map((id) => spawnEnemy(id, sc)),
          round: 0,
          acted: [],
          cooldowns: {},
          buffs: {},
          luckUsed: {},
          originSceneId: state.sceneId,
          returnSceneId: state.sceneId,
        };
        state.phase = "combat";
        addLog(state, "combat", `⚔ Battle begins — ${state.combat.enemies.map((e) => e.name).join(", ")}.`);
        return state; // stop processing further effects once a fight starts
      }
    }
    // "none" and anything unrecognized: ignored.
  }

  return state;
}

// Equip a weapon or armor from the shared stash onto a specific hero.
export function equipItem(prev: GameState, itemId: string, seat = 0): GameState {
  const state = clone(prev);
  const item = ITEMS[itemId];
  const hero = state.party[seat];
  if (!item || !hero) return state;
  if (!hasItem(state.inventory, itemId)) return state;
  if (item.kind === "weapon") {
    hero.equippedWeapon = itemId;
    addLog(state, "system", `${state.party.length > 1 ? hero.name + " readies" : "You ready"} the ${item.name}.`);
  } else if (item.kind === "armor") {
    hero.equippedArmor = itemId;
    addLog(state, "system", `${state.party.length > 1 ? hero.name + " dons" : "You don"} the ${item.name}.`);
  }
  return state;
}

// A specific hero consumes a potion from the shared stash outside of battle.
export function useItemExploring(prev: GameState, itemId: string, seat = 0): GameState {
  const state = clone(prev);
  const inv = state.inventory;
  const slot = inv.find((s) => s.itemId === itemId);
  const hero = state.party[seat];
  if (!slot || !hero) return state;
  const item = ITEMS[itemId];
  if (!item || item.kind !== "potion") return state;
  const nm = state.party.length > 1 ? hero.name : "You";

  if (item.heal) {
    hero.hp = Math.min(hero.maxHp, hero.hp + item.heal);
    addLog(state, "system", `${nm} drink${state.party.length > 1 ? "s" : ""} the ${item.name}. (+${item.heal} HP)`);
  }
  if (item.restoreMp) {
    hero.mp = Math.min(hero.maxMp, hero.mp + item.restoreMp);
    addLog(state, "system", `${nm} drink${state.party.length > 1 ? "s" : ""} the ${item.name}. (+${item.restoreMp} Weave)`);
  }
  removeFromInventory(inv, itemId, 1);
  return state;
}
