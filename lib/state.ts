import { EventState, createEmptyEvent } from "./types";

const STORAGE_KEY = "turbosmash:event";

export function loadState(): EventState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as EventState;
  } catch {
    return null;
  }
}

export function saveState(state: EventState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function exportJSON(state: EventState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string): EventState {
  const obj = JSON.parse(json) as EventState;
  return obj;
}

export function initialState(): EventState {
  return createEmptyEvent();
}


