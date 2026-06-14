import type { GameState, LogEntry, LogKind } from "./types";

let counter = 0;
export function uid(prefix = ""): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function addLog(state: GameState, kind: LogKind, text: string): LogEntry {
  const entry: LogEntry = { id: uid("l"), kind, text, ts: Date.now() };
  state.log.push(entry);
  // Keep the log from growing without bound on very long sessions.
  if (state.log.length > 400) state.log.splice(0, state.log.length - 400);
  return entry;
}

export function clone<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}
