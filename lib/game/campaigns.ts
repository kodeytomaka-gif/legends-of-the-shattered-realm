import type { Scene } from "./scene";
import { SHATTERED_SCENES, SHATTERED_START } from "./story";
import { CRAWL_SCENES, CRAWL_START } from "./crawl";

export interface Campaign {
  id: string;
  title: string;
  tagline: string;
  blurb: string;
  startScene: string;
  // Voice the AI Dungeon Master adopts for this campaign.
  persona: string;
  // Subsets the AI may reference for free-form actions (flavor only; the engine
  // still validates every effect against the global guardrail union).
  aiItems: string[];
  aiEnemies: string[];
}

const FANTASY_PERSONA = `You are the Dungeon Master for "Legends of the Shattered Realm", a dark-fantasy RPG.
The world was broken by the Sundering; the hero seeks the three Shards of Aethyr to mend or claim it.
Voice: evocative, second person ("you"), present tense, grounded high-fantasy.`;

const SYSTEM_PERSONA = `You are "the System", the snarky AI host narrating "The Dungeon Crawl", a deadly LitRPG game-show dungeon beneath a ruined Earth.
Voice: second person ("you"), present tense, dry and sarcastic, darkly comic, corporate-dystopian — like a sportscaster who finds your suffering ratings-friendly. Keep it cheeky, PG-13 (mild language at most), never mean-spirited toward the player for real.`;

export const CAMPAIGNS: Campaign[] = [
  {
    id: "shattered",
    title: "Legends of the Shattered Realm",
    tagline: "Dark fantasy · gather the Shards of Aethyr",
    blurb:
      "The world broke in the Sundering. Forge a hero, claim three Shards of Aethyr, and decide whether to mend the realm or rule it.",
    startScene: SHATTERED_START,
    persona: FANTASY_PERSONA,
    aiItems: ["potion_minor", "potion_mana", "rusted_axe", "lockpicks", "lumen_charm"],
    aiEnemies: ["wolf", "goblin", "bandit", "skeleton"],
  },
  {
    id: "crawl",
    title: "The Dungeon Crawl",
    tagline: "LitRPG game-show dungeon · survive the descent",
    blurb:
      "Earth got cancelled for redevelopment. Now you're a Crawler on a monetized death-dungeon game show. Descend, get loot, win the crowd, and outlive the host.",
    startScene: CRAWL_START,
    persona: SYSTEM_PERSONA,
    aiItems: ["energy_drink", "nano_serum", "foam_bat", "hazmat_suit", "loot_token"],
    aiEnemies: ["camera_drone", "feral_neighbor", "vending_mimic", "gym_bro"],
  },
];

// Global guardrail union: every item/enemy the AI may ever produce, across all
// campaigns. The engine validates against these — all are intentionally low-tier.
export const AI_ITEM_UNION: string[] = Array.from(
  new Set(CAMPAIGNS.flatMap((c) => c.aiItems))
);
export const AI_ENEMY_UNION: string[] = Array.from(
  new Set(CAMPAIGNS.flatMap((c) => c.aiEnemies))
);

const ALL_SCENES: Scene[] = [...SHATTERED_SCENES, ...CRAWL_SCENES];

export const SCENES: Record<string, Scene> = Object.fromEntries(
  ALL_SCENES.map((s) => [s.id, s])
);

export function getScene(id: string): Scene {
  const scene = SCENES[id];
  if (!scene) throw new Error(`Unknown scene: ${id}`);
  return scene;
}

export function getCampaign(id: string | undefined): Campaign {
  return CAMPAIGNS.find((c) => c.id === id) ?? CAMPAIGNS[0];
}
