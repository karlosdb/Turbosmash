"use client";

import { useEvent } from "@/lib/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Button from "@/components/ui/button";
import MatchCard from "@/components/MatchCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Leaderboard from "@/components/Leaderboard";

export default function RoundsEditor() {
  const { rounds, closeRound1, closeRound2, closeEvent, currentRound } = useEvent();
  const r1 = rounds.find((r) => r.index === 1);
  const r2 = rounds.find((r) => r.index === 2);
  const r3 = rounds.find((r) => r.index === 3);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2">
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
              <div className="space-y-3">
                {r1?.matches.map((m) => (
                  <MatchCard key={m.id} matchId={m.id} />
                ))}
                {r1 && (
                  <div className="pt-2">
                    <Button onClick={() => closeRound1()}>Close Round 1 → Generate Round 2</Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="2">
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
      <div className="lg:sticky lg:top-20 self-start">
        <Leaderboard />
      </div>
    </div>
  );
}


