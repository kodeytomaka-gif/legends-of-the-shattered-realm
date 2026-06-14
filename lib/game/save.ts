import type { GameState } from "./types";
import { SAVE_VERSION } from "./engine";

const KEY = "lotsr_save_v1";
const SETTINGS_KEY = "lotsr_settings_v1";

export interface Settings {
  aiDm: boolean;
}

export function loadGame(): GameState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as GameState;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or unavailable — fail quietly */
  }
}

export function clearSave(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function hasSave(): boolean {
  return loadGame() !== null;
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { aiDm: true };
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { aiDm: true };
    return { aiDm: true, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { aiDm: true };
  }
}

export function saveSettings(s: Settings): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}
