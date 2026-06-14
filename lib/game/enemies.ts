import type { Enemy } from "./types";

type EnemyTemplate = Omit<Enemy, "hp" | "maxHp"> & { hp: number };

const TEMPLATES: Record<string, EnemyTemplate> = {
  goblin: {
    id: "goblin", name: "Goblin Scavenger", desc: "A wiry thing with too many teeth and a stolen knife.",
    hp: 12, ac: 11, attack: 2, damage: [1, 6], damageBonus: 0, xp: 40, goldDrop: [2, 8],
    lootTable: [{ itemId: "rusted_axe", chance: 0.2 }, { itemId: "potion_minor", chance: 0.15 }],
  },
  wolf: {
    id: "wolf", name: "Shadowmane Wolf", desc: "Its eyes catch a light that isn't there.",
    hp: 14, ac: 12, attack: 3, damage: [1, 6], damageBonus: 0, xp: 65, goldDrop: [0, 3],
  },
  bandit: {
    id: "bandit", name: "Road Bandit", desc: "Desperate, armed, and not interested in talking.",
    hp: 18, ac: 12, attack: 3, damage: [1, 6], damageBonus: 1, xp: 55, goldDrop: [6, 18],
    lootTable: [{ itemId: "leather_armor", chance: 0.2 }, { itemId: "potion_minor", chance: 0.25 }],
  },
  skeleton: {
    id: "skeleton", name: "Risen Skeleton", desc: "Bone bound by the Sundering's spite.",
    hp: 16, ac: 13, attack: 3, damage: [1, 6], damageBonus: 1, xp: 65, goldDrop: [3, 10],
    lootTable: [{ itemId: "iron_key", chance: 0.12 }],
  },
  cultist: {
    id: "cultist", name: "Shard Cultist", desc: "Robed and chanting, eyes glassy with devotion.",
    hp: 22, ac: 12, attack: 4, damage: [1, 8], damageBonus: 1, xp: 70, goldDrop: [8, 20],
    lootTable: [{ itemId: "potion_mana", chance: 0.3 }, { itemId: "robes", chance: 0.15 }],
  },
  ogre: {
    id: "ogre", name: "Wasteland Ogre", desc: "A mountain of grey muscle that smells of rot.",
    hp: 55, ac: 13, attack: 5, damage: [2, 6], damageBonus: 2, xp: 150, goldDrop: [15, 40],
    lootTable: [{ itemId: "potion_greater", chance: 0.35 }, { itemId: "plate_armor", chance: 0.15 }],
    abilities: [{ name: "Ground Slam", kind: "aoe", dice: [1, 8], bonus: 1, chance: 0.3 }],
  },
  wraith: {
    id: "wraith", name: "Hollow Wraith", desc: "A wound in the air shaped like a person who is gone.",
    hp: 45, ac: 14, attack: 5, damage: [1, 8], damageBonus: 2, xp: 140, goldDrop: [10, 25],
    lootTable: [{ itemId: "lumen_charm", chance: 0.3 }, { itemId: "potion_greater", chance: 0.3 }],
    abilities: [{ name: "Life Drain", kind: "heavy", dice: [2, 6], bonus: 2, lifesteal: true, chance: 0.35 }],
  },
  shard_warden: {
    id: "shard_warden", name: "Warden of the Shard", desc: "A construct of stone and shardglass, ancient and patient.",
    hp: 50, ac: 14, attack: 4, damage: [2, 6], damageBonus: 2, xp: 160, goldDrop: [30, 60],
    lootTable: [{ itemId: "shard_blade", chance: 0.4 }, { itemId: "potion_greater", chance: 0.5 }],
    abilities: [{ name: "Shard Burst", kind: "aoe", dice: [1, 6], bonus: 1, chance: 0.25 }],
  },
  sundered_king: {
    id: "sundered_king", name: "The Sundered King", desc: "The one who broke the world, wearing a crown of floating shards.",
    hp: 120, ac: 15, attack: 7, damage: [2, 8], damageBonus: 4, xp: 600, goldDrop: [80, 150],
    abilities: [
      { name: "Cataclysm", kind: "aoe", dice: [2, 6], bonus: 2, chance: 0.28 },
      { name: "Shatterbind", kind: "status", status: "stun", turns: 1, magnitude: 0, chance: 0.16 },
    ],
  },

  // ── The Dungeon Crawl (stats mirror the tuned fantasy tiers) ──
  camera_drone: {
    id: "camera_drone", name: "Camera Drone", desc: "A hovering eye live-streaming your every mistake.",
    hp: 12, ac: 11, attack: 2, damage: [1, 6], damageBonus: 0, xp: 40, goldDrop: [2, 8],
    lootTable: [{ itemId: "loot_token", chance: 0.3 }],
  },
  feral_neighbor: {
    id: "feral_neighbor", name: "Feral HOA Treasurer", desc: "Still clutching a clipboard. Still furious about your lawn.",
    hp: 18, ac: 12, attack: 3, damage: [1, 6], damageBonus: 1, xp: 55, goldDrop: [6, 18],
    lootTable: [{ itemId: "hazmat_suit", chance: 0.2 }, { itemId: "energy_drink", chance: 0.25 }],
  },
  vending_mimic: {
    id: "vending_mimic", name: "Mimic Vending Machine", desc: "It accepts no coins and dispenses only violence.",
    hp: 16, ac: 13, attack: 3, damage: [1, 6], damageBonus: 1, xp: 65, goldDrop: [3, 10],
    lootTable: [{ itemId: "keycard", chance: 0.12 }, { itemId: "energy_drink", chance: 0.3 }],
  },
  gym_bro: {
    id: "gym_bro", name: "Roid-Rage Gym Bro", desc: "Skipped leg day, not arm day. You will learn this firsthand.",
    hp: 22, ac: 12, attack: 4, damage: [1, 8], damageBonus: 1, xp: 70, goldDrop: [8, 20],
    lootTable: [{ itemId: "nano_serum", chance: 0.3 }, { itemId: "riot_baton", chance: 0.15 }],
  },
  floor_manager: {
    id: "floor_manager", name: "The Floor Manager", desc: "A bloated bureaucrat-thing in a dented hardhat, here to enforce 'quotas'.",
    hp: 55, ac: 13, attack: 5, damage: [2, 6], damageBonus: 2, xp: 150, goldDrop: [15, 40],
    lootTable: [{ itemId: "stim_pack", chance: 0.35 }, { itemId: "power_armor", chance: 0.15 }],
    abilities: [{ name: "Stapler Barrage", kind: "aoe", dice: [1, 8], bonus: 1, chance: 0.3 }],
  },
  compliance_officer: {
    id: "compliance_officer", name: "Compliance Officer", desc: "Chrome, patient, and authorized to use lethal customer service.",
    hp: 50, ac: 14, attack: 4, damage: [2, 6], damageBonus: 2, xp: 160, goldDrop: [30, 60],
    lootTable: [{ itemId: "railgun_pistol", chance: 0.4 }, { itemId: "stim_pack", chance: 0.5 }],
    abilities: [{ name: "Taser Protocol", kind: "status", status: "stun", turns: 1, magnitude: 0, chance: 0.2 }],
  },
  the_showrunner: {
    id: "the_showrunner", name: "The Showrunner", desc: "The smiling host of the whole bloody program, wearing a headset and your future.",
    hp: 120, ac: 15, attack: 7, damage: [2, 8], damageBonus: 4, xp: 600, goldDrop: [80, 150],
    abilities: [
      { name: "Pyro Finale", kind: "aoe", dice: [2, 6], bonus: 2, chance: 0.26 },
      { name: "Ad Break", kind: "status", status: "stun", turns: 1, magnitude: 0, chance: 0.16 },
    ],
  },
};

export function spawnEnemy(id: string, scale = 0): Enemy {
  const t = TEMPLATES[id];
  if (!t) throw new Error(`Unknown enemy: ${id}`);
  const hpBoost = Math.round(t.hp * 0.12 * scale);
  const hp = t.hp + hpBoost;
  return {
    ...t,
    hp,
    maxHp: hp,
    attack: t.attack + Math.floor(scale / 2),
    lootTable: t.lootTable ? t.lootTable.map((l) => ({ ...l })) : undefined,
  };
}

export function enemyExists(id: string): boolean {
  return id in TEMPLATES;
}
