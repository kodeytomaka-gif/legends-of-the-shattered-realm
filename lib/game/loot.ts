import type { Rarity, Affix, AffixStat, ItemInstance, ItemDef } from "./types";
import { getItem, ITEMS } from "./content";
import { pick, chance, rollRange } from "./dice";
import { uid } from "./util";

export type { Rarity, Affix, AffixStat } from "./types";

// ── Rarity ──
export const RARITY_ORDER: Rarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export interface RarityDef {
  id: Rarity;
  name: string;
  color: string; // tailwind text color class
  border: string; // tailwind border color class
  affixes: [number, number]; // min/max affix count
  perkChance: number;
  weight: number; // base drop weight
}

export const RARITY: Record<Rarity, RarityDef> = {
  common: { id: "common", name: "Common", color: "text-parchment-200", border: "border-parchment-300/30", affixes: [0, 0], perkChance: 0, weight: 50 },
  uncommon: { id: "uncommon", name: "Uncommon", color: "text-moss-400", border: "border-moss-400/50", affixes: [1, 1], perkChance: 0.1, weight: 30 },
  rare: { id: "rare", name: "Rare", color: "text-sky-300", border: "border-sky-400/50", affixes: [1, 2], perkChance: 0.35, weight: 14 },
  epic: { id: "epic", name: "Epic", color: "text-arcane-400", border: "border-arcane-400/60", affixes: [2, 3], perkChance: 0.6, weight: 5 },
  legendary: { id: "legendary", name: "Legendary", color: "text-gold-300", border: "border-gold-400/70", affixes: [3, 4], perkChance: 1, weight: 1 },
};

// ── Affixes ──
const PREFIX: Record<AffixStat, string> = {
  attack: "Keen", damage: "Vicious", ac: "Sturdy", maxHp: "Stalwart", maxMp: "Mystic",
  str: "Mighty", dex: "Nimble", con: "Hardy", int: "Clever", wis: "Sage", cha: "Charming",
};
const SUFFIX: Record<AffixStat, string> = {
  attack: "of Precision", damage: "of Ruin", ac: "of the Bulwark", maxHp: "of Vigor", maxMp: "of the Weave",
  str: "of the Bear", dex: "of the Cat", con: "of the Tortoise", int: "of the Owl", wis: "of the Serpent", cha: "of the Fox",
};

export function affixLabel(a: Affix): string {
  const sign = a.amount >= 0 ? "+" : "";
  const name: Record<AffixStat, string> = {
    ac: "Armor", attack: "Attack", damage: "Damage", maxHp: "Max HP", maxMp: "Max Weave",
    str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
  };
  return `${sign}${a.amount} ${name[a.stat]}`;
}

// ── Perks ──
export interface PerkDef {
  id: string;
  name: string;
  desc: string;
}

export const PERKS: Record<string, PerkDef> = {
  vampiric: { id: "vampiric", name: "Vampiric", desc: "Heal for 20% of weapon damage dealt." },
  keen: { id: "keen", name: "Keen", desc: "Weapon attacks crit on 19-20." },
  brutal: { id: "brutal", name: "Brutal", desc: "+2 weapon damage." },
  guardian: { id: "guardian", name: "Guardian", desc: "+1 Armor Class." },
  regen: { id: "regen", name: "Regenerating", desc: "Recover 2 HP at the end of each combat round." },
  lucky: { id: "lucky", name: "Lucky", desc: "Once per battle, reroll a missed weapon attack." },
};
const PERK_IDS = Object.keys(PERKS);

// Which affix stats suit each item kind.
function affixPool(kind: ItemDef["kind"]): AffixStat[] {
  if (kind === "weapon") return ["attack", "damage", "str", "dex", "int"];
  if (kind === "armor") return ["ac", "maxHp", "con", "dex"];
  // rings & amulets: anything
  return ["maxHp", "maxMp", "ac", "attack", "str", "dex", "con", "int", "wis", "cha"];
}

