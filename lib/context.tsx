"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventState, Match, Player, Round, SchedulePrefs } from "./types";
import { createEmptyEvent } from "./types";
import { loadState, saveState, exportJSON as doExportJSON, importJSON as doImportJSON, initialState } from "./state";
import { doublesEloDelta } from "./rating";
import { prepareRound1, generateR1Wave, generateLaterRound } from "./matchmaking";
import { cutAfterR1, cutAfterR2ToFinalFour, rankPlayers } from "./elimination";

type EventContextShape = {
  // state
  players: Player[];
  rounds: Round[];
  currentRound: 1 | 2 | 3;
  schedulePrefs: SchedulePrefs;
  r1Signature?: string;

  // player mgmt
  addPlayer: (name: string, seed: number) => void;
  removePlayer: (id: string) => void;
  reorderPlayers: (idsInOrder: string[]) => void;

  // rounds
  generateRound1: () => void;
  closeRound1: () => void;
  closeRound2: () => void;
  closeEvent: () => void;

  // matches
  submitScore: (matchId: string, scoreA: number, scoreB: number) => void;
  advanceR1Wave: () => void;

  // prefs
  updateSchedulePrefs: (patch: Partial<SchedulePrefs>) => void;

  // import/export/reset
  exportJSON: () => string;
  importJSON: (json: string) => void;
  resetTournament: () => void;
  resetAll: () => void;
  demo12: () => void;
};

const EventContext = createContext<EventContextShape | null>(null);

export function useEvent() {
  const ctx = useContext(EventContext);
  if (!ctx) throw new Error("useEvent must be used within EventProvider");
  return ctx;
}

function uid(prefix = "p") {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}

function computeR1Signature(players: Player[]): string {
  const sorted = [...players].sort((a, b) => a.seed - b.seed);
  return sorted.map((p) => `${p.seed}:${p.name}`).join("|");
}

