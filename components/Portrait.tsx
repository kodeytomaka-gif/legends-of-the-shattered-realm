"use client";

import type { ClassId, RaceId } from "@/lib/game/types";
import { CLASS_GLYPH, RACE_COLOR } from "@/lib/game/art";

// A class glyph in a race-tinted frame — the hero's avatar.
export default function Portrait({
  race,
  klass,
  size = 36,
  dimmed,
  active,
}: {
  race: RaceId;
  klass: ClassId;
  size?: number;
  dimmed?: boolean;
  active?: boolean;
}) {
  const color = RACE_COLOR[race];
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-md border ${active ? "shadow-glow" : ""}`}
      style={{
        width: size,
        height: size,
        borderColor: color,
        background: `radial-gradient(circle at 50% 30%, ${color}22, rgba(12,10,7,0.85))`,
        opacity: dimmed ? 0.5 : 1,
        fontSize: size * 0.5,
        lineHeight: 1,
      }}
      title={`${race} ${klass}`}
    >
      <span style={{ filter: "drop-shadow(0 1px 1px rgba(0,0,0,0.6))" }}>{CLASS_GLYPH[klass]}</span>
    </span>
  );
}

export function EnemyArt({ glyph, size = 28 }: { glyph: string; size?: number }) {
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-md border border-ember-400/40"
      style={{ width: size, height: size, fontSize: size * 0.55, background: "radial-gradient(circle at 50% 30%, rgba(224,83,43,0.18), rgba(12,10,7,0.85))" }}
    >
      {glyph}
    </span>
  );
}
