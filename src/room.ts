// Durable Object: one co-op room. Holds the authoritative GameState and runs the
// SAME game engine the client uses locally. Clients connect over WebSocket, send
// actions, and receive the full state after every change. The room code is the
// Durable Object name (env.GAME_ROOM.idFromName(code)).

import type { GameState, Character } from "../lib/game/types";
import {
  newGame,
  chooseOption,
  combatAttack,
  combatAbility,
  combatItem,
  combatFlee,
  useItemExploring,
  equipItem,
  appendNarration,
  applyAiAction,
} from "../lib/game/engine";
import { createCharacter } from "../lib/game/character";
import { currentAllySeat } from "../lib/game/combat";
import type { AiAction } from "../lib/game/dm";

interface HeroDraft {
  name: string;
  race: Character["race"];
  klass: Character["klass"];
  abilities: Character["abilities"];
}

interface Member {
  id: string;
  name: string;
  hero: HeroDraft | null;
}

interface Session {
  ws: WebSocket;
  id: string;
}

interface Persisted {
  hostId: string;
  campaignId: string;
  started: boolean;
  members: Member[];
  seatMap: Record<string, number>; // playerId -> seat
  game: GameState | null;
}

type ClientMsg =
  | { t: "hello"; id: string; name: string }
  | { t: "setHero"; hero: HeroDraft }
  | { t: "setCampaign"; campaignId: string }
  | { t: "start" }
  | { t: "action"; action: GameAction }
  | { t: "narrate"; text: string }
  | { t: "aiAction"; result: AiAction };

type GameAction =
  | { kind: "choose"; choiceId: string }
  | { kind: "attack"; target: number }
  | { kind: "ability"; id: string; target: number }
  | { kind: "item"; id: string }
  | { kind: "flee" }
  | { kind: "useItem"; itemId: string; seat: number }
  | { kind: "equip"; itemId: string; seat: number };

interface DurableState {
  storage: {
    get<T>(key: string): Promise<T | undefined>;
    put<T>(key: string, value: T): Promise<void>;
  };
  blockConcurrencyWhile(fn: () => Promise<void>): void;
}

export class GameRoom {
  private state: DurableState;
  private sessions: Session[] = [];
  private data: Persisted = {
    hostId: "",
    campaignId: "shattered",
    started: false,
    members: [],
    seatMap: {},
    game: null,
  };

  constructor(state: DurableState) {
    this.state = state;
    state.blockConcurrencyWhile(async () => {
      const saved = await state.storage.get<Persisted>("data");
      if (saved) this.data = saved;
    });
  }

  private async persist() {
    await this.state.storage.put("data", this.data);
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    (server as unknown as { accept: () => void }).accept();

    const session: Session = { ws: server as unknown as WebSocket, id: "" };
    this.sessions.push(session);

    server.addEventListener("message", (ev: MessageEvent) => {
      this.onMessage(session, ev.data as string).catch(() => {
        this.send(session, { t: "error", message: "Something went wrong." });
      });
    });
    const drop = () => {
      this.sessions = this.sessions.filter((s) => s !== session);
      this.broadcast();
    };
    server.addEventListener("close", drop);
    server.addEventListener("error", drop);

    return new Response(null, { status: 101, webSocket: client });
  }

  private seatOf(id: string): number {
    return this.data.seatMap[id] ?? -1;
  }

