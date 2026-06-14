"use client";

import { useEffect, useRef } from "react";
import type { LogEntry, LogKind } from "@/lib/game/types";

const STYLES: Record<LogKind, string> = {
  dm: "text-parchment-100 leading-relaxed",
  narration: "text-parchment-100 italic leading-relaxed",
  player: "text-gold-300 font-display",
  system: "text-gold-400/90",
  combat: "text-ember-400/90",
  roll: "text-arcane-400/90 text-sm font-mono",
  loot: "text-moss-400",
  level: "text-gold-300 font-display",
};

export default function StoryLog({ log, busy }: { log: LogEntry[]; busy?: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log.length, busy]);

  return (
    <div className="scroll-thin flex-1 space-y-2.5 overflow-y-auto pr-2">
      {log.map((entry) => (
        <p key={entry.id} className={`animate-fade-in ${STYLES[entry.kind]}`}>
          {entry.kind === "dm" || entry.kind === "narration" ? entry.text : <span>{entry.text}</span>}
        </p>
      ))}
      {busy && (
        <p className="animate-pulse text-sm text-parchment-300/50">The Dungeon Master considers…</p>
      )}
      <div ref={endRef} />
    </div>
  );
}
