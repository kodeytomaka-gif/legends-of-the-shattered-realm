import type {
  Abilities,
  AbilityKey,
  Character,
  ClassId,
  RaceId,
  InventorySlot,
  ItemInstance,
} from "./types";
import { ABILITY_KEYS } from "./types";
import { CLASSES, RACES, SUBCLASSES, getItem } from "./content";
import { abilityMod, rollDice } from "./dice";

// ── Equipment lookups & aggregated modifiers ──

export function getInstance(gear: ItemInstance[], uid: string | null): ItemInstance | null {
  if (!uid) return null;
  return gear.find((g) => g.uid === uid) ?? null;
}

export function equippedInstances(char: Character, gear: ItemInstance[]): ItemInstance[] {
  return (Object.values(char.equipment) as (string | null)[])
    .map((u) => getInstance(gear, u))
    .filter((x): x is ItemInstance => x !== null);
}

export interface EquipMods {
  ac: number;
  attack: number;
  damage: number;
  maxHp: number;
  maxMp: number;
  abilities: Partial<Abilities>;
  perks: string[];
}

export function equippedMods(char: Character, gear: ItemInstance[]): EquipMods {
  const m: EquipMods = { ac: 0, attack: 0, damage: 0, maxHp: 0, maxMp: 0, abilities: {}, perks: [] };
  for (const inst of equippedInstances(char, gear)) {
    const def = getItem(inst.defId);
    if (def.kind === "armor") m.ac += def.ac ?? 0;
    for (const a of inst.affixes) {
      if (a.stat === "ac") m.ac += a.amount;
      else if (a.stat === "attack") m.attack += a.amount;
      else if (a.stat === "damage") m.damage += a.amount;
      else if (a.stat === "maxHp") m.maxHp += a.amount;
      else if (a.stat === "maxMp") m.maxMp += a.amount;
      else m.abilities[a.stat] = (m.abilities[a.stat] ?? 0) + a.amount;
    }
    for (const p of inst.perks) if (!m.perks.includes(p)) m.perks.push(p);
  }
  if (m.perks.includes("guardian")) m.ac += 1;
  return m;
}

export function effAbility(char: Character, gear: ItemInstance[], key: AbilityKey): number {
  return char.abilities[key] + (equippedMods(char, gear).abilities[key] ?? 0);
}
export function effectiveMaxHp(char: Character, gear: ItemInstance[]): number {
  return Math.max(1, char.maxHp + equippedMods(char, gear).maxHp);
}
export function effectiveMaxMp(char: Character, gear: ItemInstance[]): number {
  return Math.max(0, char.maxMp + equippedMods(char, gear).maxMp);
}

export const POINT_BUY_TOTAL = 27;
export const POINT_BUY_MIN = 8;
export const POINT_BUY_MAX = 15;

// D&D-style point-buy cost.
const POINT_COST: Record<number, number> = {
  8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9,
};

export function pointCost(score: number): number {
  return POINT_COST[score] ?? 99;
}

export function totalSpent(scores: Abilities): number {
  return ABILITY_KEYS.reduce((sum, k) => sum + pointCost(scores[k]), 0);
}

export function defaultPointBuy(): Abilities {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
}

export function applyRaceBonuses(base: Abilities, race: RaceId): Abilities {
  const out = { ...base };
  const bonuses = RACES[race].bonuses;
  (Object.keys(bonuses) as AbilityKey[]).forEach((k) => {
    out[k] += bonuses[k] ?? 0;
  });
  return out;
}

export function xpToNext(level: number): number {
  // Brisk early curve so heroes grow alongside the campaign's handful of fights.
  // L1->2: 60, L2->3: 110, L3->4: 160, ... (50 per level thereafter).
  return 60 + (level - 1) * 50;
}

