"use client";

import { useEvent } from "@/lib/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "@/components/Leaderboard";
import { Input } from "@/components/ui/input";

export default function RoundsEditor() {
  const { rounds, players, closeRound1, closeRound2, closeEvent, currentRound, submitScore, setRound1MiniSize, generateNextMiniRound } = useEvent();
  const r1 = rounds.find((r) => r.index === 1);
  const r2 = rounds.find((r) => r.index === 2);
  const r3 = rounds.find((r) => r.index === 3);

  const randomScoreForTarget = (target: number): [number, number] => {
    const winnerA = Math.random() < 0.5;
    const losing = Math.floor(Math.random() * target); // 0..target-1
    return winnerA ? [target, losing] : [losing, target];
  };

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
              <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-base font-semibold text-indigo-800 shadow-sm">
                Games to 21
              </div>
              <div className="space-y-3">
                {r1?.matches.map((m) => (
                  <MatchCard key={m.id} matchId={m.id} />
                ))}
                {r1 && (() => {
                  const target = r1.targetGames ?? 3;
                  const completed = r1.matches.filter((m) => m.status === "completed").length;
                  const avg = players.length > 0 ? (completed * 4) / players.length : 0;
                  const size = r1.miniRoundSize ?? Math.max(1, Math.floor(players.length / 4));
                  const totalNeeded = target * players.length;
                  const perMini = size * 4;
                  const planned = Math.max(1, Math.ceil(totalNeeded / perMini));
                  const currentMini = r1.currentMiniRound ?? 0;
                  const scheduledLeft = r1.matches.some((m) => m.status !== "completed");
                  const canGenerate = !scheduledLeft && avg < target;
                  const canClose = !scheduledLeft && avg >= target;
                  return (
                    <div className="pt-2 flex items-center justify-between gap-3">
                      <div className="text-sm text-slate-600">
                        Mini-round {currentMini} of {planned} • Players avg games: {avg.toFixed(1)}/{target}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">Mini-round size</label>
                        <Input
                          type="number"
                          className="w-20"
                          min={1}
                          value={r1.miniRoundSize ?? Math.max(1, Math.floor(players.length / 4))}
                          onChange={(e) => {
                            const v = parseInt(e.target.value || "1", 10);
                            if (Number.isFinite(v)) setRound1MiniSize(Math.max(1, v));
                          }}
                        />
                        {canGenerate && (
                          <Button onClick={() => generateNextMiniRound()}>
                            Generate Next Mini-Round
                          </Button>
                        )}
                        {canClose && (
                          <Button onClick={() => closeRound1()}>Close Round 1 → Generate Round 2</Button>
                        )}
                      </div>
                    </div>
                  );
                })()}
                {r1 && (
                  <div className="pt-2 flex justify-end">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const target = 21;
                        const mini = r1.currentMiniRound ?? 1;
                        const scheduledThisMini = r1.matches.filter(
                          (m) => m.roundIndex === 1 && (m.miniRound ?? mini) === mini && m.status !== "completed"
                        );
                        scheduledThisMini.forEach((m) => {
                          const [a, b] = randomScoreForTarget(target);
                          submitScore(m.id, a, b);
                        });
                      }}
                    >
                      Randomize scores (current mini-round)
                    </Button>
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
                    <Button onClick={() => closeRound2()}>Close Round 2 → Final Four</Button>
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


