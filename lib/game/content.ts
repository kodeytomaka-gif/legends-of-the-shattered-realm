import type {
  RaceDef,
  ClassDef,
  ItemDef,
  AbilityDef,
  SubclassDef,
  RaceId,
  ClassId,
} from "./types";

// ── Races ──
export const RACES: Record<RaceId, RaceDef> = {
  human: {
    id: "human",
    name: "Human",
    blurb: "Adaptable wanderers of the broken roads, quick to learn and slow to break.",
    bonuses: { str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 },
    trait: "Resolute — gain 10% more XP from every victory.",
  },
  elf: {
    id: "elf",
    name: "Elf",
    blurb: "Ageless children of the old forests, keen-eyed and deft of hand.",
    bonuses: { dex: 2, int: 1 },
    trait: "Keen Senses — +2 to Perception and ranged accuracy.",
  },
  dwarf: {
    id: "dwarf",
    name: "Dwarf",
    blurb: "Stone-born and stubborn, forged in the deep halls beneath the Sundering.",
    bonuses: { con: 2, str: 1 },
    trait: "Stonehide — start each battle with +2 effective armor.",
  },
  orc: {
    id: "orc",
    name: "Orc",
    blurb: "Tusked survivors of the wastes, whose fury outlasts their wounds.",
    bonuses: { str: 2, con: 1 },
    trait: "Savage Blood — deal +2 melee damage when below half health.",
  },
  halfling: {
    id: "halfling",
    name: "Halfling",
    blurb: "Small, lucky, and impossibly hard to corner in a fight.",
    bonuses: { dex: 2, cha: 1 },
    trait: "Lucky — once per battle, reroll a failed attack.",
  },
};

// ── Classes ──
export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: {
    id: "warrior",
    name: "Warrior",
    blurb: "A bulwark of steel who solves most problems edge-first.",
    primary: "str",
    hitDie: 10,
    baseHp: 14,
    baseMp: 4,
    startingAbilities: ["power_strike", "rally"],
    startingItems: ["longsword", "chainmail", "potion_minor", "potion_minor"],
    startingGold: 25,
  },
  mage: {
    id: "mage",
    name: "Mage",
    blurb: "A scholar of the shattered weave, hurling fire and frost from afar.",
    primary: "int",
    hitDie: 6,
    baseHp: 8,
    baseMp: 14,
    startingAbilities: ["firebolt", "frost_nova", "mend"],
    startingItems: ["oak_staff", "robes", "potion_mana", "potion_minor"],
    startingGold: 30,
  },
  rogue: {
    id: "rogue",
    name: "Rogue",
    blurb: "A shadow with a knife, paid in coin and the silence of guards.",
    primary: "dex",
    hitDie: 8,
    baseHp: 10,
    baseMp: 6,
    startingAbilities: ["backstab", "smoke_bomb"],
    startingItems: ["twin_daggers", "leather_armor", "potion_minor", "lockpicks"],
    startingGold: 45,
  },
  cleric: {
    id: "cleric",
    name: "Cleric",
    blurb: "A vessel of a fractured god, mending wounds and smiting the unclean.",
    primary: "wis",
    hitDie: 8,
    baseHp: 11,
    baseMp: 12,
    startingAbilities: ["smite", "heal_wounds", "bless"],
    startingItems: ["warhammer", "chainmail", "potion_minor", "potion_mana"],
    startingGold: 20,
  },
  ranger: {
    id: "ranger",
    name: "Ranger",
    blurb: "A hunter of the wilds who never misses what they mean to hit.",
    primary: "dex",
    hitDie: 10,
    baseHp: 12,
    baseMp: 8,
    startingAbilities: ["aimed_shot", "hunters_mark", "mend"],
    startingItems: ["longbow", "leather_armor", "potion_minor", "potion_minor"],
    startingGold: 30,
  },
  bard: {
    id: "bard",
    name: "Bard",
    blurb: "A silver-tongued performer who turns wit and song into a weapon.",
    primary: "cha",
    hitDie: 8,
    baseHp: 10,
    baseMp: 12,
    startingAbilities: ["vicious_mock", "inspire"],
    startingItems: ["twin_daggers", "leather_armor", "potion_minor", "potion_mana"],
    startingGold: 35,
  },
  paladin: {
    id: "paladin",
    name: "Paladin",
    blurb: "An oathbound knight whose blade carries the weight of the divine.",
    primary: "str",
    hitDie: 10,
    baseHp: 13,
    baseMp: 8,
    startingAbilities: ["divine_smite", "lay_hands"],
    startingItems: ["longsword", "chainmail", "potion_minor", "potion_minor"],
    startingGold: 25,
  },
  druid: {
    id: "druid",
    name: "Druid",
    blurb: "A keeper of the wild places who calls on thorn, root, and storm.",
    primary: "wis",
    hitDie: 8,
    baseHp: 11,
    baseMp: 12,
    startingAbilities: ["thorn_lash", "regrowth"],
    startingItems: ["oak_staff", "robes", "potion_minor", "potion_mana"],
    startingGold: 25,
  },
  monk: {
    id: "monk",
    name: "Monk",
    blurb: "A disciplined martial artist who strikes faster than the eye can follow.",
    primary: "dex",
    hitDie: 8,
    baseHp: 11,
    baseMp: 8,
    startingAbilities: ["flurry", "focus"],
    startingItems: ["oak_staff", "leather_armor", "potion_minor", "potion_minor"],
    startingGold: 20,
  },
  necromancer: {
    id: "necromancer",
    name: "Necromancer",
    blurb: "A scholar of death who drains the living and drags the fallen back to their feet.",
    primary: "int",
    hitDie: 6,
    baseHp: 9,
    baseMp: 14,
    startingAbilities: ["bone_spear", "life_drain"],
    startingItems: ["oak_staff", "robes", "potion_minor", "potion_mana"],
    startingGold: 25,
  },
};