function affixMagnitude(stat: AffixStat, rIndex: number): number {
  // Higher rarity → bigger numbers. AC/attack/damage stay small; HP/MP larger.
  if (stat === "maxHp") return rollRange([3, 4 + rIndex * 3]);
  if (stat === "maxMp") return rollRange([2, 3 + rIndex * 2]);
  if (stat === "ac" || stat === "attack") return rollRange([1, 1 + Math.ceil(rIndex / 2)]);
  if (stat === "damage") return rollRange([1, 1 + rIndex]);
  return rollRange([1, 1 + Math.ceil(rIndex / 2)]); // ability scores
}

function rollRarity(tier: number): Rarity {
  // tier (0-5+) shifts weights toward better rarities.
  const weights = RARITY_ORDER.map((r) => {
    const base = RARITY[r].weight;
    const idx = RARITY_ORDER.indexOf(r);
    return Math.max(0.2, base * Math.pow(1.35, tier) ** (idx / 2));
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < RARITY_ORDER.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return RARITY_ORDER[i];
  }
  return "common";
}

function buildName(base: ItemDef, affixes: Affix[], perks: string[]): string {
  if (affixes.length === 0 && perks.length === 0) return base.name;
  let name = base.name;
  // Prefix from the strongest positive affix or a perk.
  const topPos = [...affixes].filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)[0];
  if (perks.length) name = `${PERKS[perks[0]].name} ${name}`;
  else if (topPos) name = `${PREFIX[topPos.stat]} ${name}`;
  // Suffix from a secondary positive affix.
  const second = [...affixes].filter((a) => a.amount > 0).sort((a, b) => b.amount - a.amount)[1] ?? (perks.length ? topPos : undefined);
  if (second) name = `${name} ${SUFFIX[second.stat]}`;
  return name;
}

// Generate a unique item instance from a base def id.
export function rollGear(defId: string, opts: { tier?: number; rarity?: Rarity } = {}): ItemInstance {
  const base = getItem(defId);
  const rarity = opts.rarity ?? rollRarity(opts.tier ?? 0);
  const rdef = RARITY[rarity];
  const rIndex = RARITY_ORDER.indexOf(rarity);

  const count = rollRange(rdef.affixes);
  const pool = affixPool(base.kind);
  const affixes: Affix[] = [];
  const usedStats = new Set<AffixStat>();
  for (let i = 0; i < count; i++) {
    const stat = pick(pool.filter((s) => !usedStats.has(s)));
    if (!stat) break;
    usedStats.add(stat);
    affixes.push({ stat, amount: affixMagnitude(stat, rIndex + 1) });
  }
  // Cursed trade-off: epic+ items sometimes take a penalty in exchange for a stronger boon.
  if (rIndex >= 3 && chance(0.4) && affixes.length) {
    const penaltyStat = pick(affixPool(base.kind));
    affixes.push({ stat: penaltyStat, amount: -rollRange([1, 2]) });
    affixes[0].amount += 1 + rIndex; // compensate with a stronger primary
  }

  const perks: string[] = [];
  if (chance(rdef.perkChance)) perks.push(pick(PERK_IDS));
  if (rIndex >= 3 && chance(rdef.perkChance * 0.5)) {
    const extra = pick(PERK_IDS.filter((p) => !perks.includes(p)));
    if (extra) perks.push(extra);
  }

  return {
    uid: uid("g"),
    defId,
    rarity,
    affixes,
    perks,
    name: buildName(base, affixes, perks),
  };
}

// A plain (common, no-affix) instance — used for starting gear & shop basics.
export function plainGear(defId: string): ItemInstance {
  return { uid: uid("g"), defId, rarity: "common", affixes: [], perks: [], name: getItem(defId).name };
}

// Generic accessory bases exist in ITEMS; helper to roll one.
export function rollAccessory(tier = 1): ItemInstance {
  const baseId = chance(0.5) ? "ring" : "amulet";
  // Accessories skew toward at least uncommon so they're worth a slot.
  const inst = rollGear(baseId, { tier: tier + 1 });
  if (inst.rarity === "common") return rollGear(baseId, { rarity: "uncommon" });
  return inst;
}

export function instanceValue(inst: ItemInstance): number {
  const base = ITEMS[inst.defId]?.value ?? 5;
  const mult = 1 + RARITY_ORDER.indexOf(inst.rarity) * 0.75;
  const affixVal = inst.affixes.reduce((s, a) => s + Math.abs(a.amount) * 3, 0);
  return Math.round(base * mult + affixVal + inst.perks.length * 20);
}
