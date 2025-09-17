"use client";

import React from "react";
import { EventState, Player, createEmptyEvent } from "./types";
import { loadState, saveState } from "./state";
import { applyEloForMatch } from "./rating";
import { generateRound1, generateRoundGeneric } from "./matchmaking";
import { cutAfterR1, cutAfterR2ToFinalFour } from "./elimination";

type EventActions = {
  addPlayer: (name: string, seed: number) => void;
  removePlayer: (id: string) => void;
  updateSeed: (id: string, seed: number) => void;
  generateRound1: () => void;
  closeRound1: () => void;
  generateRound2: () => void;
  closeRound2: () => void;
  generateRound3: () => void;
  closeEvent: () => void;
  submitScore: (matchId: string, scoreA: number, scoreB: number) => void;
  exportJSON: () => string;
  importJSON: (json: string) => void;
  reset: () => void;
  demo12: () => void;
};

type EventContextValue = EventState & EventActions;

const EventContext = React.createContext<EventContextValue | null>(null);

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  // Initialize with a deterministic empty state to match SSR markup
  const [state, setState] = React.useState<EventState>(() => createEmptyEvent());
  const [hasHydrated, setHasHydrated] = React.useState(false);

  // After mount, load any persisted state
  React.useEffect(() => {
    const loaded = loadState();
    if (loaded) setState(loaded);
    setHasHydrated(true);
  }, []);

  // Persist after hydration to avoid saving empty placeholder
  React.useEffect(() => {
    if (hasHydrated) saveState(state);
  }, [state, hasHydrated]);

  const addPlayer = (name: string, seed: number) => {
    setState((s) => {
      const existsSeed = s.players.some((p) => p.seed === seed);
      if (existsSeed) return s; // enforce unique seed
      const player: Player = {
        id: uid("p"),
        name,
        seed,
        rating: 1000,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      const players = [...s.players, player].sort((a, b) => a.seed - b.seed);
      return { ...s, players };
    });
  };

  const removePlayer = (id: string) => {
    setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) }));
  };

  const updateSeed = (id: string, seed: number) => {
    setState((s) => {
      if (s.players.some((p) => p.seed === seed && p.id !== id)) return s;
      const players = s.players.map((p) => (p.id === id ? { ...p, seed } : p)).sort((a, b) => a.seed - b.seed);
      return { ...s, players };
    });
  };

  const submitScore = (matchId: string, scoreA: number, scoreB: number) => {
    setState((s) => {
      const rounds = s.rounds.map((r) => ({ ...r, matches: r.matches.map((m) => ({ ...m })) }));
      const match = rounds.flatMap((r) => r.matches).find((m) => m.id === matchId);
      if (!match) return s;
      match.scoreA = scoreA;
      match.scoreB = scoreB;
      match.status = "completed";

      const updatedPlayers = s.players.map((p) => ({ ...p }));
      const { deltas, pointsFor, pointsAgainst } = applyEloForMatch(updatedPlayers, {
        a1: match.a1,
        a2: match.a2,
        b1: match.b1,
        b2: match.b2,
        scoreA,
        scoreB,
        roundIndex: match.roundIndex as 1 | 2 | 3,
      });

      for (const p of updatedPlayers) {
        const d = deltas[p.id] || 0;
        p.rating = Math.round(p.rating + d);
        p.gamesPlayed += 1;
        p.pointsFor += pointsFor[p.id] || 0;
        p.pointsAgainst += pointsAgainst[p.id] || 0;
        p.lastPlayedAt = Date.now();
      }
      return { ...s, players: updatedPlayers, rounds };
    });
  };

  const generateRound1Action = () => {
    setState((s) => {
      if (s.players.length < 8) return s;
      const { round } = generateRound1(s.players);
      return { ...s, rounds: [round], currentRound: 1 };
    });
  };

  const closeRound1 = () => {
    setState((s) => {
      const r1 = s.rounds.find((r) => r.index === 1);
      if (!r1) return s;
      r1.status = "closed";
      // elimination cut
      const { keepIds } = cutAfterR1(s.players, s.rounds);
      const kept = s.players.filter((p) => keepIds.includes(p.id));
      const { round } = generateRoundGeneric(kept, s.rounds, 2);
      return { ...s, players: kept, rounds: [...s.rounds, round], currentRound: 2 };
    });
  };

  const closeRound2 = () => {
    setState((s) => {
      const r2 = s.rounds.find((r) => r.index === 2);
      if (!r2) return s;
      r2.status = "closed";
      const { keepIds } = cutAfterR2ToFinalFour(s.players, s.rounds);
      const kept = s.players.filter((p) => keepIds.includes(p.id));
      const { round } = generateRoundGeneric(kept, s.rounds, 3);
      return { ...s, players: kept, rounds: [...s.rounds, round], currentRound: 3 };
    });
  };

  const closeEvent = () => {
    setState((s) => {
      const rounds = s.rounds.map((r) => (r.index === 3 ? { ...r, status: "closed" as const } : r));
      return { ...s, rounds };
    });
  };

  const exportJSON = () => JSON.stringify(state, null, 2);

  const importJSONAction = (json: string) => {
    try {
      const parsed = JSON.parse(json) as EventState;
      setState(parsed);
    } catch {}
  };

  const reset = () => setState(createEmptyEvent());

  const demo12 = () => {
    setState((s) => {
      const names = [
        "Alex","Blake","Casey","Drew","Elliot","Finley","Gray","Harper","Indy","Jules","Kai","Logan",
      ];
      const players: Player[] = names.map((n, i) => ({
        id: uid("p"),
        name: n,
        seed: i + 1,
        rating: 1000,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      }));
      return { ...s, players };
    });
  };

  const value: EventContextValue = {
    ...state,
    addPlayer,
    removePlayer,
    updateSeed,
    generateRound1: generateRound1Action,
    closeRound1,
    generateRound2: () => {},
    closeRound2,
    generateRound3: () => {},
    closeEvent,
    submitScore,
    exportJSON,
    importJSON: importJSONAction,
    reset,
    demo12,
  };

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}

export function useEvent() {
  const ctx = React.useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}


