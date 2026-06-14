"use client";

import { useEffect, useRef, useState } from "react";
import type { GameState, RollMeta } from "@/lib/game/types";
import { getScene } from "@/lib/game/campaigns";
import { currentAllySeat } from "@/lib/game/combat";
import { loadSettings, saveSettings } from "@/lib/game/save";
import HeroBar from "@/components/HeroBar";
import StoryLog from "@/components/StoryLog";
import CombatPanel from "@/components/CombatPanel";
import CharacterSheet from "@/components/CharacterSheet";
import DiceOverlay from "@/components/DiceOverlay";
import SceneBackground from "@/components/SceneBackground";

function speakable(kind: string): boolean {
  return kind === "dm" || kind === "narration" || kind === "level";
}
function stripForSpeech(text: string): string {
  return text.replace(/[⚜✦⚔🎲➤★⬇💀🛡⦿]/gu, "").replace(/\s+/g, " ").trim();
}

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
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dice, setDice] = useState(true);
  const [narrate, setNarrate] = useState(false);
  const [confirm, setConfirm] = useState<{ id: string; text: string } | null>(null);

  const lastRollId = useRef<string | null>(null);
  const [pendingRoll, setPendingRoll] = useState<RollMeta | null>(null);
  const spoken = useRef<Set<string>>(new Set());
  const narratePrimed = useRef(false);

  // Load dice/narrate preferences once.
  useEffect(() => {
    const s = loadSettings();
    setDice(s.dice);
    setNarrate(s.narrate);
  }, []);

  // Surface a tap-to-roll animation when a new skill-check roll appears.
  useEffect(() => {
    const rolls = state.log.filter((l) => l.roll);
    const latest = rolls[rolls.length - 1];
    if (!latest) return;
    if (lastRollId.current === null) {
      lastRollId.current = latest.id; // don't replay history on mount
      return;
    }
    if (latest.id !== lastRollId.current) {
      lastRollId.current = latest.id;
      if (dice && latest.roll) setPendingRoll(latest.roll);
    }
  }, [state.log, dice]);

  // Read narration aloud (browser text-to-speech).
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!narrate) {
      window.speechSynthesis.cancel();
      return;
    }
    if (!narratePrimed.current) {
      // First enable: skip the backlog, only read what comes next.
      state.log.forEach((l) => spoken.current.add(l.id));
      narratePrimed.current = true;
      return;
    }
    for (const entry of state.log) {
      if (spoken.current.has(entry.id)) continue;
      spoken.current.add(entry.id);
      if (!speakable(entry.kind)) continue;
      const text = stripForSpeech(entry.text);
      if (!text) continue;
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.97;
      u.pitch = 0.95;
      window.speechSynthesis.speak(u);
    }
  }, [state.log, narrate]);

  // Stop speaking when leaving.
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); }, []);

  function toggleDice() {
    const v = !dice;
    setDice(v);
    saveSettings({ ...loadSettings(), dice: v });
  }
  function toggleNarrate() {
    const v = !narrate;
    setNarrate(v);
    if (!v && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (v) narratePrimed.current = false; // re-prime so we don't dump backlog
    saveSettings({ ...loadSettings(), narrate: v });
  }

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
    <>
    <SceneBackground campaignId={state.campaignId} region={scene.region ?? ""} />
    {pendingRoll && <DiceOverlay roll={pendingRoll} onDone={() => setPendingRoll(null)} />}
    {confirm && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={() => setConfirm(null)}>
        <div className="rune-card max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
          <p className="text-parchment-100">{confirm.text}</p>
          <div className="mt-5 flex justify-center gap-3">
            <button
              className="gold-btn"
              onClick={() => {
                const id = confirm.id;
                setConfirm(null);
                handlers.onChoose(id);
              }}
            >
              Yes, do it
            </button>
            <button className="ghost-btn" onClick={() => setConfirm(null)}>Never mind</button>
          </div>
        </div>
      </div>
    )}
    <main className="mx-auto flex h-[100dvh] max-w-3xl flex-col gap-3 px-4 py-4">
      <div className="relative flex items-center justify-between gap-2">
        <button onClick={handlers.onExit} className="ghost-btn !px-3 text-sm">{exitLabel}</button>
        <span className="truncate font-display text-sm text-gold-400/80">{scene.title}</span>
        <div className="flex items-center gap-2">
          <button onClick={() => setSettingsOpen((o) => !o)} className="ghost-btn !px-3 text-sm" title="Settings">⚙</button>
          <button onClick={() => setSheetOpen(true)} className="ghost-btn !px-3 text-sm">Party</button>
        </div>
        {settingsOpen && (
          <div className="absolute right-0 top-11 z-30 w-56 rounded-lg border border-gold-400/30 bg-ink-800 p-3 shadow-rune">
            <p className="mb-2 font-display text-sm text-gold-400">Settings</p>
            <label className="mb-2 flex cursor-pointer items-center justify-between text-sm text-parchment-200/85">
              <span>🎲 Dice animation</span>
              <input type="checkbox" checked={dice} onChange={toggleDice} className="h-4 w-4 accent-gold-400" />
            </label>
            <label className="flex cursor-pointer items-center justify-between text-sm text-parchment-200/85">
              <span>🔊 Read aloud</span>
              <input type="checkbox" checked={narrate} onChange={toggleNarrate} className="h-4 w-4 accent-gold-400" />
            </label>
            <p className="mt-2 text-[11px] text-parchment-300/50">Read-aloud uses your device&apos;s voice.</p>
          </div>
        )}
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
              const confirmText = typeof c.confirm === "function" ? c.confirm(state) : c.confirm;
              return (
                <button
                  key={c.id}
                  className="choice-btn"
                  disabled={!enabled}
                  onClick={() => (confirmText ? setConfirm({ id: c.id, text: confirmText }) : handlers.onChoose(c.id))}
                >
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
    </>
  );
}
