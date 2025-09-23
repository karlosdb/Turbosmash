"use client";

import { useEvent } from "@/lib/context";
import type { R1WaveOrder } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "@/components/Leaderboard";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const waveOrderOptions: { value: R1WaveOrder; label: string; detail: string; waves: string }[] = [
  {
    value: "explore-showdown-explore-showdown",
    label: "Explore > Showdown > Explore > Showdown",
    detail: "Four-wave flow that alternates explore pods with showdowns.",
    waves: "4 waves",
  },
  {
    value: "explore-explore-showdown",
    label: "Explore > Explore > Showdown",
    detail: "Three-wave sprint that doubles exploration before the showdown pod.",
    waves: "3 waves",
  },
];

export default function RoundsEditor() {
  const {
    rounds,
    players,
    schedulePrefs,
    updateSchedulePrefs,
    closeRound1,
    closeRound2,
    closeEvent,
    currentRound,
    submitScore,
    advanceR1Wave,
  } = useEvent();

  const r1 = rounds.find((r) => r.index === 1);
  const r2 = rounds.find((r) => r.index === 2);
  const r3 = rounds.find((r) => r.index === 3);

  const selectedOrder = schedulePrefs.r1WaveOrder;
  const waveOrderLocked = Boolean(r1 && (r1.currentWave ?? 0) > 0);
  const handleWaveOrderChange = (value: R1WaveOrder) => {
    if (waveOrderLocked || value === selectedOrder) return;
    updateSchedulePrefs({ r1WaveOrder: value });
  };

  const plannedWavesForOrder = selectedOrder === "explore-explore-showdown" ? 3 : 4;

  const randomScoreForTarget = (target: number): [number, number] => {
    const winnerA = Math.random() < 0.5;
    const losing = Math.floor(Math.random() * target);
    return winnerA ? [target, losing] : [losing, target];
  };

  const totalWaves = r1?.totalWaves ?? r1?.waveSizes?.length ?? plannedWavesForOrder;
  const currentWave = r1?.currentWave ?? 0;
  const waveMatches = currentWave
    ? r1?.matches.filter((m) => m.miniRoundIndex === currentWave) ?? []
    : [];
  const waveCompleted = waveMatches.length > 0 && waveMatches.every((m) => m.status === "completed");
  const hasNextWave = currentWave > 0 && totalWaves > currentWave;
  const canAdvanceWave = (r1?.currentWave ?? 0) === 0 || (hasNextWave && waveCompleted && r1?.status === "active");
  const totalMatchesPlanned = r1?.waveSizes?.reduce((acc, value) => acc + value, 0) ?? r1?.matches.length ?? 0;
  const completedMatches = r1?.matches.filter((m) => m.status === "completed").length ?? 0;
  const averageGames = players.length > 0 ? (completedMatches * 4) / players.length : 0;
  const canCloseRound1 = totalMatchesPlanned > 0 && completedMatches === totalMatchesPlanned && r1?.status !== "closed";

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_auto_1fr]">
      <div className="lg:col-start-2 justify-self-center">
        <Card className="w-full lg:w-[720px]">
          <CardHeader className="flex items-center justify-between">
            <CardTitle>Rounds</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue={String(currentRound)}>
              <TabsList>
                <TabsTrigger value="1">Round 1</TabsTrigger>
                <TabsTrigger value="2">Round 2</TabsTrigger>
                <TabsTrigger value="3">Round 3</TabsTrigger>
              </TabsList>

              <TabsContent value="1">
                <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-slate-600">Round 1 wave order</div>
                      <div className="text-sm font-semibold text-slate-900">
                        {waveOrderLocked ? "Locked for this round" : "Choose before starting Wave 1"}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500">
                      {waveOrderLocked ? "Wave order can't change once Wave 1 begins." : "You can adjust this until Wave 1 starts."}
                    </div>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-1 lg:grid-cols-2">
                    {waveOrderOptions.map((option) => {
                      const isSelected = option.value === selectedOrder;
                      const isDisabled = waveOrderLocked && !isSelected;
                      const detailClass = isSelected ? "text-indigo-100" : "text-slate-600";
                      const badgeClass = isSelected ? "bg-indigo-500 text-white" : "bg-slate-100 text-slate-700";
                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant={isSelected ? "default" : "outline"}
                          className="flex h-auto w-full flex-col items-start justify-start whitespace-normal break-words px-4 py-3 text-left"
                          onClick={() => handleWaveOrderChange(option.value)}
                          aria-pressed={isSelected}
                          disabled={isDisabled}
                        >
                          <div className="flex w-full flex-col items-start gap-1">
                            <div className="flex w-full flex-wrap items-center gap-2">
                              <span className="text-sm font-semibold">{option.label}</span>
                              <Badge className={badgeClass}>{option.waves}</Badge>
                            </div>
                            <span className={`text-xs ${detailClass}`}>{option.detail}</span>
                          </div>
                        </Button>
                      );
                    })}
                  </div>
                </div>
                {r1 && (
                  <div className="mb-4 rounded-2xl border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div>
                        <div className="text-xs uppercase tracking-wide">Wave summary</div>
                        <div className="text-sm font-semibold text-indigo-900">
                          {currentWave > 0 ? `Wave ${currentWave} of ${totalWaves}` : "Waiting for first wave"}
                        </div>
                        <div className="text-xs text-indigo-700">
                          Deterministic per-group pairings: seeds 1&3 vs 2&4, 5&7 vs 6&8, with fair cuts.
                        </div>
                      </div>
                      <dl className="flex flex-wrap items-center gap-6 text-sm">
                        <div>
                          <dt className="text-xs text-indigo-700">Players</dt>
                          <dd className="font-semibold text-indigo-900">{players.length}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-indigo-700">Courts</dt>
                          <dd className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              value={schedulePrefs.courts}
                              onChange={(e) => {
                                const next = parseInt(e.target.value || "1", 10);
                                if (Number.isFinite(next)) updateSchedulePrefs({ courts: next });
                              }}
                              className="h-9 w-16 border-indigo-200 bg-white text-indigo-900"
                            />
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs text-indigo-700">This wave matches</dt>
                          <dd className="font-semibold text-indigo-900">{waveMatches.length || "-"}</dd>
                        </div>
                      </dl>
                      {canAdvanceWave && (
                        <Button onClick={advanceR1Wave} variant="default">
                          Advance to Wave {currentWave + 1}
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-semibold text-indigo-800 shadow-sm">
                  Games to 21
                </div>
                <div className="space-y-3">
                  {r1?.matches.map((m) => (
                    <MatchCard key={m.id} matchId={m.id} />
                  ))}
                  {r1 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                      <div className="text-xs text-slate-500">
                        Completed matches: {completedMatches}/{totalMatchesPlanned} � Avg games per player: {averageGames.toFixed(1)} /
                        {schedulePrefs.r1TargetGamesPerPlayer}
                      </div>
                        <div className="flex items-center gap-2">
                        {currentWave > 0 && waveMatches.some((m) => m.status !== "completed") && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              const target = 21;
                              waveMatches
                                .filter((m) => m.status !== "completed")
                                .forEach((m) => {
                                  const [a, b] = randomScoreForTarget(target);
                                  submitScore(m.id, a, b);
                                });
                            }}
                          >
                            Randomize current wave
                          </Button>
                        )}
                        {r1?.currentWave === 0 && (
                          <Button onClick={advanceR1Wave}>Start Wave 1</Button>
                        )}
                        {canCloseRound1 && (
                          <Button onClick={() => closeRound1()}>Close Round 1 + Generate Round 2</Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="2">
                <div className="mb-3 flex justify-end">
                  {r2 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const target = 15;
                        r2.matches
                          .filter((m) => m.status !== "completed")
                          .forEach((m) => {
                            const [a, b] = randomScoreForTarget(target);
                            submitScore(m.id, a, b);
                          });
                      }}
                    >
                      Randomize scores for Round 2
                    </Button>
                  )}
                </div>
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-semibold text-indigo-800 shadow-sm">
                  Games to 15
                </div>
                <div className="space-y-3">
                  {r2?.matches.map((m) => (
                    <MatchCard key={m.id} matchId={m.id} />
                  ))}
                  {r2 && (
                    <div className="pt-2">
                      <Button onClick={() => closeRound2()}>Close Round 2 + Final Four</Button>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="3">
                <div className="mb-3 flex justify-end">
                  {r3 && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const target = 15;
                        r3.matches
                          .filter((m) => m.status !== "completed")
                          .forEach((m) => {
                            const [a, b] = randomScoreForTarget(target);
                            submitScore(m.id, a, b);
                          });
                      }}
                    >
                      Randomize scores for Round 3
                    </Button>
                  )}
                </div>
                <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-semibold text-indigo-800 shadow-sm">
                  Games to 15
                </div>
                <div className="space-y-3">
                  {r3?.matches.map((m) => (
                    <MatchCard key={m.id} matchId={m.id} />
                  ))}
                  {r3 && (
                    <div className="pt-2">
                      <Button onClick={() => closeEvent()}>Close Event</Button>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
      <div className="lg:sticky lg:top-20 self-start lg:col-start-3 lg:justify-self-end">
        <Leaderboard />
      </div>
    </div>
  );
}