// Subclasses — pick one at creation; it grants a signature ability.
export const SUBCLASSES: Record<ClassId, SubclassDef[]> = {
  warrior: [
    { id: "berserker", name: "Berserker", blurb: "Fury over form. Hits like a landslide.", grantsAbility: "reckless_blow" },
    { id: "knight", name: "Knight", blurb: "An immovable wall of steel.", grantsAbility: "shield_wall" },
  ],
  mage: [
    { id: "evoker", name: "Evoker", blurb: "Raw destructive force, refined.", grantsAbility: "arcane_surge" },
    { id: "frostborn", name: "Frostborn", blurb: "Master of ice and the killing cold.", grantsAbility: "frost_nova" },
  ],
  rogue: [
    { id: "assassin", name: "Assassin", blurb: "Poison, patience, and a perfect strike.", grantsAbility: "venom_strike" },
    { id: "shadow", name: "Shadowdancer", blurb: "Here, then gone, then behind you.", grantsAbility: "smoke_bomb" },
  ],
  cleric: [
    { id: "light", name: "Cleric of Light", blurb: "Radiance that scours the unclean.", grantsAbility: "holy_nova" },
    { id: "war", name: "War Priest", blurb: "Faith with a mace in its hand.", grantsAbility: "guiding_bolt" },
  ],
  ranger: [
    { id: "marksman", name: "Marksman", blurb: "One arrow, one breath, many targets.", grantsAbility: "volley" },
    { id: "warden", name: "Beast Warden", blurb: "The wild fights at your side.", grantsAbility: "hunters_mark" },
  ],
  bard: [
    { id: "satirist", name: "Satirist", blurb: "Words that wound deeper than blades.", grantsAbility: "vicious_mock" },
    { id: "valor", name: "Bard of Valor", blurb: "A battle-hymn that lifts the whole party.", grantsAbility: "inspire" },
  ],
  paladin: [
    { id: "vengeance", name: "Oath of Vengeance", blurb: "Relentless punishment of the wicked.", grantsAbility: "divine_smite" },
    { id: "devotion", name: "Oath of Devotion", blurb: "A shield for the faithful.", grantsAbility: "shield_wall" },
  ],
  druid: [
    { id: "thorns", name: "Circle of Thorns", blurb: "The wild bites back, hard.", grantsAbility: "thorn_lash" },
    { id: "storm", name: "Storm Caller", blurb: "Calls the lightning down.", grantsAbility: "frost_nova" },
  ],
  monk: [
    { id: "open_hand", name: "Way of the Open Hand", blurb: "Precise, paralyzing strikes.", grantsAbility: "stunning_strike" },
    { id: "tempest", name: "Way of the Tempest", blurb: "A storm of fists no foe can weather.", grantsAbility: "flurry" },
  ],
  necromancer: [
    { id: "bone_lord", name: "Bone Lord", blurb: "Wards of bone and a battlefield raised again.", grantsAbility: "raise_fallen" },
    { id: "lich", name: "Lich Acolyte", blurb: "Death magic that scours whole ranks.", grantsAbility: "corpse_blast" },
  ],
};