  private async onMessage(session: Session, raw: string) {
    let msg: ClientMsg;
    try {
      msg = JSON.parse(raw) as ClientMsg;
    } catch {
      return;
    }

    if (msg.t === "hello") {
      session.id = msg.id;
      let member = this.data.members.find((m) => m.id === msg.id);
      if (!member) {
        if (this.data.started) {
          // Reconnecting players are fine; brand-new ones can't join mid-game.
          if (!(msg.id in this.data.seatMap)) {
            this.send(session, { t: "error", message: "This game has already started." });
          }
        }
        member = { id: msg.id, name: msg.name || "Crawler", hero: null };
        this.data.members.push(member);
      } else {
        member.name = msg.name || member.name;
      }
      if (!this.data.hostId) this.data.hostId = msg.id;
      await this.persist();
      this.broadcast();
      return;
    }

    const member = this.data.members.find((m) => m.id === session.id);
    if (!member) return;

    if (msg.t === "setHero" && !this.data.started) {
      member.hero = msg.hero;
      await this.persist();
      this.broadcast();
    } else if (msg.t === "setCampaign" && !this.data.started && session.id === this.data.hostId) {
      this.data.campaignId = msg.campaignId;
      await this.persist();
      this.broadcast();
    } else if (msg.t === "start" && !this.data.started && session.id === this.data.hostId) {
      const ready = this.data.members.filter((m) => m.hero);
      if (ready.length === 0) return;
      const party = ready.map((m) =>
        createCharacter({ name: m.hero!.name, race: m.hero!.race, klass: m.hero!.klass, abilities: m.hero!.abilities })
      );
      this.data.seatMap = {};
      ready.forEach((m, i) => (this.data.seatMap[m.id] = i));
      this.data.game = newGame(party, this.data.campaignId);
      this.data.started = true;
      await this.persist();
      this.broadcast();
    } else if (msg.t === "action" && this.data.game) {
      this.applyAction(session.id, msg.action);
      await this.persist();
      this.broadcast();
    } else if (msg.t === "narrate" && this.data.game) {
      if (this.activeSeat() === this.seatOf(session.id)) {
        this.data.game = appendNarration(this.data.game, msg.text);
        await this.persist();
        this.broadcast();
      }
    } else if (msg.t === "aiAction" && this.data.game) {
      if (this.data.game.phase === "exploring" && this.data.game.turnPlayer === this.seatOf(session.id)) {
        this.data.game = applyAiAction(this.data.game, msg.result);
        await this.persist();
        this.broadcast();
      }
    }
  }

  private activeSeat(): number {
    const g = this.data.game;
    if (!g) return -1;
    return g.phase === "combat" ? currentAllySeat(g) : g.turnPlayer;
  }

  private applyAction(playerId: string, action: GameAction) {
    const g = this.data.game;
    if (!g) return;
    const seat = this.seatOf(playerId);
    if (seat < 0) return;

    // Equipping / using potions out of combat: a player manages their own hero.
    if (action.kind === "equip") {
      this.data.game = equipItem(g, action.itemId, seat);
      return;
    }
    if (action.kind === "useItem") {
      if (g.phase === "exploring") this.data.game = useItemExploring(g, action.itemId, seat);
      return;
    }

    // Turn-gated actions: only the hero whose turn it is may act.
    if (this.activeSeat() !== seat) return;

    if (g.phase === "exploring" && action.kind === "choose") {
      this.data.game = chooseOption(g, action.choiceId);
    } else if (g.phase === "combat") {
      if (action.kind === "attack") this.data.game = combatAttack(g, action.target);
      else if (action.kind === "ability") this.data.game = combatAbility(g, action.id, action.target);
      else if (action.kind === "item") this.data.game = combatItem(g, action.id);
      else if (action.kind === "flee") this.data.game = combatFlee(g);
    }
  }

  private send(session: Session, msg: unknown) {
    try {
      session.ws.send(JSON.stringify(msg));
    } catch {
      /* socket gone */
    }
  }

  private broadcast() {
    const connectedIds = new Set(this.sessions.map((s) => s.id));
    const lobby = {
      t: "lobby" as const,
      hostId: this.data.hostId,
      campaignId: this.data.campaignId,
      started: this.data.started,
      seatMap: this.data.seatMap,
      players: this.data.members.map((m) => ({
        id: m.id,
        name: m.name,
        hasHero: !!m.hero,
        klass: m.hero?.klass ?? null,
        online: connectedIds.has(m.id),
      })),
    };
    const payload = JSON.stringify(
      this.data.game ? { ...lobby, game: this.data.game } : lobby
    );
    for (const s of this.sessions) {
      try {
        s.ws.send(payload);
      } catch {
        /* ignore */
      }
    }
  }
}
