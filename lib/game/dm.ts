import type { GameState } from "./types";
import { RACES, CLASSES } from "./content";
import { getScene, getCampaign } from "./campaigns";

// Client helper for the AI Dungeon Master (Cloudflare Worker endpoint).
// Everything here degrades gracefully: if the endpoint is missing or errors,
// callers get `null`/empty and the game's built-in narration stands on its own.

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
  const active = s.party[Math.min(s.turnPlayer, s.party.length - 1)] ?? s.party[0];
  const roster = s.party
    .map((c) => `${c.name} (Lv ${c.level} ${RACES[c.race].name} ${CLASSES[c.klass].name}, HP ${c.hp}/${c.maxHp}${c.hp <= 0 ? ", DOWNED" : ""})`)
    .join("; ");
  if (s.party.length === 1) {
    return `${roster}. Gold ${s.gold}, ${s.shards}/3 Shards of Aethyr.`;
  }
  return `Party of ${s.party.length}: ${roster}. Acting hero: ${active.name}. Shared gold ${s.gold}, ${s.shards}/3 Shards.`;
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
    persona: getCampaign(s.campaignId).persona,
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
    persona: getCampaign(s.campaignId).persona,
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
  const campaign = getCampaign(s.campaignId);
  const raw = await callDm({
    mode: "act",
    persona: campaign.persona,
    hero: heroSummary(s),
    scene: scene.title,
    region: scene.region ?? "",
    recent: recentNarration(s, 6),
    action,
    allowedItems: campaign.aiItems,
    allowedEnemies: campaign.aiEnemies,
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
