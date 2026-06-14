import type { GameState, Abilities, RaceId, ClassId } from "./types";
import type { AiAction } from "./dm";

// Client-side WebSocket session for an online co-op room. Talks to the room's
// Durable Object via /api/room/<code>/ws and surfaces lobby + game updates.

export interface HeroDraft {
  name: string;
  race: RaceId;
  klass: ClassId;
  abilities: Abilities;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  hasHero: boolean;
  klass: ClassId | null;
  online: boolean;
}

export interface RoomState {
  hostId: string;
  campaignId: string;
  started: boolean;
  seatMap: Record<string, number>;
  players: LobbyPlayer[];
  game?: GameState;
}

export type GameAction =
  | { kind: "choose"; choiceId: string }
  | { kind: "attack"; target: number }
  | { kind: "ability"; id: string; target: number }
  | { kind: "item"; id: string }
  | { kind: "flee" }
  | { kind: "useItem"; itemId: string; seat: number }
  | { kind: "equip"; itemId: string; seat: number };

const ID_KEY = "lotsr_player_id";
const NAME_KEY = "lotsr_player_name";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "anon";
  let id = window.localStorage.getItem(ID_KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2, 10);
    window.localStorage.setItem(ID_KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(NAME_KEY) ?? "";
}
export function setPlayerName(name: string): void {
  if (typeof window !== "undefined") window.localStorage.setItem(NAME_KEY, name);
}

export function randomRoomCode(): string {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused chars
  let s = "";
  for (let i = 0; i < 4; i++) s += alpha[Math.floor(Math.random() * alpha.length)];
  return s;
}

type Status = "connecting" | "open" | "closed";

export class RoomSession {
  readonly code: string;
  readonly playerId: string;
  private name: string;
  private ws: WebSocket | null = null;
  private retries = 0;
  private closedByUser = false;

  onUpdate: (room: RoomState) => void = () => {};
  onStatus: (s: Status) => void = () => {};
  onError: (msg: string) => void = () => {};

  constructor(code: string, name: string) {
    this.code = code.toUpperCase();
    this.playerId = getPlayerId();
    this.name = name;
  }

  connect() {
    if (typeof window === "undefined") return;
    this.onStatus("connecting");
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/api/room/${this.code}/ws`);
    this.ws = ws;

    ws.onopen = () => {
      this.retries = 0;
      this.onStatus("open");
      this.send({ t: "hello", id: this.playerId, name: this.name });
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data as string);
        if (data.t === "error") {
          this.onError(typeof data.message === "string" ? data.message : "Error");
          return;
        }
        this.onUpdate(data as RoomState);
      } catch {
        /* ignore malformed */
      }
    };
    ws.onclose = () => {
      this.onStatus("closed");
      if (this.closedByUser) return;
      // Reconnect with backoff (the DO keeps the authoritative state).
      this.retries = Math.min(this.retries + 1, 5);
      setTimeout(() => this.connect(), 500 * this.retries);
    };
    ws.onerror = () => ws.close();
  }

  private send(msg: unknown) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  setHero(hero: HeroDraft) {
    this.send({ t: "setHero", hero });
  }
  setCampaign(campaignId: string) {
    this.send({ t: "setCampaign", campaignId });
  }
  start() {
    this.send({ t: "start" });
  }
  action(action: GameAction) {
    this.send({ t: "action", action });
  }
  narrate(text: string) {
    this.send({ t: "narrate", text });
  }
  aiAction(result: AiAction) {
    this.send({ t: "aiAction", result });
  }
  close() {
    this.closedByUser = true;
    this.ws?.close();
  }
}
