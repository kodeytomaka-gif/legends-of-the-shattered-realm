"use client";

import { useEffect, useRef, useState } from "react";
import type { RollMeta } from "@/lib/game/types";

export default function DiceOverlay({ roll, onDone }: { roll: RollMeta; onDone: () => void }) {
  const [phase, setPhase] = useState<"ready" | "rolling" | "done">("ready");
  const [face, setFace] = useState(20);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  function rollDie() {
    if (phase !== "ready") return;
    setPhase("rolling");
    let ticks = 0;
    const spin = setInterval(() => {
      setFace(1 + Math.floor(Math.random() * 20));
      ticks++;
      if (ticks > 14) {
        clearInterval(spin);
        setFace(roll.d20);
        setPhase("done");
        timers.current.push(setTimeout(onDone, 1700));
      }
    }, 55);
  }

  const isCrit = roll.crit === "hit";
  const isFumble = roll.crit === "miss";
  const color =
    phase !== "done"
      ? "text-gold-300 border-gold-400/70"
      : roll.success
        ? "text-moss-400 border-moss-400/70"
        : "text-ember-400 border-ember-400/70";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={phase === "done" ? onDone : undefined}
    >
      {roll.label && (
        <p className="mb-2 font-display text-lg tracking-wide text-gold-400/90">{roll.label} check · DC {roll.dc}</p>
      )}

      <button
        onClick={rollDie}
        disabled={phase !== "ready"}
        className={`relative grid h-40 w-40 place-items-center transition ${phase === "ready" ? "cursor-pointer hover:scale-105" : ""}`}
        aria-label="Roll the die"
      >
        {/* d20 shape */}
        <svg viewBox="0 0 100 100" className={`absolute inset-0 h-full w-full drop-shadow-[0_0_22px_rgba(212,175,55,0.45)] ${phase === "rolling" ? "animate-spin" : ""}`} style={{ animationDuration: "0.5s" }}>
          <polygon
            points="50,4 92,28 92,72 50,96 8,72 8,28"
            className={`fill-ink-800 stroke-2 ${color.split(" ")[1]}`}
          />
          <polygon points="50,4 92,28 50,50 8,28" className="fill-white/5" />
          <polygon points="92,28 92,72 50,50" className="fill-black/20" />
        </svg>
        <span className={`relative font-display text-5xl font-bold tabular-nums ${color.split(" ")[0]}`}>{face}</span>
      </button>

      {phase === "ready" && (
        <p className="mt-6 animate-pulse font-display text-xl text-parchment-100">Tap the die to roll</p>
      )}
      {phase === "rolling" && <p className="mt-6 font-display text-xl text-parchment-300/70">Rolling…</p>}
      {phase === "done" && (
        <div className="mt-5 text-center animate-fade-in">
          <p className="font-display text-2xl">
            <span className="text-parchment-100">{roll.d20}</span>
            <span className="text-parchment-300/60"> {roll.mod >= 0 ? "+" : ""}{roll.mod} = </span>
            <span className={color.split(" ")[0]}>{roll.total}</span>
            <span className="text-parchment-300/60"> vs {roll.dc}</span>
          </p>
          <p className={`mt-1 font-display text-3xl font-bold tracking-wide ${color.split(" ")[0]}`}>
            {isCrit ? "CRITICAL!" : isFumble ? "FUMBLE!" : roll.success ? "SUCCESS" : "FAILURE"}
          </p>
          <p className="mt-3 text-xs text-parchment-300/50">tap to continue</p>
        </div>
      )}
    </div>
  );
}