export function maxHpFor(klass: ClassId, con: number, level: number, hasLumen: boolean): number {
  const def = CLASSES[klass];
  const conMod = abilityMod(con);
  // First level is fixed; later levels add ~average of the hit die.
  const perLevel = Math.floor(def.hitDie / 2) + 1 + conMod;
  let hp = def.baseHp + conMod + perLevel * (level - 1);
  if (hasLumen) hp += level;
  return Math.max(1, hp);
}

export function maxMpFor(klass: ClassId, primaryScore: number, level: number): number {
  const def = CLASSES[klass];
  const mod = abilityMod(primaryScore);
  return Math.max(0, def.baseMp + Math.max(0, mod) * 2 + (level - 1) * 3);
}

export function createCharacter(opts: {
  name: string;
  race: RaceId;
  klass: ClassId;
  abilities: Abilities;
  subclass?: string;
}): Character {
  const { name, race, klass } = opts;
  const def = CLASSES[klass];
  const abilities = applyRaceBonuses(opts.abilities, race);

  const primaryScore = abilities[def.primary];
  const maxHp = maxHpFor(klass, abilities.con, 1, false);
  const maxMp = maxMpFor(klass, primaryScore, 1);

  // Resolve the chosen subclass (default to the class's first) and grant its ability.
  const subs = SUBCLASSES[klass] ?? [];
  const sub = subs.find((s) => s.id === opts.subclass) ?? subs[0];
  const abilityIds = [...def.startingAbilities];
  if (sub && !abilityIds.includes(sub.grantsAbility)) abilityIds.push(sub.grantsAbility);

  // Equipment slots start empty; newGame creates starting weapon/armor instances
  // in the shared gear pool and assigns their uids here.
  return {
    name: name.trim() || "Wanderer",
    race,
    klass,
    subclass: sub?.id ?? "",
    level: 1,
    xp: 0,
    abilities,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    equipment: { weapon: null, armor: null, ring1: null, ring2: null, amulet: null },
    abilityIds,
    downed: false,
    createdAt: Date.now(),
  };
}

// The starting weapon/armor base ids for a class (instantiated by newGame).
export function startingEquip(klass: ClassId): { weapon: string | null; armor: string | null } {
  const def = CLASSES[klass];
  return {
    weapon: def.startingItems.find((id) => getItem(id).kind === "weapon") ?? null,
    armor: def.startingItems.find((id) => getItem(id).kind === "armor") ?? null,
  };
}

// A hero's starting gold and the non-equipped items they bring to the shared
// party pool (their equipped weapon/armor are not duplicated into inventory).
export function startingKit(klass: ClassId): { gold: number; items: string[] } {
  const def = CLASSES[klass];
  const weapon = def.startingItems.find((id) => getItem(id).kind === "weapon");
  const armor = def.startingItems.find((id) => getItem(id).kind === "armor");
  const equipped = new Set<string>();
  if (weapon) equipped.add(weapon);
  if (armor) equipped.add(armor);
  const items: string[] = [];
  const used = new Set<string>();
  for (const id of def.startingItems) {
    // Skip exactly one instance of each equipped weapon/armor.
    if (equipped.has(id) && !used.has(id)) {
      used.add(id);
      continue;
    }
    items.push(id);
  }
  return { gold: def.startingGold, items };
}

export function hasItem(inventory: InventorySlot[], itemId: string): boolean {
  return inventory.some((s) => s.itemId === itemId && s.qty > 0);
}

export function addToInventory(inv: InventorySlot[], itemId: string, qty: number): void {
  const def = getItem(itemId);
  if (def.stackable) {
    const slot = inv.find((s) => s.itemId === itemId);
    if (slot) {
      slot.qty += qty;
      return;
    }
  }
  for (let i = 0; i < qty; i++) inv.push({ itemId, qty: 1 });
}

export function removeFromInventory(inv: InventorySlot[], itemId: string, qty = 1): boolean {
  const idx = inv.findIndex((s) => s.itemId === itemId && s.qty > 0);
  if (idx === -1) return false;
  const slot = inv[idx];
  if (slot.qty > qty) slot.qty -= qty;
  else inv.splice(idx, 1);
  return true;
}

