"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { EventState, Match, Player, Round, RoundKind, RoundPlanEntry, SchedulePrefs } from "./types";
import { createEmptyEvent } from "./types";
import { loadState, saveState, exportJSON as doExportJSON, importJSON as doImportJSON, initialState } from "./state";
import { doublesEloDeltaDetailed } from "./rating";
import { computeRoundPlan, prepareRound1, preparePrelimRound, generatePrelimWave, generateLaterRound, prelimWaveSequenceFromPrefs } from "./matchmaking";
import { cutToTarget, rankPlayers } from "./elimination";

type EventContextShape = {
  // state
  players: Player[];
  rounds: Round[];
  currentRound: number;
  schedulePrefs: SchedulePrefs;
  r1Signature?: string;
  initialRatingsById?: Record<string, number>;
  roundPlan: RoundPlanEntry[];

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

  // Generic round/wave management
  advanceCurrentWave: () => void;
  closeCurrentRound: () => void;

  // Backward compatibility - deprecated
  advanceR1Wave: () => void;
  advanceR2Wave: () => void;

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

function buildRoundForEntry(
  entry: RoundPlanEntry,
  players: Player[],
  priorRounds: Round[],
  prefs: SchedulePrefs
): Round {
  if (entry.kind === "prelim") {
    const round = entry.index === 1 ? prepareRound1(players, prefs) : preparePrelimRound(entry.index, players, prefs);
    return { ...round, targetSize: entry.targetSize };
  }
  if (entry.kind === "eight") {
    const matches = generateLaterRound(players, priorRounds, entry.index, "eight", { upToWave: 1 });
    const currentWave = matches.length > 0 ? 1 : 0;
    return {
      index: entry.index,
      kind: "eight",
      matches,
      status: "active",
      currentWave,
      totalWaves: 2,
      targetSize: entry.targetSize,
    };
  }
  const matches = generateLaterRound(players, priorRounds, entry.index, "final");
  return {
    index: entry.index,
    kind: "final",
    matches,
    status: "active",
    targetSize: entry.targetSize,
  };
}

function activeRoundOfKind(rounds: Round[], kind: RoundKind): Round | undefined {
  for (let i = rounds.length - 1; i >= 0; i -= 1) {
    const round = rounds[i];
    if (round.kind === kind && round.status === "active") {
      return round;
    }
  }
  return undefined;
}

function getCurrentActiveRound(rounds: Round[]): Round | undefined {
  return rounds.find(r => r.status === "active");
}

function getMaxWavesForRound(round: Round, schedulePrefs: SchedulePrefs): number {
  if (round.kind === "prelim") {
    const waveSequence = prelimWaveSequenceFromPrefs(schedulePrefs, round.index);
    return waveSequence.length;
  } else if (round.kind === "eight") {
    return 2;
  } else if (round.kind === "final") {
    return 1;
  }
  return 0;
}

function planEntryByIndex(plan: RoundPlanEntry[] | undefined, index: number): RoundPlanEntry | undefined {
  return plan?.find((entry) => entry.index === index);
}

function nextPlanEntry(plan: RoundPlanEntry[] | undefined, index: number): RoundPlanEntry | undefined {
  if (!plan) return undefined;
  return plan.find((entry) => entry.index > index);
}

function stageIndexFor(round: Round): 1 | 2 | 3 {
  return round.kind === "prelim" ? 1 : round.kind === "eight" ? 2 : 3;
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
  const roundPlan = state.roundPlan ?? [];

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
      const plan = computeRoundPlan(s.players.length, s.schedulePrefs);
      if (!plan.length) return s;
      const firstEntry = plan[0];
      const opener = buildRoundForEntry(firstEntry, s.players, [], s.schedulePrefs);
      const initialRatings: Record<string, number> = Object.fromEntries(s.players.map((p) => [p.id, p.rating]));
      const nextSig = computeR1Signature(s.players);
      const resetPlayers = s.players.map((p) => ({ ...p, eliminatedAtRound: undefined }));
      return {
        ...s,
        players: resetPlayers,
        rounds: [opener],
        currentRound: firstEntry.index,
        r1Signature: nextSig,
        initialRatingsById: initialRatings,
        roundPlan: plan,
      };
    });
  }, []);

  const advanceCurrentWave = useCallback(() => {
    setState((s) => {
      const activeRound = getCurrentActiveRound(s.rounds);
      if (!activeRound) return s;

      const maxWaves = getMaxWavesForRound(activeRound, s.schedulePrefs);
      const nextWave = (activeRound.currentWave ?? 0) + 1;
      if (maxWaves > 0 && nextWave > maxWaves) return s;

      const survivors = s.players.filter((p) => !p.eliminatedAtRound);

      let matches: Match[] = [];
      let updatedPlayers = s.players;

      if (activeRound.kind === "prelim") {
        // Use preliminary round wave generation
        const { matches: prelimMatches, benched } = generatePrelimWave(nextWave, survivors, activeRound, [], s.schedulePrefs);
        if (prelimMatches.length === 0) return s;
        matches = prelimMatches;

        // Update player lastPlayedAt for preliminary rounds
        const benchedSet = new Set(benched.map((p) => p.id));
        const playingIds = new Set<string>();
        matches.forEach((m) => {
          playingIds.add(m.a1);
          playingIds.add(m.a2);
          playingIds.add(m.b1);
          playingIds.add(m.b2);
        });

        updatedPlayers = s.players.map((p) => {
          if (!playingIds.has(p.id) || benchedSet.has(p.id)) return p;
          return { ...p, lastPlayedAt: Date.now() };
        });
      } else if (activeRound.kind === "eight" || activeRound.kind === "final") {
        // Use later round wave generation
        const priorRounds = s.rounds.filter((round) => round.index <= activeRound.index);
        const nextMatches = generateLaterRound(survivors, priorRounds, activeRound.index, activeRound.kind, { upToWave: maxWaves });
        const newWaveMatches = nextMatches.filter((m) => m.miniRoundIndex === nextWave);
        if (newWaveMatches.length === 0) return s;
        matches = newWaveMatches;
      }

      const updatedRound: Round = {
        ...activeRound,
        currentWave: nextWave,
        matches: [...activeRound.matches, ...matches],
      };
      const nextRounds = s.rounds.map((round) => (round.index === updatedRound.index ? updatedRound : round));
      return { ...s, players: updatedPlayers, rounds: nextRounds };
    });
  }, []);

  const closeCurrentRound = useCallback(() => {
    setState((s) => {
      const activeRound = getCurrentActiveRound(s.rounds);
      if (!activeRound) return s;

      // For finals, check if all matches are completed (finals don't use wave system)
      if (activeRound.kind === "final") {
        const allMatches = activeRound.matches;
        const allCompleted = allMatches.length > 0 && allMatches.every(m => m.status === "completed");
        if (!allCompleted) return s;
      } else {
        // For other rounds, check if all waves are completed
        const maxWaves = getMaxWavesForRound(activeRound, s.schedulePrefs);
        const currentWave = activeRound.currentWave ?? 0;

        // Only allow closing if we've completed all waves
        if (currentWave < maxWaves) return s;

        // Check if current wave is actually completed
        const currentWaveMatches = activeRound.matches.filter(m => m.miniRoundIndex === currentWave);
        const currentWaveCompleted = currentWaveMatches.length > 0 && currentWaveMatches.every(m => m.status === "completed");
        if (!currentWaveCompleted) return s;
      }

      const closedRound: Round = { ...activeRound, status: "closed" };
      const roundsAfterClose = s.rounds.map((round) => (round.index === closedRound.index ? closedRound : round));

      let updatedPlayers = s.players;
      let nextRounds = roundsAfterClose;
      let nextCurrentRound = closedRound.index;

      if (activeRound.kind === "prelim") {
        // For preliminary rounds, perform player elimination and generate next round
        const planEntry = planEntryByIndex(s.roundPlan, activeRound.index);
        const targetSize = planEntry?.targetSize ?? 8;

        const survivorsBeforeCut = s.players.filter((p) => !p.eliminatedAtRound);
        const { keepIds, eliminatedIds } = cutToTarget(survivorsBeforeCut, roundsAfterClose, targetSize);
        const eliminatedSet = new Set(eliminatedIds);

        updatedPlayers = s.players.map((p) => {
          if (!eliminatedSet.has(p.id)) return p;
          if (p.eliminatedAtRound && p.eliminatedAtRound <= closedRound.index) return p;
          return { ...p, eliminatedAtRound: closedRound.index };
        });

        const survivors = updatedPlayers.filter((p) => !p.eliminatedAtRound);
        const nextEntry = nextPlanEntry(s.roundPlan, closedRound.index);
        nextRounds = nextEntry
          ? [...roundsAfterClose, buildRoundForEntry(nextEntry, survivors, roundsAfterClose, s.schedulePrefs)]
          : roundsAfterClose;
        nextCurrentRound = nextEntry?.index ?? closedRound.index;
      } else if (activeRound.kind === "eight") {
        // For eight-player rounds, perform elimination and generate final round
        const survivorsBeforeCut = s.players.filter((p) => !p.eliminatedAtRound);
        const { keepIds, eliminatedIds } = cutToTarget(survivorsBeforeCut, roundsAfterClose, 4);
        const eliminatedSet = new Set(eliminatedIds);

        updatedPlayers = s.players.map((p) => {
          if (!eliminatedSet.has(p.id)) return p;
          if (p.eliminatedAtRound && p.eliminatedAtRound <= closedRound.index) return p;
          return { ...p, eliminatedAtRound: closedRound.index };
        });

        const survivors = updatedPlayers.filter((p) => !p.eliminatedAtRound);
        const nextEntry = nextPlanEntry(s.roundPlan, closedRound.index);
        nextRounds = nextEntry
          ? [...roundsAfterClose, buildRoundForEntry(nextEntry, survivors, roundsAfterClose, s.schedulePrefs)]
          : roundsAfterClose;
        nextCurrentRound = nextEntry?.index ?? closedRound.index;
      }
      // For final rounds, no next round generation needed

      return { ...s, players: updatedPlayers, rounds: nextRounds, currentRound: nextCurrentRound };
    });
  }, []);

  // Backward compatibility wrappers
  const advanceR1Wave = useCallback(() => {
    // Use the generic function, which will work for any active round
    advanceCurrentWave();
  }, [advanceCurrentWave]);

  const advanceR2Wave = useCallback(() => {
    // Use the generic function, which will work for any active round
    advanceCurrentWave();
  }, [advanceCurrentWave]);

  const closeRound1 = useCallback(() => {
    setState((s) => {
      const activePrelim = activeRoundOfKind(s.rounds, "prelim");
      if (!activePrelim) return s;

      // Check if all waves in the selected sequence are completed
      const waveSequence = prelimWaveSequenceFromPrefs(s.schedulePrefs, activePrelim.index);
      const maxWaves = waveSequence.length;
      const currentWave = activePrelim.currentWave ?? 0;

      // Only allow closing if we've completed all waves in the sequence
      if (currentWave < maxWaves) return s;

      // Check if current wave is actually completed
      const currentWaveMatches = activePrelim.matches.filter(m => m.miniRoundIndex === currentWave);
      const currentWaveCompleted = currentWaveMatches.length > 0 && currentWaveMatches.every(m => m.status === "completed");
      if (!currentWaveCompleted) return s;

      const planEntry = planEntryByIndex(s.roundPlan, activePrelim.index);
      const targetSize = planEntry?.targetSize ?? 8;

      const closedRound: Round = { ...activePrelim, status: "closed" };
      const roundsAfterClose = s.rounds.map((round) => (round.index === closedRound.index ? closedRound : round));

      const survivorsBeforeCut = s.players.filter((p) => !p.eliminatedAtRound);
      const { keepIds, eliminatedIds } = cutToTarget(survivorsBeforeCut, roundsAfterClose, targetSize);
      const eliminatedSet = new Set(eliminatedIds);

      const updatedPlayers = s.players.map((p) => {
        if (!eliminatedSet.has(p.id)) return p;
        if (p.eliminatedAtRound && p.eliminatedAtRound <= closedRound.index) return p;
        return { ...p, eliminatedAtRound: closedRound.index };
      });

      const survivors = updatedPlayers.filter((p) => !p.eliminatedAtRound);
      const nextEntry = nextPlanEntry(s.roundPlan, closedRound.index);
      const nextRounds = nextEntry
        ? [...roundsAfterClose, buildRoundForEntry(nextEntry, survivors, roundsAfterClose, s.schedulePrefs)]
        : roundsAfterClose;
      const nextCurrentRound = nextEntry?.index ?? closedRound.index;
      return { ...s, players: updatedPlayers, rounds: nextRounds, currentRound: nextCurrentRound };
    });
  }, []);

  const closeRound2 = useCallback(() => {
    setState((s) => {
      const activeEight = activeRoundOfKind(s.rounds, "eight");
      if (!activeEight) return s;
      const planned = activeEight.matches.length;
      const completed = activeEight.matches.filter((m) => m.status === "completed").length;
      if (completed < planned) return s;

      const planEntry = planEntryByIndex(s.roundPlan, activeEight.index);
      const targetSize = planEntry?.targetSize ?? 4;

      const closedRound: Round = { ...activeEight, status: "closed" };
      const roundsAfterClose = s.rounds.map((round) => (round.index === closedRound.index ? closedRound : round));

      const survivorsBeforeCut = s.players.filter((p) => !p.eliminatedAtRound);
      const { keepIds, eliminatedIds } = cutToTarget(survivorsBeforeCut, roundsAfterClose, targetSize);
      const eliminatedSet = new Set(eliminatedIds);

      const updatedPlayers = s.players.map((p) => {
        if (!eliminatedSet.has(p.id)) return p;
        if (p.eliminatedAtRound && p.eliminatedAtRound <= closedRound.index) return p;
        return { ...p, eliminatedAtRound: closedRound.index };
      });

      const survivors = updatedPlayers.filter((p) => !p.eliminatedAtRound);
      const nextEntry = nextPlanEntry(s.roundPlan, closedRound.index);
      const nextRounds = nextEntry
        ? [...roundsAfterClose, buildRoundForEntry(nextEntry, survivors, roundsAfterClose, s.schedulePrefs)]
        : roundsAfterClose;
      const nextCurrentRound = nextEntry?.index ?? closedRound.index;
      return { ...s, players: updatedPlayers, rounds: nextRounds, currentRound: nextCurrentRound };
    });
  }, []);

  const closeEvent = useCallback(() => {
    setState((s) => {
      const finalRound = s.rounds.find((round) => round.kind === "final");
      if (!finalRound) return s;
      if (finalRound.status === "closed") return s;
      const planned = finalRound.matches.length;
      const completed = finalRound.matches.filter((m) => m.status === "completed").length;
      if (completed < planned) return s;
      const closedRound: Round = { ...finalRound, status: "closed" };
      const nextRounds = s.rounds.map((round) => (round.index === closedRound.index ? closedRound : round));
      return { ...s, rounds: nextRounds };
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
        stageIndexFor(round),
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
    const header = ["Name","Seed","Start Elo","End Elo","Delta Elo","PF","PA","PD","Games","LockedRank"].join(",");
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
    roundPlan,
    addPlayer,
    removePlayer,
    reorderPlayers,
    generateRound1,
    closeRound1,
    closeRound2,
    closeEvent,
    submitScore,
    advanceCurrentWave,
    closeCurrentRound,
    advanceR1Wave,
    advanceR2Wave,
    updateSchedulePrefs,
    exportJSON,
    importJSON,
    resetTournament,
    resetAll,
    demo12,
    exportRatingsJSON,
    exportAnalysisCSV,
  }), [players, rounds, currentRound, schedulePrefs, r1Signature, initialRatingsById, roundPlan, addPlayer, removePlayer, reorderPlayers, generateRound1, closeRound1, closeRound2, closeEvent, submitScore, advanceCurrentWave, closeCurrentRound, advanceR1Wave, advanceR2Wave, updateSchedulePrefs, exportJSON, importJSON, resetTournament, resetAll, demo12, exportRatingsJSON, exportAnalysisCSV]);

  return <EventContext.Provider value={value}>{children}</EventContext.Provider>;
}





























