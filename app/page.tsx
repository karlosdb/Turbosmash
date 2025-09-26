"use client";

import TopBar from "@/components/TopBar";
import PlayersTable from "@/components/PlayersTable";
import RoundsEditor from "@/components/RoundsEditor";
import PostTournamentScreen from "@/components/PostTournamentScreen";
import { EventProvider, useEvent } from "@/lib/context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function AppContent() {
  const { rounds } = useEvent();

  // Check if tournament is complete (Round 3 is closed)
  const tournamentComplete = rounds.some(r => r.index === 3 && r.status === "closed");

  // Check if there's an active tournament loaded
  const hasActiveTournament = rounds.length > 0;

  if (tournamentComplete) {
    return <PostTournamentScreen />;
  }

  // Prevent tab changes to rounds when no tournament is loaded
  const handleTabChange = (value: string) => {
    if (value === "rounds" && !hasActiveTournament) return;
  };

  return (
    <>
      <TopBar />
      <main className="mx-auto max-w-6xl p-4">
        <Tabs defaultValue="players" onValueChange={handleTabChange}>
          <div className="flex justify-center">
            <TabsList className="w-fit">
              <TabsTrigger value="players">Tournament setup</TabsTrigger>
              <TabsTrigger
                value="rounds"
                disabled={!hasActiveTournament}
                className={!hasActiveTournament ? "opacity-50 cursor-not-allowed" : ""}
              >
                Rounds {!hasActiveTournament && "🔒"}
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="players" className="mt-6">
            <PlayersTable />
          </TabsContent>
          <TabsContent value="rounds" className="mt-6">
            <RoundsEditor />
          </TabsContent>
        </Tabs>
      </main>
    </>
  );
}

export default function Home() {
  return (
    <EventProvider>
      <AppContent />
    </EventProvider>
  );
}

