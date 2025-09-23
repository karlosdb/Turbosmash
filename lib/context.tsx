"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventState, Match, Player, Round, SchedulePrefs } from "./types";
import { createEmptyEvent } from "./types";
import { loadState, saveState, exportJSON as doExportJSON, importJSON as doImportJSON, initialState } from "./state";
import { doublesEloDelta, doublesEloDeltaDetailed } from "./rating";
import { prepareRound1, generateR1Wave, generateLaterRound, r1WaveSequenceFromPrefs } from "./matchmaking";
import { cutAfterR1, cutAfterR2ToFinalFour, rankPlayers } from "./elimination";

type EventContextShape = {
  // state
  players: Player[];
  rounds: Round[];
  currentRound: 1 | 2 | 3;
  schedulePrefs: SchedulePrefs;
  r1Signature?: string;
  initialRatingsById?: Record<string, number>;

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
  exportRatingsJSON: () => string;
  exportAnalysisCSV: () => string;
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
  const initialRatingsById = state.initialRatingsById;

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
    setState((s) => {
      const nextPrefs = { ...s.schedulePrefs, ...patch };
      let rounds = s.rounds;
      if (patch.r1WaveOrder && patch.r1WaveOrder !== s.schedulePrefs.r1WaveOrder) {
        rounds = s.rounds.map((round) => {
          if (round.index !== 1) return round;
          if ((round.currentWave ?? 0) > 0) return round;
          const baseline = prepareRound1(s.players, nextPrefs);
          return {
            ...round,
            totalWaves: baseline.totalWaves,
            waveSizes: baseline.waveSizes,
          };
        });
      }
      return { ...s, schedulePrefs: nextPrefs, rounds };
    });
  }, []);

  const generateRound1 = useCallback(() => {
    setState((s) => {
      if (s.players.length < 8) return s;
      const r1 = prepareRound1(s.players, s.schedulePrefs);
      const initialRatings: Record<string, number> = Object.fromEntries(s.players.map((p) => [p.id, p.rating]));
      const nextSig = computeR1Signature(s.players);
      return { ...s, rounds: [r1], currentRound: 1, r1Signature: nextSig, initialRatingsById: initialRatings };
    });
  }, []);

  const advanceR1Wave = useCallback(() => {
    setState((s) => {
      const r1 = s.rounds.find((r) => r.index === 1);
      if (!r1 || r1.status !== "active") return s;
      const nextWave = (r1.currentWave ?? 0) + 1;
      const sequence = r1WaveSequenceFromPrefs(s.schedulePrefs);
      const totalWaves = r1.totalWaves ?? sequence.length;
      if (totalWaves > 0 && nextWave > totalWaves) return s;
      const { matches, benched } = generateR1Wave(nextWave, s.players, r1, [], s.schedulePrefs);
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
      // Re-seed survivors by round-1 point differential, maintaining deterministic structure
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
      const detailed = doublesEloDeltaDetailed(
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
      inc(pa1, detailed.perPlayer.da1);
      inc(pa2, detailed.perPlayer.da2);
      inc(pb1, detailed.perPlayer.db1);
      inc(pb2, detailed.perPlayer.db2);

      // Append reasoning logs
      const addLog = (p: Player, delta: number) => {
        const entry = { matchId, delta, reason: detailed.reason };
        p.eloLog = [...(p.eloLog || []), entry];
      };
      addLog(pa1, detailed.perPlayer.da1);
      addLog(pa2, detailed.perPlayer.da2);
      addLog(pb1, detailed.perPlayer.db1);
      addLog(pb2, detailed.perPlayer.db2);

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

  const exportRatingsJSON = useCallback(() => {
    const entries = players.map((p) => [p.name, p.rating] as const);
    return JSON.stringify(Object.fromEntries(entries), null, 2);
  }, [players]);

  const exportAnalysisCSV = useCallback(() => {
    const header = ["Name","Seed","Start Elo","End Elo","Δ Elo","PF","PA","PD","Games","LockedRank"].join(",");
    const start = initialRatingsById || {};
    const lines = players.map((p) => {
      const s = start[p.id] ?? p.rating;
      const e = p.rating;
      const d = e - s;
      const pd = (p.pointsFor || 0) - (p.pointsAgainst || 0);
      const games = p.gamesPlayed || 0;
      return [
        JSON.stringify(p.name),
        p.seed,
        s,
        e,
        d,
        p.pointsFor || 0,
        p.pointsAgainst || 0,
        pd,
        games,
        p.lockedRank ?? "",
      ].join(",");
    });
    return [header, ...lines].join("\n");
  }, [players, initialRatingsById]);

  const demo12 = useCallback(() => {
    setState((s) => {
      if (s.players.length > 0) return s;
      const names = [
        "Alex","Blake","Casey","Drew","Evan","Flynn","Gray","Hayden","Indy","Jules","Kai","Logan",
      ];
      const N = names.length;
      const players: Player[] = names.map((name, idx) => ({
        id: uid("plr"),
        name,
        seed: idx + 1,
        rating: 1000 + 25 * ((N + 1 - 2 * (idx + 1)) / 2),
        seedPrior: 1000 + 25 * ((N + 1 - 2 * (idx + 1)) / 2),
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
    initialRatingsById,
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
    exportRatingsJSON,
    exportAnalysisCSV,
  }), [players, rounds, currentRound, schedulePrefs, r1Signature, initialRatingsById, addPlayer, removePlayer, reorderPlayers, generateRound1, closeRound1, closeRound2, closeEvent, submitScore, advanceR1Wave, updateSchedulePrefs, exportJSON, importJSON, resetTournament, resetAll, demo12, exportRatingsJSON, exportAnalysisCSV]);

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}


