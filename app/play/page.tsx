"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { GameState } from "@/lib/game/types";
import {
  chooseOption,
  combatAttack,
  combatAbility,
  combatItem,
  combatFlee,
  useItemExploring,
  equipItem,
  appendNarration,
  applyAiAction,
} from "@/lib/game/engine";
import { loadGame, saveGame, loadSettings } from "@/lib/game/save";
import { embellishScene, actDm } from "@/lib/game/dm";
import GameScreen from "@/components/GameScreen";

export default function PlayPage() {
  const router = useRouter();
  const [state, setState] = useState<GameState | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [aiDm, setAiDm] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const lastEmbellished = useRef<string>("");

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

  const commit = useCallback((next: GameState) => {
    setState(next);
    saveGame(next);
  }, []);

  // Unique AI narration on each new scene.
  useEffect(() => {
    if (!state || !aiDm || state.phase !== "exploring") return;
    const key = `${state.sceneId}#${state.shards}#${state.turnPlayer}`;
    if (lastEmbellished.current === key) return;
    lastEmbellished.current = key;

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

  async function onAct(text: string) {
    if (!state) return;
    const withEcho: GameState = {
      ...state,
      log: [...state.log, { id: `act_${Date.now()}`, kind: "player", text: `➤ ${text}`, ts: Date.now() }],
    };
    commit(withEcho);
    setAiBusy(true);
    const result = await actDm(state, text);
    setAiBusy(false);
    setState((cur) => {
      if (!cur) return cur;
      const next = result
        ? applyAiAction(cur, result)
        : { ...cur, log: [...cur.log, { id: `actn_${Date.now()}`, kind: "system" as const, text: "(The Dungeon Master is silent — AI isn't enabled here. Use the choices below.)", ts: Date.now() }] };
      saveGame(next);
      return next;
    });
  }

  return (
    <GameScreen
      state={state}
      canAct
      aiEnabled={aiDm}
      aiBusy={aiBusy}
      handlers={{
        onChoose: (id) => commit(chooseOption(state, id)),
        onAttack: (t) => commit(combatAttack(state, t)),
        onAbility: (id, t) => commit(combatAbility(state, id, t)),
        onItem: (id) => commit(combatItem(state, id)),
        onFlee: () => commit(combatFlee(state)),
        onUsePotion: (id, seat) => commit(useItemExploring(state, id, seat)),
        onEquip: (id, seat) => commit(equipItem(state, id, seat)),
        onAct,
        onExit: () => router.push("/"),
      }}
    />
  );
}
