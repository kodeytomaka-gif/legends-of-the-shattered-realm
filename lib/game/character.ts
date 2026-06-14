import type {
  Abilities,
  AbilityKey,
  Character,
  ClassId,
  RaceId,
  InventorySlot,
} from "./types";
import { ABILITY_KEYS } from "./types";
import { CLASSES, RACES, SUBCLASSES, getItem } from "./content";
import { abilityMod, rollDice } from "./dice";

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

  // Equip starting weapon and armor.
  const weapon = def.startingItems.find((id) => getItem(id).kind === "weapon") ?? null;
  const armor = def.startingItems.find((id) => getItem(id).kind === "armor") ?? null;

  // Resolve the chosen subclass (default to the class's first) and grant its ability.
  const subs = SUBCLASSES[klass] ?? [];
  const sub = subs.find((s) => s.id === opts.subclass) ?? subs[0];
  const abilityIds = [...def.startingAbilities];
  if (sub && !abilityIds.includes(sub.grantsAbility)) abilityIds.push(sub.grantsAbility);

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
    equippedWeapon: weapon,
    equippedArmor: armor,
    abilityIds,
    downed: false,
    createdAt: Date.now(),
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

export function armorClass(char: Character): number {
  const dexMod = abilityMod(char.abilities.dex);
  const armor = char.equippedArmor ? getItem(char.equippedArmor).ac ?? 0 : 0;
  return 10 + dexMod + armor;
}

export function attackBonus(char: Character): number {
  const def = CLASSES[char.klass];
  const profBonus = 2 + Math.floor((char.level - 1) / 2);
  return abilityMod(char.abilities[def.primary]) + profBonus;
}

export function weaponDamageRoll(char: Character): { amount: number; label: string } {
  const def = CLASSES[char.klass];
  const weapon = char.equippedWeapon ? getItem(char.equippedWeapon) : null;
  const dice = weapon?.damage ?? [1, 4];
  const bonus = (weapon?.damageBonus ?? 0) + abilityMod(char.abilities[def.primary]);
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
};

export function grantXp(char: Character, amount: number, hasLumen = false): LevelUpResult {
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
    char.hp = char.maxHp; // full restore on level up
    char.mp = char.maxMp;

    const unlock = PROGRESSION[char.klass]?.[char.level];
    if (unlock && !char.abilityIds.includes(unlock)) {
      char.abilityIds.push(unlock);
      newAbility = unlock;
    }
  }

  return { leveled, newLevel: char.level, hpGain, mpGain, newAbility };
}
