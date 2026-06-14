"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RACES, CLASSES, getSubclasses } from "@/lib/game/content";
import {
  ABILITY_KEYS,
  ABILITY_NAMES,
  type AbilityKey,
  type Abilities,
  type RaceId,
  type ClassId,
} from "@/lib/game/types";
import {
  POINT_BUY_TOTAL,
  POINT_BUY_MIN,
  POINT_BUY_MAX,
  defaultPointBuy,
  totalSpent,
  applyRaceBonuses,
} from "@/lib/game/character";
import { abilityMod, modString } from "@/lib/game/dice";
import { currentAllySeat } from "@/lib/game/combat";
import { CAMPAIGNS } from "@/lib/game/campaigns";
import { loadSettings } from "@/lib/game/save";
import { embellishScene, actDm } from "@/lib/game/dm";
import {
  RoomSession,
  randomRoomCode,
  getPlayerId,
  getPlayerName,
  setPlayerName,
  type RoomState,
} from "@/lib/game/online";
import GameScreen from "@/components/GameScreen";

type Phase = "setup" | "lobby" | "game";

export default function OnlinePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("setup");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [race, setRace] = useState<RaceId>("human");
  const [klass, setKlass] = useState<ClassId>("warrior");
  const [subclass, setSubclass] = useState<string>(getSubclasses("warrior")[0].id);
  const [scores, setScores] = useState<Abilities>(defaultPointBuy);
  const [status, setStatus] = useState("");
  const [room, setRoom] = useState<RoomState | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const sessionRef = useRef<RoomSession | null>(null);
  const playerId = getPlayerId();
  const lastEmbellished = useRef<string>("");

  useEffect(() => {
    setName(getPlayerName());
  }, []);
  useEffect(() => () => sessionRef.current?.close(), []);

  const remaining = POINT_BUY_TOTAL - totalSpent(scores);
  const finalScores = useMemo(() => applyRaceBonuses(scores, race), [scores, race]);
  const aiDm = typeof window !== "undefined" ? loadSettings().aiDm : false;

  function adjust(key: AbilityKey, delta: number) {
    setScores((prev) => {
      const t = prev[key] + delta;
      if (t < POINT_BUY_MIN || t > POINT_BUY_MAX) return prev;
      const trial = { ...prev, [key]: t };
      if (totalSpent(trial) > POINT_BUY_TOTAL) return prev;
      return trial;
    });
  }

  function enterRoom(roomCode: string) {
    const trimmed = name.trim() || "Crawler";
    setPlayerName(trimmed);
    const session = new RoomSession(roomCode, trimmed);
    sessionRef.current = session;
    session.onStatus = (s) => {
      setStatus(s);
      if (s === "open") {
        session.setHero({ name: trimmed, race, klass, subclass, abilities: scores });
      }
    };
    session.onError = (m) => setStatus(m);
    session.onUpdate = (r) => {
      setRoom(r);
      setPhase(r.started && r.game ? "game" : "lobby");
    };
    session.connect();
    setPhase("lobby");
  }

  // Active client drives AI narration for the whole room.
  useEffect(() => {
    const session = sessionRef.current;
    const g = room?.game;
    if (!session || !g || !aiDm || g.phase !== "exploring") return;
    const mySeat = room!.seatMap[playerId] ?? -1;
    if (g.turnPlayer !== mySeat) return;
    const key = `${g.sceneId}#${g.shards}#${g.turnPlayer}`;
    if (lastEmbellished.current === key) return;
    lastEmbellished.current = key;
    let cancelled = false;
    setAiBusy(true);
    embellishScene(g)
      .then((text) => {
        if (!cancelled && text) session.narrate(text);
      })
      .finally(() => !cancelled && setAiBusy(false));
    return () => {
      cancelled = true;
    };
  }, [room, aiDm, playerId]);

  // ── Setup screen ──
  if (phase === "setup") {
    return (
      <main className="mx-auto max-w-3xl px-5 py-10">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="ghost-btn">← Back</Link>
          <h1 className="font-display text-3xl text-gold-400">Online Co-op</h1>
          <div className="w-16" />
        </div>

        <section className="rune-card mb-6 space-y-4">
          <label className="block">
            <span className="mb-1 block font-display tracking-wider text-gold-400">Your Name</span>
            <input className="input max-w-sm" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} placeholder="Crawler" />
          </label>
        </section>

        {/* Hero */}
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rune-card">
            <h2 className="mb-3 font-display text-xl text-gold-400">Lineage</h2>
            <div className="space-y-1.5">
              {(Object.keys(RACES) as RaceId[]).map((id) => (
                <button key={id} onClick={() => setRace(id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${race === id ? "border-gold-400 bg-ink-600/60" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"}`}>
                  <span className="font-display text-parchment-100">{RACES[id].name}</span>
                  <span className="ml-2 text-xs text-gold-400/70">{Object.entries(RACES[id].bonuses).map(([k, v]) => `+${v} ${k.toUpperCase()}`).join(" ")}</span>
                </button>
              ))}
            </div>
          </section>
          <section className="rune-card">
            <h2 className="mb-3 font-display text-xl text-gold-400">Calling</h2>
            <div className="space-y-1.5">
              {(Object.keys(CLASSES) as ClassId[]).map((id) => (
                <button key={id} onClick={() => { setKlass(id); setSubclass(getSubclasses(id)[0].id); }} className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${klass === id ? "border-gold-400 bg-ink-600/60" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"}`}>
                  <span className="font-display text-parchment-100">{CLASSES[id].name}</span>
                  <span className="ml-2 text-xs text-gold-400/70">{ABILITY_NAMES[CLASSES[id].primary]}</span>
                </button>
              ))}
            </div>
            <h3 className="mb-2 mt-4 font-display text-sm text-gold-400/80">Specialization</h3>
            <div className="space-y-1.5">
              {getSubclasses(klass).map((sub) => (
                <button key={sub.id} onClick={() => setSubclass(sub.id)} className={`w-full rounded-md border px-3 py-2 text-left text-sm transition ${subclass === sub.id ? "border-gold-400 bg-ink-600/60" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"}`}>
                  <span className="font-display text-parchment-100">{sub.name}</span>
                  <p className="mt-0.5 text-xs text-parchment-200/70">{sub.blurb}</p>
                </button>
              ))}
            </div>
          </section>
        </div>

        <section className="rune-card mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-xl text-gold-400">Abilities</h2>
            <span className={`rounded-md border px-3 py-1 text-sm ${remaining === 0 ? "border-moss-400/40 text-moss-400" : "border-gold-400/40 text-gold-400"}`}>{remaining} left</span>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ABILITY_KEYS.map((key) => (
              <div key={key} className="rune-panel">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm text-parchment-100">{ABILITY_NAMES[key].slice(0, 3)}</span>
                  <span className="text-xs text-gold-400/70">{modString(abilityMod(finalScores[key]))}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <button onClick={() => adjust(key, -1)} disabled={scores[key] <= POINT_BUY_MIN} className="ghost-btn h-7 w-7 !px-0">−</button>
                  <span className="font-display text-gold-400">{finalScores[key]}</span>
                  <button onClick={() => adjust(key, +1)} disabled={scores[key] >= POINT_BUY_MAX || remaining <= 0} className="ghost-btn h-7 w-7 !px-0">+</button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rune-card mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <h2 className="mb-2 font-display text-lg text-gold-400">Create a Room</h2>
            <p className="mb-3 text-sm text-parchment-200/70">Start a new room and share the code with friends.</p>
            <button className="gold-btn w-full" onClick={() => enterRoom(randomRoomCode())}>Create Room</button>
          </div>
          <div>
            <h2 className="mb-2 font-display text-lg text-gold-400">Join a Room</h2>
            <input className="input mb-3 font-mono uppercase tracking-widest" value={code} maxLength={8} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" />
            <button className="ghost-btn w-full" disabled={code.trim().length < 3} onClick={() => enterRoom(code.trim())}>Join Room</button>
          </div>
        </section>
      </main>
    );
  }

  // ── Lobby screen ──
  if (phase === "lobby") {
    const session = sessionRef.current;
    const isHost = room?.hostId === playerId;
    const heroCount = room?.players.filter((p) => p.hasHero).length ?? 0;
    return (
      <main className="mx-auto max-w-xl px-5 py-12 text-center">
        <h1 className="font-display text-3xl text-gold-400">Room</h1>
        <div className="my-4 inline-block rounded-lg border border-gold-400/40 bg-ink-800/70 px-6 py-3">
          <p className="text-xs uppercase tracking-widest text-parchment-300/60">Share this code</p>
          <p className="font-mono text-4xl tracking-[0.4em] text-gold-300">{sessionRef.current?.code}</p>
        </div>
        <p className="text-sm text-parchment-300/60">{status === "open" ? "Connected" : status === "connecting" ? "Connecting…" : status}</p>

        <div className="rune-card mt-6 text-left">
          <h2 className="mb-3 font-display text-lg text-gold-400">Players ({room?.players.length ?? 0})</h2>
          <ul className="space-y-2">
            {room?.players.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-md border border-gold-400/15 bg-ink-900/40 px-3 py-2">
                <span className="font-display text-parchment-100">
                  {p.name} {p.id === room.hostId && <span className="text-xs text-gold-400/70">(host)</span>} {p.id === playerId && <span className="text-xs text-moss-400">(you)</span>}
                </span>
                <span className="text-xs text-parchment-300/60">
                  {p.online ? "" : "offline · "}{p.hasHero ? `${p.klass ? CLASSES[p.klass].name : "ready"} ✓` : "choosing…"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {isHost ? (
          <div className="rune-card mt-4 text-left">
            <h2 className="mb-2 font-display text-lg text-gold-400">Adventure (host picks)</h2>
            <div className="grid gap-2">
              {CAMPAIGNS.map((c) => (
                <button key={c.id} onClick={() => session?.setCampaign(c.id)} className={`rounded-md border px-3 py-2 text-left text-sm transition ${room?.campaignId === c.id ? "border-gold-400 bg-ink-600/60" : "border-gold-400/20 bg-ink-700/40 hover:border-gold-400/50"}`}>
                  <span className="font-display text-parchment-100">{c.title}</span>
                  <span className="ml-2 text-xs text-gold-400/70">{c.tagline}</span>
                </button>
              ))}
            </div>
            <button className="gold-btn mt-4 w-full" disabled={heroCount === 0} onClick={() => session?.start()}>
              Begin Adventure ({heroCount} {heroCount === 1 ? "hero" : "heroes"})
            </button>
          </div>
        ) : (
          <p className="mt-6 text-parchment-200/70">Waiting for the host to start the adventure…</p>
        )}

        <button className="mt-6 text-sm text-ember-400/70 underline" onClick={() => { sessionRef.current?.close(); router.push("/"); }}>
          Leave room
        </button>
      </main>
    );
  }

  // ── In-game (online) ──
  const session = sessionRef.current!;
  const g = room!.game!;
  const mySeat = room!.seatMap[playerId] ?? -1;
  const activeSeat = g.phase === "combat" ? currentAllySeat(g) : g.turnPlayer;
  const canAct = mySeat >= 0 && mySeat === activeSeat;

  async function onAct(text: string) {
    if (!canAct) return;
    session.narrate(`➤ ${text}`);
    setAiBusy(true);
    const result = await actDm(g, text);
    setAiBusy(false);
    if (result) session.aiAction(result);
  }

  return (
    <GameScreen
      state={g}
      canAct={canAct}
      mySeat={mySeat}
      aiEnabled={aiDm}
      aiBusy={aiBusy}
      handlers={{
        onChoose: (id) => session.action({ kind: "choose", choiceId: id }),
        onAttack: (t) => session.action({ kind: "attack", target: t }),
        onAbility: (id, t) => session.action({ kind: "ability", id, target: t }),
        onItem: (id) => session.action({ kind: "item", id }),
        onFlee: () => session.action({ kind: "flee" }),
        onDefend: () => session.action({ kind: "defend" }),
        onUsePotion: (id, seat) => session.action({ kind: "useItem", itemId: id, seat }),
        onEquip: (uid, seat) => session.action({ kind: "equip", uid, seat }),
        onAct,
        onExit: () => { session.close(); router.push("/"); },
      }}
    />
  );
}
