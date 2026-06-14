import type { GameState } from "./types";
import { RACES, CLASSES } from "./content";
import { getScene } from "./story";

// Client helper for the optional AI Dungeon Master (Cloudflare Pages Function).
// Everything here degrades gracefully: if the endpoint is missing or errors,
// callers get `null` and the game's built-in narration stands on its own.

function heroSummary(s: GameState): string {
  const c = s.character;
  return `${c.name}, a level ${c.level} ${RACES[c.race].name} ${CLASSES[c.klass].name} (HP ${c.hp}/${c.maxHp}, ${c.shards}/3 Shards of Aethyr)`;
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
