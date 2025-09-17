"use client";

import TopBar from "@/components/TopBar";
import PlayersTable from "@/components/PlayersTable";
import RoundsEditor from "@/components/RoundsEditor";
import { EventProvider } from "@/lib/context";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Home() {
  return (
    <EventProvider>
      <TopBar />
      <main className="mx-auto max-w-6xl p-4">
        <Tabs defaultValue="players">
          <TabsList className="flex mx-auto">
            <TabsTrigger value="players">Tournament setup</TabsTrigger>
            <TabsTrigger value="rounds">Rounds</TabsTrigger>
          </TabsList>
          <TabsContent value="players" className="mt-6">
            <PlayersTable />
          </TabsContent>
          <TabsContent value="rounds" className="mt-6">
            <RoundsEditor />
          </TabsContent>
        </Tabs>
      </main>
    </EventProvider>
  );
}
