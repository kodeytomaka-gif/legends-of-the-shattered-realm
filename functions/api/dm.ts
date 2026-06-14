// Cloudflare Pages Function: POST /api/dm
//
// Powers the optional AI Dungeon Master. It uses Cloudflare Workers AI when the
// `AI` binding is configured for the Pages project; otherwise it returns an empty
// body and the game falls back to its built-in narration. No external API keys
// are required for the default (Workers AI) path.

interface Env {
  AI?: {
    run: (
      model: string,
      input: { messages: { role: string; content: string }[]; max_tokens?: number; temperature?: number }
    ) => Promise<{ response?: string }>;
  };
  DM_MODEL?: string;
}

interface DmRequest {
  mode?: "embellish" | "ask";
  hero?: string;
  scene?: string;
  region?: string;
  recent?: string;
  question?: string;
}

const SYSTEM = `You are the Dungeon Master for "Legends of the Shattered Realm", a dark-fantasy RPG.
The world was broken by the Sundering; the hero seeks the three Shards of Aethyr to mend or claim it.
Voice: evocative, second person ("you"), present tense, grounded high-fantasy.
Rules:
- Respond with 1-3 vivid sentences. Never exceed 70 words.
- Never invent new mechanics, loot, stats, deaths, or scene transitions. You add atmosphere only.
- Never write the player's decisions for them or ask them to "choose 1/2/3".
- Stay consistent with the provided scene and recent events.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export const onRequestPost: (ctx: { request: Request; env: Env }) => Promise<Response> = async ({
  request,
  env,
}) => {
  let req: DmRequest;
  try {
    req = (await request.json()) as DmRequest;
  } catch {
    return json({ text: "" }, 400);
  }

  // No AI binding configured — let the client use its built-in narration.
  if (!env.AI) return json({ text: "" });

  const context = [
    req.hero ? `Hero: ${req.hero}.` : "",
    req.region ? `Region: ${req.region}.` : "",
    req.scene ? `Current scene: ${req.scene}.` : "",
    req.recent ? `Recently: ${req.recent}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userContent =
    req.mode === "ask"
      ? `${context}\n\nThe player says or asks: "${(req.question ?? "").slice(0, 400)}"\nReply in-fiction as the DM, describing what they notice or hear. Do not change the game state.`
      : `${context}\n\nAdd one short atmospheric beat to deepen this moment. Do not repeat the text verbatim.`;

  try {
    const model = env.DM_MODEL || "@cf/meta/llama-3.1-8b-instruct";
    const result = await env.AI.run(model, {
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userContent },
      ],
      max_tokens: 160,
      temperature: 0.85,
    });
    const text = (result.response ?? "").trim();
    return json({ text });
  } catch {
    return json({ text: "" });
  }
};
