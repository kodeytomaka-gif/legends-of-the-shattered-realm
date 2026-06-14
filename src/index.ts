// Cloudflare Worker entry point (Workers + Static Assets model).
//
// Static game files in `out/` are served by the [assets] binding. This Worker
// only runs for requests that don't match a static file — namely the AI
// Dungeon Master endpoint POST /api/dm. Everything else is delegated to assets.
//
// The AI DM uses Cloudflare Workers AI via the `AI` binding (declared in
// wrangler.toml, so it is provisioned automatically on deploy — no dashboard
// step or API keys required). If the binding is absent, the endpoint returns an
// empty body and the game falls back to its built-in narration.

interface AiBinding {
  run: (
    model: string,
    input: {
      messages: { role: string; content: string }[];
      max_tokens?: number;
      temperature?: number;
    }
  ) => Promise<{ response?: string }>;
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  AI?: AiBinding;
  DM_MODEL?: string;
  GAME_ROOM: DurableObjectNamespace;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}
interface DurableObjectId {
  toString(): string;
}
interface DurableObjectStub {
  fetch(request: Request): Promise<Response>;
}

export { GameRoom } from "./room";

interface DmRequest {
  mode?: "embellish" | "ask" | "act";
  persona?: string;
  hero?: string;
  scene?: string;
  region?: string;
  recent?: string;
  question?: string;
  action?: string;
  allowedItems?: string[];
  allowedEnemies?: string[];
}

const DEFAULT_PERSONA = `You are the Dungeon Master for "Legends of the Shattered Realm", a dark-fantasy RPG.
The world was broken by the Sundering; the hero seeks the three Shards of Aethyr to mend or claim it.
Voice: evocative, second person ("you"), present tense, grounded high-fantasy.`;

const PROSE_RULES = `Rules:
- Respond with 1-3 vivid sentences. Never exceed 70 words.
- Never invent new mechanics, loot, stats, deaths, or scene transitions. Atmosphere only.
- Never write the player's decisions for them or list numbered choices.
- Stay consistent with the provided scene and recent events.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

function buildContext(req: DmRequest): string {
  return [
    req.hero ? `Hero: ${req.hero}.` : "",
    req.region ? `Region: ${req.region}.` : "",
    req.scene ? `Current scene: ${req.scene}.` : "",
    req.recent ? `Recently: ${req.recent}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

async function handleDm(request: Request, env: Env): Promise<Response> {
  let req: DmRequest;
  try {
    req = (await request.json()) as DmRequest;
  } catch {
    return json({ text: "" }, 400);
  }

  if (!env.AI) return json({ text: "" });

  const context = buildContext(req);
  const base = (req.persona ?? "").trim() || DEFAULT_PERSONA;
  let system = `${base}\n${PROSE_RULES}`;
  let userContent: string;
  let maxTokens = 160;

  if (req.mode === "act") {
    const items = (req.allowedItems ?? []).join(", ") || "(none)";
    const enemies = (req.allowedEnemies ?? []).join(", ") || "(none)";
    system = `${base}
You adjudicate a free-form player action and reply with STRICT JSON only — no prose, no markdown, no code fences.
Schema: {"narration": string, "effects": Effect[]}
Each Effect is one of:
  {"type":"none"}
  {"type":"heal","amount":<1-12>}
  {"type":"hurt","amount":<1-12>}
  {"type":"gold","amount":<-15..15>}
  {"type":"xp","amount":<0..25>}
  {"type":"item","id":<one of: ${items}>}
  {"type":"combat","enemies":[<up to 2 of: ${enemies}>]}
Guidelines:
- "narration": 1-3 sentences (<=70 words), second person, vivid, reacting to what the player tried.
- Pick effects that fit the fiction and the action. Most actions deserve 0-1 effects; many deserve {"type":"none"}.
- Reward cleverness modestly; punish recklessness with minor "hurt"; a hostile or risky action may trigger "combat".
- NEVER grant Shards, end the game, move the hero to another location, or exceed the numeric ranges.
- Only use item ids and enemy ids from the lists above. If unsure, use {"type":"none"}.
Return ONLY the JSON object.`;
    userContent = `${context}\n\nThe player attempts: "${(req.action ?? "").slice(0, 400)}"`;
    maxTokens = 280;
  } else if (req.mode === "ask") {
    userContent = `${context}\n\nThe player says or asks: "${(req.question ?? "").slice(0, 400)}"\nReply in-fiction as the DM, describing what they notice or hear. Do not change the game state.`;
  } else {
    userContent = `${context}\n\nAdd one short, fresh atmospheric beat to deepen this moment. Vary your imagery; do not repeat the scene text verbatim.`;
  }

  try {
    const model = env.DM_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
      max_tokens: maxTokens,
      temperature: req.mode === "act" ? 0.7 : 0.9,
    });
    return json({ text: (result.response ?? "").trim() });
  } catch {
    return json({ text: "" });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/dm") {
      if (request.method !== "POST") return json({ text: "" }, 405);
      return handleDm(request, env);
    }
    // Online co-op rooms: /api/room/<CODE>/ws  ->  the room's Durable Object.
    const room = url.pathname.match(/^\/api\/room\/([A-Za-z0-9]{1,8})\/ws$/);
    if (room) {
      const id = env.GAME_ROOM.idFromName(room[1].toUpperCase());
      return env.GAME_ROOM.get(id).fetch(request);
    }
    // Not an API route — serve the static game.
    return env.ASSETS.fetch(request);
  },
};