export function getSubclasses(klass: ClassId): SubclassDef[] {
  return SUBCLASSES[klass] ?? [];
}

// ── Items ──
export const ITEMS: Record<string, ItemDef> = {
  // Weapons
  longsword: { id: "longsword", name: "Longsword", kind: "weapon", desc: "A reliable blade of pitted steel.", damage: [1, 8], damageBonus: 1, value: 18 },
  twin_daggers: { id: "twin_daggers", name: "Twin Daggers", kind: "weapon", desc: "Quick blades that reward a hidden approach.", damage: [2, 4], damageBonus: 0, value: 16 },
  oak_staff: { id: "oak_staff", name: "Oak Staff", kind: "weapon", desc: "A focus for the shattered weave.", damage: [1, 6], damageBonus: 0, value: 14 },
  warhammer: { id: "warhammer", name: "Warhammer", kind: "weapon", desc: "Holy weight, brought down hard.", damage: [1, 10], damageBonus: 0, value: 20 },
  longbow: { id: "longbow", name: "Longbow", kind: "weapon", desc: "Yew and sinew, death at a distance.", damage: [1, 8], damageBonus: 1, value: 22 },
  rusted_axe: { id: "rusted_axe", name: "Rusted Axe", kind: "weapon", desc: "Crude, but it bites.", damage: [1, 6], damageBonus: 0, value: 6 },
  shard_blade: { id: "shard_blade", name: "Shardglass Blade", kind: "weapon", desc: "A blade grown from a sliver of Aethyr. It hums.", damage: [2, 6], damageBonus: 2, value: 120 },

  // Armor
  robes: { id: "robes", name: "Arcane Robes", kind: "armor", desc: "Woven with faint protective sigils.", ac: 1, value: 10 },
  leather_armor: { id: "leather_armor", name: "Leather Armor", kind: "armor", desc: "Supple and quiet.", ac: 2, value: 16 },
  chainmail: { id: "chainmail", name: "Chainmail", kind: "armor", desc: "Interlocked rings, heavy and sure.", ac: 4, value: 35 },
  plate_armor: { id: "plate_armor", name: "Riven Plate", kind: "armor", desc: "Battered full plate from a fallen knight.", ac: 6, value: 90 },

  // Potions
  potion_minor: { id: "potion_minor", name: "Minor Healing Draught", kind: "potion", desc: "Restores 12 HP.", heal: 12, value: 12, stackable: true },
  potion_greater: { id: "potion_greater", name: "Greater Healing Draught", kind: "potion", desc: "Restores 30 HP.", heal: 30, value: 30, stackable: true },
  potion_mana: { id: "potion_mana", name: "Vial of Weave", kind: "potion", desc: "Restores 10 MP.", restoreMp: 10, value: 15, stackable: true },

  // Trinkets / quest
  lockpicks: { id: "lockpicks", name: "Lockpicks", kind: "trinket", desc: "For doors that prefer to stay shut.", value: 8 },
  iron_key: { id: "iron_key", name: "Iron Key", kind: "key", desc: "Cold, heavy, and clearly important.", value: 0 },
  lumen_charm: { id: "lumen_charm", name: "Lumen Charm", kind: "trinket", desc: "A warm light that steadies the heart. +1 max HP per level when carried.", value: 40 },
  aethyr_shard: { id: "aethyr_shard", name: "Shard of Aethyr", kind: "shard", desc: "A fragment of the world's broken heart. Gather them all.", value: 0 },

  // ── The Dungeon Crawl (game-show dungeon) ──
  // Weapons
  foam_bat: { id: "foam_bat", name: "Foam Cosplay Bat", kind: "weapon", desc: "Technically a weapon. The crowd loves it.", damage: [1, 6], damageBonus: 0, value: 6 },
  riot_baton: { id: "riot_baton", name: "Confiscated Riot Baton", kind: "weapon", desc: "Standard-issue crowd persuasion.", damage: [1, 8], damageBonus: 1, value: 18 },
  nail_bat: { id: "nail_bat", name: "Bat With Nails In It", kind: "weapon", desc: "Someone's pride and joy. Now yours.", damage: [1, 10], damageBonus: 1, value: 26 },
  railgun_pistol: { id: "railgun_pistol", name: "Sponsored Railgun Pistol", kind: "weapon", desc: "Fires a slug at an unreasonable speed. Ad plays on reload.", damage: [2, 6], damageBonus: 2, value: 120 },
  // Armor
  hazmat_suit: { id: "hazmat_suit", name: "Hazmat Onesie", kind: "armor", desc: "Crinkly, hot, and weirdly protective.", ac: 2, value: 16 },
  kevlar_vest: { id: "kevlar_vest", name: "Kevlar Vest", kind: "armor", desc: "Looted from a former SWAT enthusiast.", ac: 4, value: 35 },
  power_armor: { id: "power_armor", name: "Knockoff Power Armor", kind: "armor", desc: "Servos whine; the brand decal is peeling.", ac: 6, value: 90 },
  // Consumables
  energy_drink: { id: "energy_drink", name: "Sponsor's Energy Drink", kind: "potion", desc: "Restores 12 HP. Tastes like blue.", heal: 12, value: 12, stackable: true },
  stim_pack: { id: "stim_pack", name: "Battlefield Stim-Pack", kind: "potion", desc: "Restores 30 HP. Do not exceed one. (You will.)", heal: 30, value: 30, stackable: true },
  nano_serum: { id: "nano_serum", name: "Nootropic Nano-Serum", kind: "potion", desc: "Restores 12 Weave/mana. Side effects: clarity.", restoreMp: 12, value: 15, stackable: true },
  // Trinkets / quest
  keycard: { id: "keycard", name: "Maintenance Keycard", kind: "key", desc: "Opens doors that the System forgot to lock.", value: 0 },
  loot_token: { id: "loot_token", name: "Bronze Loot Token", kind: "trinket", desc: "Redeemable at any Black Market terminal.", value: 10, stackable: true },
  sponsor_pin: { id: "sponsor_pin", name: "Sponsor Pin", kind: "trinket", desc: "A flair of corporate favor. The crowd notices you more.", value: 40 },

  // Accessory bases (affixes/perks are rolled onto instances by lib/game/loot.ts)
  ring: { id: "ring", name: "Ring", kind: "ring", desc: "A band of worked metal, faintly enchanted.", value: 20 },
  amulet: { id: "amulet", name: "Amulet", kind: "amulet", desc: "A pendant that hums with worn power.", value: 25 },

  // A rare consumable that revives a downed ally (non-necromancers' only option).
  revive_kit: { id: "revive_kit", name: "Revivify Salts", kind: "potion", desc: "Smelling salts laced with life-magic — revives a fallen ally to 25% HP.", value: 60, stackable: true },
};

