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
export type ClassId =
  | "warrior"
  | "mage"
  | "rogue"
  | "cleric"
  | "ranger"
  | "bard"
  | "paladin"
  | "druid"
  | "monk";

export interface SubclassDef {
  id: string;
  name: string;
  blurb: string;
  grantsAbility: string; // ability id unlocked at creation
}

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

export type ItemKind = "weapon" | "armor" | "potion" | "trinket" | "shard" | "key" | "ring" | "amulet";

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

// ── Equipment instances (rarity + rolled affixes/perks) ──
export type Rarity = "common" | "uncommon" | "rare" | "epic" | "legendary";
export type AffixStat = "ac" | "attack" | "damage" | "maxHp" | "maxMp" | AbilityKey;
export interface Affix {
  stat: AffixStat;
  amount: number; // negative = a trade-off/penalty
}
export interface ItemInstance {
  uid: string;
  defId: string;
  rarity: Rarity;
  affixes: Affix[];
  perks: string[]; // perk ids (see lib/game/loot.ts PERKS)
  name: string;
}

export type EquipSlot = "weapon" | "armor" | "ring1" | "ring2" | "amulet";
export type EquipSlots = Record<EquipSlot, string | null>; // slot -> ItemInstance uid

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
  subclass: string;
  equipment: EquipSlots; // slot -> ItemInstance uid (into GameState.gear)
  abilityIds: string[];
  downed: boolean; // knocked out during the current battle
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

export interface RollMeta {
  d20: number;
  mod: number;
  total: number;
  dc: number;
  success: boolean;
  crit: "hit" | "miss" | null;
  label?: string; // e.g. "Perception", "Stealth"
}

export interface LogEntry {
  id: string;
  kind: LogKind;
  text: string;
  ts: number;
  roll?: RollMeta; // present on skill-check rolls, drives the dice animation
}

export type Phase = "creating" | "exploring" | "combat" | "gameover" | "victory";

export interface Buff {
  stat: "ac" | "attack";
  amount: number;
  turns: number;
}

// Side-based party combat: every living hero acts (in seat order) during the
// player phase, then every enemy acts. Cooldowns/buffs are tracked per hero seat.
export interface CombatState {
  enemies: Enemy[];
  round: number;
  acted: number[]; // party seats that have acted this round
  cooldowns: Record<number, Record<string, number>>; // seat -> abilityId -> turns
  buffs: Record<number, Buff[]>; // seat -> active buffs
  luckUsed: Record<number, boolean>; // seat -> halfling reroll spent this battle
  originSceneId: string; // scene the fight started in (flee returns here)
  returnSceneId: string;
  fleeSceneId?: string;
}

export interface GameState {
  version: number;
  campaignId: string;
  phase: Phase;
  // A shared co-op party of 1-4 heroes (seat index = order in this array).
  party: Character[];
  // Shared party resources.
  gold: number;
  inventory: InventorySlot[];
  gear: ItemInstance[]; // unique equippable instances (weapons/armor/rings/amulets)
  shards: number; // Shards of Aethyr collected (campaign 1)
  // Whose turn it is to make exploration decisions (seat index).
  turnPlayer: number;
  sceneId: string;
  visited: string[];
  flags: Record<string, boolean | number | string>;
  log: LogEntry[];
  combat: CombatState | null;
  pendingChoiceLock: boolean;
}
