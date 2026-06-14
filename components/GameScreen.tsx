"use client";

import { useState } from "react";
import type { GameState } from "@/lib/game/types";
import { getScene } from "@/lib/game/campaigns";
import { currentAllySeat } from "@/lib/game/combat";
import HeroBar from "@/components/HeroBar";
import StoryLog from "@/components/StoryLog";
import CombatPanel from "@/components/CombatPanel";
import CharacterSheet from "@/components/CharacterSheet";

export interface GameHandlers {
  onChoose: (choiceId: string) => void;
  onAttack: (target: number) => void;
  onAbility: (id: string, target: number) => void;
  onItem: (id: string) => void;
  onFlee: () => void;
  onUsePotion: (itemId: string, seat: number) => void;
  onEquip: (itemId: string, seat: number) => void;
  onAct?: (text: string) => void; // free-form AI action
  onExit: () => void;
}

export default function GameScreen({
  state,
  handlers,
  canAct,
  mySeat,
  aiEnabled,
  aiBusy,
  exitLabel = "☰ Menu",
}: {
  state: GameState;
  handlers: GameHandlers;
  canAct: boolean; // is the local client allowed to act right now
  mySeat?: number; // online: this client's seat (for labelling); omit for local
  aiEnabled: boolean;
  aiBusy: boolean;
  exitLabel?: string;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [action, setAction] = useState("");

  const scene = getScene(state.sceneId);
  const choices = state.phase === "exploring" ? scene.choices(state) : [];
  const activeSeat = state.phase === "combat" ? currentAllySeat(state) : state.turnPlayer;
  const multi = state.party.length > 1;
  const activeName = state.party[activeSeat]?.name ?? state.party[0]?.name ?? "";

  const turnNote =
    mySeat === undefined
      ? multi
        ? `▸ ${activeName}'s turn — pass the device`
        : ""
      : activeSeat === mySeat
        ? "▸ Your turn"
        : `Waiting for ${activeName}…`;

  function submitAct(e: React.FormEvent) {
    e.preventDefault();
    if (!action.trim() || aiBusy || !handlers.onAct || state.phase !== "exploring" || !canAct) return;
    handlers.onAct(action.trim());
    setAction("");
  }

  return (
    <main className="mx-auto flex h-[100dvh] max-w-3xl flex-col gap-3 px-4 py-4">
      <div className="flex items-center justify-between gap-2">
        <button onClick={handlers.onExit} className="ghost-btn !px-3 text-sm">{exitLabel}</button>
        <span className="truncate font-display text-sm text-gold-400/80">{scene.title}</span>
        <button onClick={() => setSheetOpen(true)} className="ghost-btn !px-3 text-sm">Party</button>
      </div>

      <HeroBar state={state} activeSeat={activeSeat} />

      <section className="rune-card flex min-h-0 flex-1 flex-col !p-4">
        <StoryLog log={state.log} busy={aiBusy} />
      </section>

      <section className="shrink-0">
        {state.phase === "exploring" && turnNote && (
          <p className="mb-2 text-center text-xs font-display text-gold-300">{turnNote}</p>
        )}

        {state.phase === "exploring" && (
          <div className="grid grid-cols-1 gap-2">
            {choices.map((c) => {
              if (c.show && !c.show(state)) return null;
              const label = typeof c.label === "function" ? c.label(state) : c.label;
              const hint = typeof c.hint === "function" ? c.hint(state) : c.hint;
              const enabled = (c.enabled ? c.enabled(state) : true) && canAct;
              return (
                <button key={c.id} className="choice-btn" disabled={!enabled} onClick={() => handlers.onChoose(c.id)}>
                  <span>{label}</span>
                  {hint && <span className="mt-0.5 block text-xs text-parchment-300/50">{hint}</span>}
                </button>
              );
            })}
          </div>
        )}

        {state.phase === "combat" && (
          <CombatPanel
            state={state}
            canAct={canAct}
            disabled={aiBusy}
            onAttack={handlers.onAttack}
            onAbility={handlers.onAbility}
            onItem={handlers.onItem}
            onFlee={handlers.onFlee}
          />
        )}

        {state.phase === "gameover" && (
          <div className="rune-card text-center">
            <h2 className="font-display text-2xl text-ember-400">The Party Falls</h2>
            <p className="mt-2 text-parchment-200/80">Your tale ends here… for now.</p>
            <div className="mt-4 flex justify-center gap-3">
              <button className="gold-btn" onClick={handlers.onExit}>Main Menu</button>
            </div>
          </div>
        )}

        {state.phase === "victory" && (
          <div className="rune-card text-center">
            <h2 className="font-display text-2xl text-gold-400">Victory</h2>
            <p className="mt-2 text-parchment-200/80">Your story is complete. The final words are written above.</p>
            <div className="mt-4 flex justify-center gap-3">
              <button className="gold-btn" onClick={handlers.onExit}>Main Menu</button>
            </div>
          </div>
        )}

        {aiEnabled && handlers.onAct && state.phase === "exploring" && (
          <form onSubmit={submitAct} className="mt-2">
            <div className="flex gap-2">
              <input
                className="input"
                placeholder={canAct ? "Or do anything… (search, pray, set a trap, talk your way out)" : "Wait for your turn to act…"}
                value={action}
                onChange={(e) => setAction(e.target.value)}
                disabled={aiBusy || !canAct}
                maxLength={200}
              />
              <button className="gold-btn shrink-0" disabled={aiBusy || !action.trim() || !canAct}>
                {aiBusy ? "…" : "Act"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-parchment-300/40">The Dungeon Master improvises a unique outcome.</p>
          </form>
        )}
      </section>

      {sheetOpen && (
        <CharacterSheet
          state={state}
          onClose={() => setSheetOpen(false)}
          onUsePotion={handlers.onUsePotion}
          onEquip={handlers.onEquip}
        />
      )}
    </main>
  );
}
