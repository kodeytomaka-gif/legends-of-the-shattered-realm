import type { ClassId, RaceId } from "./types";

// Lightweight, asset-free visual identity: a class glyph framed in a race color.

export const CLASS_GLYPH: Record<ClassId, string> = {
  warrior: "⚔",
  mage: "✦",
  rogue: "🗡",
  cleric: "✚",
  ranger: "🏹",
  bard: "♪",
  paladin: "🛡",
  druid: "🌿",
  monk: "✊",
  necromancer: "💀",
};

export const RACE_COLOR: Record<RaceId, string> = {
  human: "#d4af37",
  elf: "#7faa5f",
  dwarf: "#b8902a",
  orc: "#e0532b",
  halfling: "#9b7bd4",
};

const ENEMY_GLYPH: Record<string, string> = {
  goblin: "👺", wolf: "🐺", bandit: "🗡", skeleton: "💀", cultist: "🕯", ogre: "👹",
  wraith: "👻", shard_warden: "🗿", sundered_king: "👑",
  camera_drone: "📹", feral_neighbor: "📋", vending_mimic: "🥤", gym_bro: "💪",
  floor_manager: "🦺", compliance_officer: "🤖", the_showrunner: "🎙",
};

export function enemyGlyph(id: string): string {
  return ENEMY_GLYPH[id] ?? "☠";
}
