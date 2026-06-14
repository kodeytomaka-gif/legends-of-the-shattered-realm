import type { AbilityKey, GameState, Rarity } from "./types";
import type { CheckResult } from "./dice";

// The toolbox a scene/choice uses to affect the world. Implemented by the engine.
export interface SceneContext {
  state: GameState;
  log: (text: string) => void; // narration from the DM
  say: (text: string) => void; // a system/aside line
  check: (ability: AbilityKey, dc: number, extra?: number) => CheckResult;
  goto: (sceneId: string) => void;
  combat: (
    enemyIds: string[],
    opts: { onWin: string; onFlee?: string; scale?: number; intro?: string }
  ) => void;
  give: (itemId: string, qty?: number) => void;
  // Roll and grant an enchanted gear instance (rarity/affixes) into the party's gear.
  giveGear: (itemId: string, opts?: { tier?: number; rarity?: Rarity }) => void;
  take: (itemId: string, qty?: number) => boolean;
  has: (itemId: string) => boolean;
  gold: (delta: number) => void;
  heal: (amount: number) => void;
  hurt: (amount: number) => void;
  restoreMp: (amount: number) => void;
  restParty: () => void; // fully restore HP & Weave for the whole party
  addShard: () => void;
  xp: (amount: number) => void;
  setFlag: (key: string, value?: boolean | number | string) => void;
  getFlag: (key: string) => boolean | number | string | undefined;
  bumpFlag: (key: string, by?: number) => number;
}

export interface Choice {
  id: string;
  label: string | ((s: GameState) => string);
  hint?: string | ((s: GameState) => string | undefined);
  show?: (s: GameState) => boolean;
  enabled?: (s: GameState) => boolean;
  // If set, the UI shows an "are you sure?" popup with this text before running.
  confirm?: string | ((s: GameState) => string | undefined);
  run: (ctx: SceneContext) => void;
}

export interface Scene {
  id: string;
  title: string;
  region?: string;
  // Narration shown on entry. Returned string(s) are added to the log as DM narration.
  text: (s: GameState) => string | string[];
  // Optional side effects the first time the scene is entered.
  onEnter?: (ctx: SceneContext) => void;
  choices: (s: GameState) => Choice[];
  // Whether the AI DM may embellish this scene's narration.
  aiEmbellish?: boolean;
}
