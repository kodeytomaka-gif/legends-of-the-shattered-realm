"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameState } from "@/lib/game/types";
import { getScene } from "@/lib/game/story";
import {
  chooseOption,
  combatAttack,
  combatAbility,
  combatItem,
  combatFlee,
  useItemExploring,
  equipItem,
  appendNarration,
} from "@/lib/game/engine";
import { loadGame, saveGame, loadSettings } from "@/lib/game/save";
import { embellishScene, askDm } from "@/lib/game/dm";
import HeroBar from "@/components/HeroBar";
import StoryLog from "@/components/StoryLog";
import CombatPanel from "@/components/CombatPanel";
import CharacterSheet from "@/components/CharacterSheet";

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiDm, setAiDm] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [ask, setAsk] = useState("");
  const lastEmbellished = useRef<string>("");

  // Load the saved game once on mount.
  useEffect(() => {
    const g = loadGame();
    if (!g) {
      router.replace("/");
      return;
    }
    setState(g);
    setAiDm(loadSettings().aiDm);
    setLoaded(true);
  }, [router]);

  // Persist on every change.
  const commit = useCallback((next: GameState) => {
    setState(next);
    saveGame(next);
  }, []);

  // Optional AI embellishment when entering a new narrative scene.
  useEffect(() => {
    if (!state || !aiDm) return;
    if (state.phase !== "exploring") return;
    const scene = getScene(state.sceneId);
    if (!scene.aiEmbellish) return;
    if (lastEmbellished.current === state.sceneId) return;
    lastEmbellished.current = state.sceneId;

    let cancelled = false;
    setAiBusy(true);
    embellishScene(state)
      .then((text) => {
        if (!cancelled && text) {
          setState((cur) => {
            if (!cur) return cur;
            const next = appendNarration(cur, text);
            saveGame(next);
            return next;
          });
        }
      })
      .finally(() => !cancelled && setAiBusy(false));

    return () => {
      cancelled = true;
    };
  }, [state, aiDm]);

  if (!loaded || !state) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="animate-flicker font-display text-gold-400">Entering the realm…</p>
      </main>
    );
  }

  const scene = getScene(state.sceneId);
  const choices = state.phase === "exploring" ? scene.choices(state) : [];

  async function submitAsk(e: React.FormEvent) {
    e.preventDefault();
    if (!state || !ask.trim() || aiBusy) return;
    const q = ask.trim();
    setAsk("");
    // Add the player's question to the log immediately.
    setState((cur) => {
      if (!cur) return cur;
      const next: GameState = {
        ...cur,
        log: [...cur.log, { id: `q_${Date.now()}`, kind: "player", text: `❝ ${q} ❞`, ts: Date.now() }],
      };
      saveGame(next);
      return next;
    });
    setAiBusy(true);
    const reply = await askDm(state, q);
    setAiBusy(false);
    if (reply) {
      setState((cur) => {
        if (!cur) return cur;
        const next = appendNarration(cur, reply);
        saveGame(next);
        return next;
      });
    } else {
      setState((cur) => {
        if (!cur) return cur;
        const next: GameState = {
          ...cur,
          log: [...cur.log, { id: `qn_${Date.now()}`, kind: "system", text: "(The DM is silent — AI narration isn't available on this site.)", ts: Date.now() }],
        };
        saveGame(next);
        return next;
      });
    }
  }

  const ended = state.phase === "gameover" || state.phase === "victory";

  return (
    <main className="mx-auto flex h-[100dvh] max-w-3xl flex-col gap-3 px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => router.push("/")} className="ghost-btn !px-3 text-sm">
          ☰ Menu
        </button>
        <span className="truncate font-display text-sm text-gold-400/80">{scene.title}</span>
        <button onClick={() => setSheetOpen(true)} className="ghost-btn !px-3 text-sm">
          Character
        </button>
      </div>

      <HeroBar character={state.character} />

      {/* Story log */}
      <section className="rune-card flex min-h-0 flex-1 flex-col !p-4">
        <StoryLog log={state.log} busy={aiBusy} />
      </section>

      {/* Action area */}
      <section className="shrink-0">
        {state.phase === "exploring" && (
          <div className="grid grid-cols-1 gap-2">
            {choices.map((c) => {
              if (c.show && !c.show(state)) return null;
              const label = typeof c.label === "function" ? c.label(state) : c.label;
              const hint = typeof c.hint === "function" ? c.hint(state) : c.hint;
              const enabled = c.enabled ? c.enabled(state) : true;
              return (
                <button
                  key={c.id}
                  className="choice-btn"
                  disabled={!enabled}
                  onClick={() => commit(chooseOption(state, c.id))}
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
            disabled={aiBusy}
            onAttack={(idx) => commit(combatAttack(state, idx))}
            onAbility={(id, idx) => commit(combatAbility(state, id, idx))}
            onItem={(id) => commit(combatItem(state, id))}
            onFlee={() => commit(combatFlee(state))}
          />
        )}

        {state.phase === "gameover" && (
          <div className="rune-card text-center">
            <h2 className="font-display text-2xl text-ember-400">Your Legend Ends</h2>
            <p className="mt-2 text-parchment-200/80">The realm remains shattered… for now.</p>
            <div className="mt-4 flex justify-center gap-3">
              <button className="gold-btn" onClick={() => router.push("/create")}>
                Forge a New Hero
              </button>
              <button className="ghost-btn" onClick={() => router.push("/")}>
                Main Menu
              </button>
            </div>
          </div>
        )}

        {state.phase === "victory" && (
          <div className="rune-card text-center">
            <h2 className="font-display text-2xl text-gold-400">Victory</h2>
            <p className="mt-2 text-parchment-200/80">
              {state.flags.ending === "king"
                ? "You sit the remade throne. The realm is yours."
                : "The realm is whole again, and you are its quiet legend."}
            </p>
            <div className="mt-4 flex justify-center gap-3">
              <button className="gold-btn" onClick={() => router.push("/create")}>
                Begin Anew
              </button>
              <button className="ghost-btn" onClick={() => router.push("/")}>
                Main Menu
              </button>
            </div>
          </div>
        )}

        {/* Ask-the-DM box */}
        {aiDm && !ended && (
          <form onSubmit={submitAsk} className="mt-2 flex gap-2">
            <input
              className="input"
              placeholder="Speak to the Dungeon Master… (look around, ask a question)"
              value={ask}
              onChange={(e) => setAsk(e.target.value)}
              disabled={aiBusy}
            />
            <button className="ghost-btn shrink-0" disabled={aiBusy || !ask.trim()}>
              Ask
            </button>
          </form>
        )}
      </section>

      {sheetOpen && (
        <CharacterSheet
          state={state}
          onClose={() => setSheetOpen(false)}
          onUsePotion={(id) => commit(useItemExploring(state, id))}
          onEquip={(id) => commit(equipItem(state, id))}
        />
      )}
    </main>
  );
}