export function EventProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EventState>(() => initialState());

  // load from localStorage on mount (client only)
  useEffect(() => {
    const loaded = loadState();
    if (loaded) setState(loaded);
  }, []);

  // persist on changes
  useEffect(() => {
    saveState(state);
  }, [state]);

  const players = state.players;
  const rounds = state.rounds;
  const currentRound = state.currentRound;
  const schedulePrefs = state.schedulePrefs;
  const r1Signature = state.r1Signature;

  const addPlayer = useCallback((name: string, seed: number) => {
    setState((s) => {
      const now = Date.now();
      const p: Player = {
        id: uid("plr"),
        name,
        seed,
        rating: 1000,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        lastPlayedAt: now,
      };
      return { ...s, players: [...s.players, p] };
    });
  }, []);

  const removePlayer = useCallback((id: string) => {
    setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) }));
  }, []);

  const reorderPlayers = useCallback((idsInOrder: string[]) => {
    setState((s) => {
      const byId: Record<string, Player> = Object.fromEntries(s.players.map((p) => [p.id, p]));
      const next = idsInOrder.map((id, idx) => ({ ...byId[id], seed: idx + 1 }));
      return { ...s, players: next };
    });
  }, []);

  const updateSchedulePrefs = useCallback((patch: Partial<SchedulePrefs>) => {
    setState((s) => ({ ...s, schedulePrefs: { ...s.schedulePrefs, ...patch } }));
  }, []);

  const generateRound1 = useCallback(() => {
    setState((s) => {
      if (s.players.length < 8) return s;
      const r1 = prepareRound1(s.players, s.schedulePrefs);
      const nextSig = computeR1Signature(s.players);
      return { ...s, rounds: [r1], currentRound: 1, r1Signature: nextSig };
    });
  }, []);

  const advanceR1Wave = useCallback(() => {
    setState((s) => {
      const r1 = s.rounds.find((r) => r.index === 1);
      if (!r1 || r1.status !== "active") return s;
      const nextWave = (r1.currentWave ?? 0) + 1;
      if ((r1.totalWaves ?? 0) > 0 && nextWave > (r1.totalWaves ?? 0)) return s;
      const { matches, benched } = generateR1Wave(nextWave, s.players, r1, []);
      const benchedSet = new Set(benched.map((p) => p.id));
      const updatedPlayers = s.players.map((p) => ({ ...p, lastPlayedAt: benchedSet.has(p.id) ? p.lastPlayedAt : Date.now() }));
      const updatedR1: Round = {
        ...r1,
        currentWave: nextWave,
        matches: [...r1.matches, ...matches],
      };
      const nextRounds = s.rounds.map((r) => (r.index === 1 ? updatedR1 : r));
      return { ...s, players: updatedPlayers, rounds: nextRounds };
    });
  }, []);

  const closeRound1 = useCallback(() => {
    setState((s) => {
      const r1 = s.rounds.find((r) => r.index === 1);
      if (!r1) return s;
      const allPlanned = (r1.waveSizes?.reduce((acc, v) => acc + v, 0) ?? r1.matches.length);
      const completed = r1.matches.filter((m) => m.status === "completed").length;
      if (completed < allPlanned) return s;
      const r1Closed: Round = { ...r1, status: "closed" };
      const { keepIds, eliminatedIds } = cutAfterR1(s.players, s.rounds);
      const keepSet = new Set(keepIds);
      const eliminatedSet = new Set(eliminatedIds);
      const nextPlayers = s.players.map((p) => ({
        ...p,
        eliminatedAtRound: eliminatedSet.has(p.id) ? 1 : p.eliminatedAtRound,
      }));
      const survivors = nextPlayers.filter((p) => keepSet.has(p.id));
      const r2Matches = generateLaterRound(survivors, [r1Closed], 2, s.schedulePrefs.courts);
      const r2: Round = { index: 2, matches: r2Matches, status: "active" };
      const nextRounds = [r1Closed, r2];
      return { ...s, players: nextPlayers, rounds: nextRounds, currentRound: 2 };
    });
  }, []);

  const closeRound2 = useCallback(() => {
    setState((s) => {
      const r2 = s.rounds.find((r) => r.index === 2);
      if (!r2) return s;
      const planned = r2.matches.length;
      const completed = r2.matches.filter((m) => m.status === "completed").length;
      if (completed < planned) return s;
      const r2Closed: Round = { ...r2, status: "closed" };
      const survivors = s.players.filter((p) => !p.eliminatedAtRound);
      const { keepIds, eliminatedIds } = cutAfterR2ToFinalFour(survivors, s.rounds);
      const eliminatedSet = new Set(eliminatedIds);
      const nextPlayers = s.players.map((p) => ({
        ...p,
        eliminatedAtRound: eliminatedSet.has(p.id) ? 2 : p.eliminatedAtRound,
      }));
      const finalists = nextPlayers.filter((p) => keepIds.includes(p.id));
      const r3Matches = generateLaterRound(finalists, [s.rounds.find((r) => r.index === 1)!, r2Closed], 3, s.schedulePrefs.courts);
      const r3: Round = { index: 3, matches: r3Matches, status: "active" };
      return { ...s, players: nextPlayers, rounds: [s.rounds.find((r) => r.index === 1)!, r2Closed, r3], currentRound: 3 };
    });
  }, []);

  const closeEvent = useCallback(() => {
    setState((s) => {
      const r3 = s.rounds.find((r) => r.index === 3);
      if (!r3) return s;
      const planned = r3.matches.length;
      const completed = r3.matches.filter((m) => m.status === "completed").length;
      if (completed < planned) return s;
      const r3Closed: Round = { ...r3, status: "closed" };
      const ranked = rankPlayers(s.players, s.rounds);
      const lockedRank: Record<string, number> = {};
      ranked.forEach((p, idx) => (lockedRank[p.id] = idx + 1));
      const nextPlayers = s.players.map((p) => ({ ...p, lockedRank: lockedRank[p.id] }));
      const nextRounds = s.rounds.map((r) => (r.index === 3 ? r3Closed : r));
      return { ...s, players: nextPlayers, rounds: nextRounds };
    });
  }, []);

  const submitScore = useCallback((matchId: string, scoreA: number, scoreB: number) => {
    setState((s) => {
      const roundsFlat = s.rounds.flatMap((r) => r.matches);
      const match = roundsFlat.find((m) => m.id === matchId);
      if (!match) return s;
      const round = s.rounds.find((r) => r.matches.some((m) => m.id === matchId));
      if (!round) return s;

      const pMap: Record<string, Player> = Object.fromEntries(s.players.map((p) => [p.id, p]));
      const a1 = pMap[match.a1];
      const a2 = pMap[match.a2];
      const b1 = pMap[match.b1];
      const b2 = pMap[match.b2];
      if (!a1 || !a2 || !b1 || !b2) return s;

      const gpAvg = Math.max(1, (a1.gamesPlayed + a2.gamesPlayed + b1.gamesPlayed + b2.gamesPlayed) / 4);
      const delta = doublesEloDelta(
        a1.rating,
        a2.rating,
        b1.rating,
        b2.rating,
        scoreA,
        scoreB,
        round.index as 1 | 2 | 3,
        match.miniRoundIndex,
        a1.lastPartnerId === a2.id,
        false,
        b1.lastPartnerId === b2.id,
        false,
        gpAvg
      );

      const nextPlayers = s.players.map((p) => ({ ...p }));
      const inc = (p: Player, d: number) => {
        p.rating = Math.round(p.rating + d);
        p.gamesPlayed += 1;
        p.pointsFor += p.id === a1.id || p.id === a2.id ? scoreA : scoreB;
        p.pointsAgainst += p.id === a1.id || p.id === a2.id ? scoreB : scoreA;
        p.lastPartnerId = p.id === a1.id ? a2.id : p.id === a2.id ? a1.id : p.id === b1.id ? b2.id : b1.id;
        p.lastPlayedAt = Date.now();
      };
      const pa1 = nextPlayers.find((p) => p.id === a1.id)!;
      const pa2 = nextPlayers.find((p) => p.id === a2.id)!;
      const pb1 = nextPlayers.find((p) => p.id === b1.id)!;
      const pb2 = nextPlayers.find((p) => p.id === b2.id)!;
      inc(pa1, delta.dA);
      inc(pa2, delta.dA);
      inc(pb1, delta.dB);
      inc(pb2, delta.dB);

      const nextRounds = s.rounds.map((r) => {
        if (!r.matches.some((m) => m.id === matchId)) return r;
        return {
          ...r,
          matches: r.matches.map((m) => {
            if (m.id !== matchId) return m;
            const updated: Match = { ...m, scoreA, scoreB, status: "completed" };
            return updated;
          }),
        };
      });
      return { ...s, players: nextPlayers, rounds: nextRounds };
    });
  }, []);

  const exportJSON = useCallback(() => doExportJSON(state), [state]);

  const importJSON = useCallback((json: string) => {
    const next = doImportJSON(json);
    setState(next);
  }, []);

  const resetTournament = useCallback(() => {
    // Clear bracket data while preserving the current roster.
    setState((s) => {
      const baseline = createEmptyEvent();
      const nextPlayers = s.players.map((p) => ({
        ...p,
        rating: 1000,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        eliminatedAtRound: undefined,
        lockedRank: undefined,
        lastPartnerId: undefined,
        recentOpponents: undefined,
        lastPlayedAt: undefined,
        seedPrior: undefined,
      }));
      return {
        ...s,
        players: nextPlayers,
        rounds: [],
        currentRound: 1,
        r1Signature: undefined,
        createdAt: baseline.createdAt,
      };
    });
  }, []);

  const resetAll = useCallback(() => setState(createEmptyEvent()), []);

  const demo12 = useCallback(() => {
    setState((s) => {
      if (s.players.length > 0) return s;
      const names = [
        "Alex","Blake","Casey","Drew","Evan","Flynn","Gray","Hayden","Indy","Jules","Kai","Logan",
      ];
      const players: Player[] = names.map((name, idx) => ({
        id: uid("plr"),
        name,
        seed: idx + 1,
        rating: 1000,
        seedPrior: 1000,
        gamesPlayed: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        lastPlayedAt: Date.now(),
      }));
      return { ...s, players };
    });
  }, []);

  const value = useMemo<EventContextShape>(() => ({
    players,
    rounds,
    currentRound,
    schedulePrefs,
    r1Signature,
    addPlayer,
    removePlayer,
    reorderPlayers,
    generateRound1,
    closeRound1,
    closeRound2,
    closeEvent,
    submitScore,
    advanceR1Wave,
    updateSchedulePrefs,
    exportJSON,
    importJSON,
    resetTournament,
    resetAll,
    demo12,
  }), [players, rounds, currentRound, schedulePrefs, r1Signature, addPlayer, removePlayer, reorderPlayers, generateRound1, closeRound1, closeRound2, closeEvent, submitScore, advanceR1Wave, updateSchedulePrefs, exportJSON, importJSON, resetTournament, resetAll, demo12]);

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}


