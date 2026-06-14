import type { AbilityKey, Abilities } from "./types";

export function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export function rollDice(count: number, sides: number): number {
  let total = 0;
  for (let i = 0; i < count; i++) total += roll(sides);
  return total;
}

export function rollRange([min, max]: [number, number]): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function abilityMod(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function modString(mod: number): string {
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export interface CheckResult {
  d20: number;
  mod: number;
  total: number;
  dc: number;
  success: boolean;
  crit: "hit" | "miss" | null;
}

export function abilityCheck(
  abilities: Abilities,
  key: AbilityKey,
  dc: number,
  extra = 0
): CheckResult {
  const d20 = roll(20);
  const mod = abilityMod(abilities[key]) + extra;
  const total = d20 + mod;
  const crit = d20 === 20 ? "hit" : d20 === 1 ? "miss" : null;
  const success = crit === "hit" ? true : crit === "miss" ? false : total >= dc;
  return { d20, mod, total, dc, success, crit };
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function chance(p: number): boolean {
  return Math.random() < p;
}