// ── Abilities ──
export const ABILITIES: Record<string, AbilityDef> = {
  power_strike: {
    id: "power_strike", name: "Power Strike", desc: "A heavy blow. 2d8 + STR damage.",
    mpCost: 3, cooldown: 2, target: "enemy",
    effect: { type: "damage", dice: [2, 8] }, scalesWith: "str",
  },
  rally: {
    id: "rally", name: "Rally", desc: "Steel your nerves. +3 attack for 3 turns.",
    mpCost: 2, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "attack", amount: 3, turns: 3 },
  },
  firebolt: {
    id: "firebolt", name: "Firebolt", desc: "A lance of flame. 2d6 + INT fire damage.",
    mpCost: 3, cooldown: 0, target: "enemy",
    effect: { type: "damage", dice: [2, 6], element: "fire" }, scalesWith: "int",
  },
  frost_nova: {
    id: "frost_nova", name: "Frost Nova", desc: "Ice erupts. 2d4 + INT to ALL enemies.",
    mpCost: 5, cooldown: 3, target: "all-enemies",
    effect: { type: "damage", dice: [2, 4], element: "frost" }, scalesWith: "int",
  },
  mend: {
    id: "mend", name: "Mend", desc: "Knit your wounds. Heal 16 HP.",
    mpCost: 4, cooldown: 2, target: "self",
    effect: { type: "heal", amount: 16 },
  },
  backstab: {
    id: "backstab", name: "Backstab", desc: "Strike a vital point. 3d6 + DEX damage.",
    mpCost: 4, cooldown: 3, target: "enemy",
    effect: { type: "damage", dice: [3, 6] }, scalesWith: "dex",
  },
  smoke_bomb: {
    id: "smoke_bomb", name: "Smoke Bomb", desc: "Vanish in smoke. +4 armor for 2 turns.",
    mpCost: 3, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "ac", amount: 4, turns: 2 },
  },
  smite: {
    id: "smite", name: "Smite", desc: "Holy fire. 2d8 + WIS radiant damage.",
    mpCost: 4, cooldown: 2, target: "enemy",
    effect: { type: "damage", dice: [2, 8], element: "radiant" }, scalesWith: "wis",
  },
  heal_wounds: {
    id: "heal_wounds", name: "Heal Wounds", desc: "Channel the divine. Heal 24 HP.",
    mpCost: 5, cooldown: 2, target: "self",
    effect: { type: "heal", amount: 24 },
  },
  bless: {
    id: "bless", name: "Bless", desc: "Divine favor. +2 attack for 3 turns.",
    mpCost: 3, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "attack", amount: 2, turns: 3 },
  },
  aimed_shot: {
    id: "aimed_shot", name: "Aimed Shot", desc: "A perfect arrow. 2d8 + DEX damage.",
    mpCost: 3, cooldown: 1, target: "enemy",
    effect: { type: "damage", dice: [2, 8] }, scalesWith: "dex",
  },
  hunters_mark: {
    id: "hunters_mark", name: "Hunter's Mark", desc: "Mark your prey. +3 attack for 3 turns.",
    mpCost: 2, cooldown: 3, target: "self",
    effect: { type: "buff", stat: "attack", amount: 3, turns: 3 },
  },

  // ── Bard ──
  vicious_mock: {
    id: "vicious_mock", name: "Vicious Mockery", desc: "A cutting insult. 2d6 + CHA psychic damage.",
    mpCost: 3, cooldown: 0, target: "enemy",
    effect: { type: "damage", dice: [2, 6], element: "psychic" }, scalesWith: "cha",
  },
  inspire: {
    id: "inspire", name: "Inspiration", desc: "A rousing verse. +3 attack for 3 turns.",
    mpCost: 3, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "attack", amount: 3, turns: 3 },
  },
  // ── Paladin ──
  divine_smite: {
    id: "divine_smite", name: "Divine Smite", desc: "Holy wrath through your weapon. 2d8 + STR radiant.",
    mpCost: 4, cooldown: 2, target: "enemy",
    effect: { type: "damage", dice: [2, 8], element: "radiant" }, scalesWith: "str",
  },
  lay_hands: {
    id: "lay_hands", name: "Lay on Hands", desc: "Channel healing light. Heal 22 HP.",
    mpCost: 4, cooldown: 2, target: "self",
    effect: { type: "heal", amount: 22 },
  },
  // ── Druid ──
  thorn_lash: {
    id: "thorn_lash", name: "Thorn Lash", desc: "Whip of living bramble. 2d6 + WIS damage.",
    mpCost: 3, cooldown: 0, target: "enemy",
    effect: { type: "damage", dice: [2, 6] }, scalesWith: "wis",
  },
  regrowth: {
    id: "regrowth", name: "Regrowth", desc: "Nature mends you. Heal 20 HP.",
    mpCost: 4, cooldown: 2, target: "self",
    effect: { type: "heal", amount: 20 },
  },
  // ── Monk ──
  flurry: {
    id: "flurry", name: "Flurry of Blows", desc: "A blur of strikes. 3d4 + DEX damage.",
    mpCost: 3, cooldown: 1, target: "enemy",
    effect: { type: "damage", dice: [3, 4] }, scalesWith: "dex",
  },
  focus: {
    id: "focus", name: "Inner Focus", desc: "Center yourself. +3 attack for 3 turns.",
    mpCost: 2, cooldown: 3, target: "self",
    effect: { type: "buff", stat: "attack", amount: 3, turns: 3 },
  },

  // ── Subclass signature abilities ──
  reckless_blow: {
    id: "reckless_blow", name: "Reckless Blow", desc: "All-out attack. 3d6 + STR damage.",
    mpCost: 4, cooldown: 3, target: "enemy",
    effect: { type: "damage", dice: [3, 6] }, scalesWith: "str",
  },
  shield_wall: {
    id: "shield_wall", name: "Shield Wall", desc: "Brace behind your guard. +5 armor for 2 turns.",
    mpCost: 3, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "ac", amount: 5, turns: 2 },
  },
  venom_strike: {
    id: "venom_strike", name: "Venom Strike", desc: "A poisoned blade. 2d8 + DEX damage, plus poison.",
    mpCost: 4, cooldown: 2, target: "enemy",
    effect: { type: "damage", dice: [2, 8], element: "poison", applies: { type: "poison", turns: 3, magnitude: 3 } }, scalesWith: "dex",
  },
  arcane_surge: {
    id: "arcane_surge", name: "Arcane Surge", desc: "Raw force unleashed. 3d6 + INT damage.",
    mpCost: 5, cooldown: 2, target: "enemy",
    effect: { type: "damage", dice: [3, 6], element: "force" }, scalesWith: "int",
  },
  holy_nova: {
    id: "holy_nova", name: "Holy Nova", desc: "Radiance erupts. 2d6 + WIS to ALL enemies.",
    mpCost: 5, cooldown: 3, target: "all-enemies",
    effect: { type: "damage", dice: [2, 6], element: "radiant" }, scalesWith: "wis",
  },
  guiding_bolt: {
    id: "guiding_bolt", name: "Guiding Bolt", desc: "A lance of light. 2d8 + WIS radiant.",
    mpCost: 4, cooldown: 1, target: "enemy",
    effect: { type: "damage", dice: [2, 8], element: "radiant" }, scalesWith: "wis",
  },
  volley: {
    id: "volley", name: "Volley", desc: "A rain of arrows. 2d4 + DEX to ALL enemies.",
    mpCost: 5, cooldown: 3, target: "all-enemies",
    effect: { type: "damage", dice: [2, 4] }, scalesWith: "dex",
  },
  stunning_strike: {
    id: "stunning_strike", name: "Stunning Strike", desc: "A precise nerve strike. 2d6 + DEX damage; may stun.",
    mpCost: 3, cooldown: 3, target: "enemy",
    effect: { type: "damage", dice: [2, 6], applies: { type: "stun", turns: 1, magnitude: 0 } }, scalesWith: "dex",
  },

  // ── Necromancer ──
  bone_spear: {
    id: "bone_spear", name: "Bone Spear", desc: "A shard of bone, hurled. 2d6 + INT damage.",
    mpCost: 3, cooldown: 0, target: "enemy",
    effect: { type: "damage", dice: [2, 6] }, scalesWith: "int",
  },
  life_drain: {
    id: "life_drain", name: "Life Drain", desc: "Siphon vitality. Deal 14 and heal half.",
    mpCost: 4, cooldown: 2, target: "enemy",
    effect: { type: "drain", amount: 14 },
  },
  raise_fallen: {
    id: "raise_fallen", name: "Raise the Fallen", desc: "Drag a downed ally back to their feet (24 HP). Once per day.",
    mpCost: 8, cooldown: 0, target: "ally",
    effect: { type: "revive", amount: 24 }, dayCooldown: 1,
  },
  bone_armor: {
    id: "bone_armor", name: "Bone Armor", desc: "A lattice of bone. +4 armor for 3 turns.",
    mpCost: 3, cooldown: 4, target: "self",
    effect: { type: "buff", stat: "ac", amount: 4, turns: 3 },
  },
  corpse_blast: {
    id: "corpse_blast", name: "Corpse Blast", desc: "Detonate necrotic energy. 2d6 + INT to ALL enemies.",
    mpCost: 5, cooldown: 3, target: "all-enemies",
    effect: { type: "damage", dice: [2, 6], element: "necrotic" }, scalesWith: "int",
  },
};

export function getItem(id: string): ItemDef {
  const item = ITEMS[id];
  if (!item) throw new Error(`Unknown item: ${id}`);
  return item;
}

export function getAbility(id: string): AbilityDef {
  const a = ABILITIES[id];
  if (!a) throw new Error(`Unknown ability: ${id}`);
  return a;
}
