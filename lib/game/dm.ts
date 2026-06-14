import type { GameState } from "./types";
import { RACES, CLASSES } from "./content";
import { getScene } from "./story";

// Client helper for the AI Dungeon Master (Cloudflare Pages Function).
// Everything here degrades gracefully: if the endpoint is missing or errors,
// callers get `null`/empty and the game's built-in narration stands on its own.

// Guardrails: the only things the AI is allowed to hand out or throw at the
// player through free-form actions. The engine re-validates these server-of-truth
// side before applying anything.
export const AI_ITEM_ALLOW = [
  "potion_minor",
  "potion_mana",
  "rusted_axe",
  "lockpicks",
  "lumen_charm",
] as const;

export const AI_ENEMY_ALLOW = ["wolf", "goblin", "bandit", "skeleton"] as const;

export type AiEffect =
  | { type: "none" }
  | { type: "heal"; amount: number }
  | { type: "hurt"; amount: number }
  | { type: "gold"; amount: number }
  | { type: "xp"; amount: number }
  | { type: "item"; id: string }
  | { type: "combat"; enemies: string[] };

export interface AiAction {
  narration: string;
  effects: AiEffect[];
}

function heroSummary(s: GameState): string {
  const c = s.character;
  return `${c.name}, a level ${c.level} ${RACES[c.race].name} ${CLASSES[c.klass].name} (HP ${c.hp}/${c.maxHp}, Weave ${c.mp}/${c.maxMp}, ${c.shards}/3 Shards of Aethyr)`;
}

function recentNarration(s: GameState, n = 4): string {
  return s.log
    .filter((l) => l.kind === "dm" || l.kind === "narration")
    .slice(-n)
    .map((l) => l.text)
    .join(" ");
}

async function callDm(payload: unknown): Promise<string | null> {
  try {
    const res = await fetch("/api/dm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? "").trim();
    return text.length ? text : null;
  } catch {
    return null;
  }
}

// Ask the AI DM to add an atmospheric beat to the current scene.
export async function embellishScene(s: GameState): Promise<string | null> {
  const scene = getScene(s.sceneId);
  return callDm({
    mode: "embellish",
    hero: heroSummary(s),
    scene: scene.title,
    region: scene.region ?? "",
    recent: recentNarration(s),
  });
}

// Player asks the DM a free-form question / makes an in-fiction remark.
export async function askDm(s: GameState, question: string): Promise<string | null> {
  const scene = getScene(s.sceneId);
  return callDm({
    mode: "ask",
    hero: heroSummary(s),
    scene: scene.title,
    region: scene.region ?? "",
    recent: recentNarration(s, 6),
    question,
  });
}

// Pull the first balanced JSON object out of a model response.
function extractJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
    } else if (ch === '"') inStr = true;
    else if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Player attempts a free-form action; the DM narrates and may apply effects.
// Returns a parsed {narration, effects}. If the model returns prose instead of
// JSON, we still surface it as narration with no effects. Returns null only when
// the endpoint is unavailable.
export async function actDm(s: GameState, action: string): Promise<AiAction | null> {
  const scene = getScene(s.sceneId);
  const raw = await callDm({
    mode: "act",
    hero: heroSummary(s),
    scene: scene.title,
    region: scene.region ?? "",
    recent: recentNarration(s, 6),
    action,
    allowedItems: [...AI_ITEM_ALLOW],
    allowedEnemies: [...AI_ENEMY_ALLOW],
  });
  if (raw === null) return null;

  const jsonStr = extractJson(raw);
  if (!jsonStr) return { narration: raw, effects: [] };

  try {
    const parsed = JSON.parse(jsonStr) as Partial<AiAction>;
    const narration =
      typeof parsed.narration === "string" && parsed.narration.trim().length
        ? parsed.narration.trim()
        : raw.replace(jsonStr, "").trim() || "You act.";
    const effects = Array.isArray(parsed.effects) ? (parsed.effects as AiEffect[]) : [];
    return { narration, effects };
  } catch {
    return { narration: raw, effects: [] };
  }
}
