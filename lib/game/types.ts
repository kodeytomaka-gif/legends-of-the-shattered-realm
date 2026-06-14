// ── Core domain types for Legends of the Shattered Realm ──

export type AbilityKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export const ABILITY_KEYS: AbilityKey[] = ["str", "dex", "con", "int", "wis", "cha"];

export const ABILITY_NAMES: Record<AbilityKey, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};

export type Abilities = Record<AbilityKey, number>;

export type RaceId = "human" | "elf" | "dwarf" | "orc" | "halfling";
export type ClassId = "warrior" | "mage" | "rogue" | "cleric" | "ranger";

export interface RaceDef {
  id: RaceId;
  name: string;
  blurb: string;
  bonuses: Partial<Abilities>;
  trait: string;
}

export interface ClassDef {
  id: ClassId;
  name: string;
  blurb: string;
  primary: AbilityKey;
  hitDie: number;
  baseHp: number;
  baseMp: number;
  startingAbilities: string[]; // ability ids
  startingItems: string[]; // item ids
  startingGold: number;
}

export type ItemKind = "weapon" | "armor" | "potion" | "trinket" | "shard" | "key";

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  // weapon
  damage?: [number, number]; // [count, sides] of dice, e.g. [1,8] = 1d8
  damageBonus?: number;
  // armor
  ac?: number;
  // potion
  heal?: number;
  restoreMp?: number;
  // economy
  value?: number;
  stackable?: boolean;
}

export interface InventorySlot {
  itemId: string;
  qty: number;
}

export type AbilityEffect =
  | { type: "damage"; dice: [number, number]; bonus?: number; element?: string }
  | { type: "heal"; amount: number }
  | { type: "buff"; stat: "ac" | "attack"; amount: number; turns: number }
  | { type: "drain"; amount: number };

export interface AbilityDef {
  id: string;
  name: string;
  desc: string;
  mpCost: number;
  cooldown: number; // turns
  target: "enemy" | "self" | "all-enemies";
  effect: AbilityEffect;
  scalesWith?: AbilityKey;
}

export interface Character {
  name: string;
  race: RaceId;
  klass: ClassId;
  level: number;
  xp: number;
  abilities: Abilities;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  gold: number;
  inventory: InventorySlot[];
  equippedWeapon: string | null;
  equippedArmor: string | null;
  abilityIds: string[];
  shards: number; // Shards of Aethyr collected
  createdAt: number;
}

export interface Enemy {
  id: string;
  name: string;
  desc: string;
  hp: number;
  maxHp: number;
  ac: number;
  attack: number; // attack bonus
  damage: [number, number];
  damageBonus: number;
  xp: number;
  goldDrop: [number, number];
  lootTable?: { itemId: string; chance: number }[];
}

export type LogKind =
  | "narration"
  | "dm"
  | "player"
  | "system"
  | "combat"
  | "roll"
  | "loot"
  | "level";

export interface LogEntry {
  id: string;
  kind: LogKind;
  text: string;
  ts: number;
}

export type Phase = "creating" | "exploring" | "combat" | "gameover" | "victory";

export interface CombatState {
  enemies: Enemy[];
  turn: number;
  cooldowns: Record<string, number>; // abilityId -> turns remaining
  buffs: { stat: "ac" | "attack"; amount: number; turns: number }[];
  // where to return after combat resolves
  returnSceneId: string;
  // optional scene id to jump to if the player flees
  fleeSceneId?: string;
}

export interface GameState {
  version: number;
  campaignId: string;
  phase: Phase;
  character: Character;
  sceneId: string;
  visited: string[];
  flags: Record<string, boolean | number | string>;
  log: LogEntry[];
  combat: CombatState | null;
  pendingChoiceLock: boolean;
}