export function armorClass(char: Character, gear: ItemInstance[] = []): number {
  const m = equippedMods(char, gear);
  const dexMod = abilityMod(char.abilities.dex + (m.abilities.dex ?? 0));
  return 10 + dexMod + m.ac;
}

export function attackBonus(char: Character, gear: ItemInstance[] = []): number {
  const def = CLASSES[char.klass];
  const m = equippedMods(char, gear);
  const profBonus = 2 + Math.floor((char.level - 1) / 2);
  const prim = char.abilities[def.primary] + (m.abilities[def.primary] ?? 0);
  return abilityMod(prim) + profBonus + m.attack;
}

export function weaponDamageRoll(char: Character, gear: ItemInstance[] = []): { amount: number; label: string } {
  const def = CLASSES[char.klass];
  const m = equippedMods(char, gear);
  const weaponInst = getInstance(gear, char.equipment.weapon);
  const weaponDef = weaponInst ? getItem(weaponInst.defId) : null;
  const dice = weaponDef?.damage ?? [1, 4];
  let bonus = (weaponDef?.damageBonus ?? 0) + abilityMod(char.abilities[def.primary] + (m.abilities[def.primary] ?? 0)) + m.damage;
  if (m.perks.includes("brutal")) bonus += 2;
  const rolled = rollDice(dice[0], dice[1]) + bonus;
  return { amount: Math.max(1, rolled), label: `${dice[0]}d${dice[1]}+${bonus}` };
}

export interface LevelUpResult {
  leveled: boolean;
  newLevel: number;
  hpGain: number;
  mpGain: number;
  newAbility?: string;
}

// Abilities unlocked as the hero grows, by class.
const PROGRESSION: Record<ClassId, Record<number, string>> = {
  warrior: { 3: "rally" },
  mage: { 3: "frost_nova", 5: "mend" },
  rogue: { 3: "smoke_bomb" },
  cleric: { 3: "bless", 5: "smite" },
  ranger: { 3: "hunters_mark", 5: "aimed_shot" },
  bard: { 3: "mend", 5: "guiding_bolt" },
  paladin: { 3: "rally", 5: "smite" },
  druid: { 3: "frost_nova", 5: "mend" },
  monk: { 3: "stunning_strike", 5: "smoke_bomb" },
  necromancer: { 3: "bone_armor", 5: "raise_fallen" },
};

export function grantXp(char: Character, amount: number, hasLumen = false, gear: ItemInstance[] = []): LevelUpResult {
  const raceBonus = char.race === "human" ? 1.1 : 1;
  char.xp += Math.round(amount * raceBonus);
  let leveled = false;
  let hpGain = 0;
  let mpGain = 0;
  let newAbility: string | undefined;

  while (char.xp >= xpToNext(char.level)) {
    char.xp -= xpToNext(char.level);
    char.level += 1;
    leveled = true;

    const def = CLASSES[char.klass];
    const newMaxHp = maxHpFor(char.klass, char.abilities.con, char.level, hasLumen);
    const newMaxMp = maxMpFor(char.klass, char.abilities[def.primary], char.level);
    hpGain += newMaxHp - char.maxHp;
    mpGain += newMaxMp - char.maxMp;
    char.maxHp = newMaxHp;
    char.maxMp = newMaxMp;
    char.hp = effectiveMaxHp(char, gear); // full restore on level up (incl. gear)
    char.mp = effectiveMaxMp(char, gear);

    const unlock = PROGRESSION[char.klass]?.[char.level];
    if (unlock && !char.abilityIds.includes(unlock)) {
      char.abilityIds.push(unlock);
      newAbility = unlock;
    }
  }

  return { leveled, newLevel: char.level, hpGain, mpGain, newAbility };
}
