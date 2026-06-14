import type { GameState, Character, AbilityKey } from "./types";
import type { SceneContext } from "./scene";
import { getScene, START_SCENE } from "./story";
import { spawnEnemy } from "./enemies";
import {
  addToInventory,
  removeFromInventory,
  hasItem,
  grantXp,
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

export const SAVE_VERSION = 1;

export function newGame(character: Character): GameState {
  const state: GameState = {
    version: SAVE_VERSION,
    phase: "exploring",
    character,
    sceneId: START_SCENE,
    visited: [],
    flags: {},
    log: [],
    combat: null,
    pendingChoiceLock: false,
  };
  addLog(state, "system", `${character.name}'s legend begins.`);
  enterScene(state, START_SCENE);
  return state;
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
      // Elf keen senses helps perception-style (wis) checks a touch.
      const elfBonus = state.character.race === "elf" && ability === "wis" ? 2 : 0;
      const result = abilityCheck(state.character.abilities, ability, dc, extra + elfBonus);
      addLog(
        state,
        "roll",
        `🎲 d20 (${result.d20}) ${result.mod >= 0 ? "+" : ""}${result.mod} = ${result.total} vs DC ${dc} — ${
          result.success ? "SUCCESS" : "FAILURE"
        }${result.crit === "hit" ? " (natural 20!)" : result.crit === "miss" ? " (natural 1!)" : ""}`
      );
      return result;
    },
    goto: (sceneId: string) => {
      ctx._navTarget = sceneId;
    },
    combat: (enemyIds, opts) => {
      const sc = opts.scale ?? 0;
      const enemies = enemyIds.map((id) => spawnEnemy(id, sc));
      state.combat = {
        enemies,
        turn: 0,
        cooldowns: {},
        buffs: [],
        returnSceneId: opts.onWin,
        fleeSceneId: opts.onFlee,
      };
      state.phase = "combat";
      if (opts.intro) addLog(state, "narration", opts.intro);
      const names = enemies.map((e) => e.name).join(", ");
      addLog(state, "combat", `⚔ Battle begins — ${names}.`);
    },
    give: (itemId, qty = 1) => {
      addToInventory(state.character.inventory, itemId, qty);
    },
    take: (itemId, qty = 1) => removeFromInventory(state.character.inventory, itemId, qty),
    has: (itemId) => hasItem(state.character, itemId),
    gold: (delta) => {
      state.character.gold = Math.max(0, state.character.gold + delta);
    },
    heal: (amount) => {
      state.character.hp = Math.min(state.character.maxHp, state.character.hp + amount);
    },
    hurt: (amount) => {
      state.character.hp = Math.max(0, state.character.hp - amount);
      if (state.character.hp <= 0) {
        addLog(state, "system", "Your wounds overcome you...");
        state.phase = "gameover";
      }
    },
    restoreMp: (amount) => {
      state.character.mp = Math.min(state.character.maxMp, state.character.mp + amount);
    },
    addShard: () => {
      state.character.shards += 1;
    },
    xp: (amount) => {
      const r = grantXp(state.character, amount);
      addLog(state, "system", `You gain ${amount} experience.`);
      if (r.leveled) {
        addLog(state, "level", `⚜ You reach level ${r.newLevel}! (HP & Weave restored)`);
        if (r.newAbility) addLog(state, "level", `New ability learned: ${getAbility(r.newAbility).name}.`);
      }
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
  }

  return state;
}

// ── Combat action wrappers (clone + resolve + maybe re-narrate) ──

function resolveAfterCombat(state: GameState): void {
  // If combat ended in a win or flee, narrate the destination scene.
  if (state.phase === "exploring" && state.combat === null) {
    enterScene(state, state.sceneId);
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

// Equip a weapon or armor the hero is carrying.
export function equipItem(prev: GameState, itemId: string): GameState {
  const state = clone(prev);
  const item = ITEMS[itemId];
  if (!item) return state;
  if (!hasItem(state.character, itemId)) return state;
  if (item.kind === "weapon") {
    state.character.equippedWeapon = itemId;
    addLog(state, "system", `You ready the ${item.name}.`);
  } else if (item.kind === "armor") {
    state.character.equippedArmor = itemId;
    addLog(state, "system", `You don the ${item.name}.`);
  }
  return state;
}

// Player consumes a potion outside of battle.
export function useItemExploring(prev: GameState, itemId: string): GameState {
  const state = clone(prev);
  const inv = state.character.inventory;
  const slot = inv.find((s) => s.itemId === itemId);
  if (!slot) return state;
  const item = ITEMS[itemId];
  if (!item || item.kind !== "potion") return state;

  if (item.heal) {
    state.character.hp = Math.min(state.character.maxHp, state.character.hp + item.heal);
    addLog(state, "system", `You drink the ${item.name}. (+${item.heal} HP)`);
  }
  if (item.restoreMp) {
    state.character.mp = Math.min(state.character.maxMp, state.character.mp + item.restoreMp);
    addLog(state, "system", `You drink the ${item.name}. (+${item.restoreMp} Weave)`);
  }
  removeFromInventory(inv, itemId, 1);
  return state;
}
