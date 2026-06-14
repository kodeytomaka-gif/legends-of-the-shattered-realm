# Legends of the Shattered Realm

A browser-based dark-fantasy RPG with an **AI Dungeon Master**. Forge a hero,
gather the three Shards of Aethyr, and decide whether to **mend** the broken
world — or **claim** it for yourself.

The entire game runs in the browser and saves to your device. It ships as a
static site (Next.js static export) served by a **Cloudflare Worker with Static
Assets**; the same Worker exposes a single `/api/dm` endpoint that powers the AI
narration via Workers AI. No database, accounts, or servers to run.

---

## Play

```bash
npm install
npm run dev        # http://localhost:3000
```

- **Choose an adventure** — two campaigns share the same hero system:
  - **Legends of the Shattered Realm** — dark fantasy; gather three Shards of
    Aethyr and decide whether to mend the world or rule it.
  - **The Dungeon Crawl** — a snarky-AI LitRPG game-show dungeon (original
    homage to the genre): descend monetized floors, crack loot boxes, win the
    crowd, and outlive the host.
- **Forge Your Hero** — pick a lineage (Human, Elf, Dwarf, Orc, Halfling) and a
  calling (Warrior, Mage, Rogue, Cleric, Ranger), then spend points across the
  six abilities.
- **Adventure** — a scene-driven campaign with skill checks (d20 + ability
  modifier), branching choices, and a hub-and-spokes map: a village with a
  merchant and inn, three Shard regions, and a final confrontation.
- **Fight** — turn-based combat with class abilities, mana ("Weave"), potions,
  and the option to flee. Bosses are fixed-difficulty set-pieces; trash mobs
  scale with your level, and you can always withdraw to grind, rest, or shop.
- **Two endings** — mend the realm, or take the throne.

Your progress autosaves to `localStorage`. Use **Continue** on the title screen
to resume.

### The AI Dungeon Master (on by default)

The AI DM makes every playthrough different. When enabled (the default — toggle
it on the title screen) it provides:
- **unique narration for every scene**, freshly written each run, and
- a **free-form action box**: type anything you imagine ("search the ruins for a
  secret door", "pray to the fractured god", "set a trap and wait") and the DM
  improvises the outcome.

Crucially, the AI can apply *real consequences* — minor healing or damage, small
amounts of loot/gold/XP, or a surprise encounter — but every effect is
re-validated and clamped by the game engine (`applyAiAction` in
`lib/game/engine.ts`). The model **cannot** grant Shards, hand out endgame gear,
spawn bosses, exceed safe numeric ranges, teleport you, or end the game. The
scripted campaign always remains underneath as a guaranteed, completable path.

It calls the `/api/dm` Pages Function, which uses **Cloudflare Workers AI**
(default model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, configurable via the
`DM_MODEL` env var). If the AI binding isn't configured, the game silently falls
back to its rich built-in narration — every scene still reads well without it.

---

## Deploy to Cloudflare

This deploys as a **Worker with Static Assets**. `next build` writes the static
site to `./out`; `wrangler deploy` uploads those assets and the Worker
(`src/index.ts`) together. The `AI` binding is declared in `wrangler.toml`, so
Workers AI is provisioned automatically — **no dashboard step or API keys.**

### Option A — Wrangler CLI

```bash
npm install
npm run deploy        # runs: next build && wrangler deploy
```

### Option B — Connect the Git repo (Cloudflare Workers Builds)

Connect this repository to a Worker in the Cloudflare dashboard and use:

| Setting        | Value             |
| -------------- | ----------------- |
| Build command  | `npm run build`   |
| Deploy command | `npx wrangler deploy` |

Every push to the production branch then builds and deploys automatically. The
Worker name in `wrangler.toml` (`legends-of-the-shattered-realm`) must match the
connected Worker.

To change the AI model, set a `DM_MODEL` variable (defaults to
`@cf/meta/llama-3.3-70b-instruct-fp8-fast`).

---

## Project layout

```
app/                 Next.js App Router pages (title, character creation, play)
components/          UI: HeroBar, StoryLog, CombatPanel, CharacterSheet
lib/game/            The game engine (pure TypeScript, framework-agnostic)
  types.ts             core domain types
  content.ts           races, classes, items, abilities
  enemies.ts           enemy templates + scaling
  character.ts         creation, derived stats, leveling
  dice.ts              dice + ability checks
  combat.ts            turn-based combat resolution
  scene.ts / story.ts  the scene-graph campaign + the context API it's written against
  engine.ts            orchestration: enter scenes, run choices, drive combat
  save.ts              localStorage persistence
  dm.ts                AI DM client (talks to /api/dm, degrades gracefully)
src/index.ts         Cloudflare Worker: serves static assets + /api/dm (Workers AI)
```

The game logic in `lib/game/` has no React or Next dependencies, which keeps it
testable and portable.

---

## Tech

Next.js 15 (static export) · React 19 · TypeScript · Tailwind CSS ·
Cloudflare Pages + Workers AI.
