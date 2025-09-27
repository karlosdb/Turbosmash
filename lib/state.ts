import { EventState, createEmptyEvent, defaultSchedulePrefs } from "./types";

const STORAGE_KEY = "turbosmash:event";

export function loadState(): EventState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EventState>;
    const empty = createEmptyEvent();
    return {
      ...empty,
      ...parsed,
      schedulePrefs: {
        ...defaultSchedulePrefs(),
        ...(parsed?.schedulePrefs ?? {}),
      },
      createdAt: parsed?.createdAt ?? empty.createdAt,
    };
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

export function clearState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function exportJSON(state: EventState): string {
  return JSON.stringify(state, null, 2);
}

export function importJSON(json: string): EventState {
  const obj = JSON.parse(json) as Partial<EventState>;
  const empty = createEmptyEvent();
  return {
    ...empty,
    ...obj,
    schedulePrefs: {
      ...defaultSchedulePrefs(),
      ...(obj.schedulePrefs ?? {}),
    },
    createdAt: obj.createdAt ?? empty.createdAt,
  };
}

export function initialState(): EventState {
  return createEmptyEvent();
}
