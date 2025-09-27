"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CircleHelp, ChevronDown, Trophy, FlaskConical } from "lucide-react";
import Button from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { twMerge } from "tailwind-merge";
import { useEvent } from "@/lib/context";

const sections = [
  {
    title: "Overview",
    body: (
      <>
        <p>
          TurboSmash tracks doubles skill by sharing each game&apos;s points instead of binary wins. Every rally nudges
          ratings so the ladder keeps learning from tight games, blowouts, and everything between. Teams gain what their
          opponents lose, so the pool stays balanced.
        </p>
        <p>
          Mini-round waves keep early pairings exploratory, then progressively sharper once we learn who plays like a seed
          and who is about to upset the bracket.
        </p>
      </>
    ),
  },
  {
    title: "Expected share",
    body: (
      <>
        <p>
          Pairings are deterministic and point-based so the bracket feels fair and explainable. In the background, we still
          compute Elo from scored results for post-event analysis and future seeding. Elo uses an adjusted team average and a
          classic expected-score curve; actual share is clamped to avoid flukes.
        </p>
      </>
    ),
  },
  {
    title: "K scaling",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Information: more rallies relative to the round cap (21 in R1, 15 later) ? bigger adjustment.</li>
        <li>Uncertainty: early in the event (low average games played) ? ratings move faster.</li>
        <li>Difficulty: outplaying stronger opponents gives a boost, being upset stings more.</li>
        <li>Surprise: the further actual share strays from expected, the more both teams learn.</li>
        <li>Repeat dampers: same partners and repeat opponents squash K so familiar pairings don&apos;t oversteer.</li>
      </ul>
    ),
  },
  {
    title: "Synergy",
    body: (
      <p>
        Teams are not straight averages. A 1100 player with an 900 partner plays more like 994 because mismatched roles cost
        a few points. Balanced duos reap their full rating.
      </p>
    ),
  },
  {
    title: "Seeding prior",
    body: (
      <p>
        Seeds become R0 priors near 1000 with gentle spacing. Early matchmaking previously blended toward the prior; now
        pairings are deterministic by seed within groups. Elo doesn&apos;t affect pairings; it&apos;s used post-event.
      </p>
    ),
  },
  {
    title: "Mini-rounds",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Wave 1 snakes seeds: (1+4) vs (2+3) inside four-player blocks to sample across tiers.</li>
        <li>Wave 2 clusters by blended rating (beta = 0.4) to tighten spreads while avoiding repeats.</li>
        <li>Wave 3 leans harder on results (beta = 0.7) for near-parity matches before cuts.</li>
        <li>Round 1 clamps: ±20 in wave 1, ±30 in wave 2, ±40 after that. Later rounds allow ±40.</li>
      </ul>
    ),
  },
  {
    title: "Fairness guards",
    body: (
      <ul className="list-disc space-y-1 pl-5">
        <li>Zero-sum updates keep the room centered; everyone&apos;s rating changes sum to zero per match.</li>
        <li>Clamps protect against multi-sigma swings and keep matchups feeling human-balanced.</li>
        <li>Pairing logic avoids repeat partners/opponents where possible and flags compromises.</li>
        <li>Bench rotation uses games played, idle time, then blended rating so everyone sees the court.</li>
      </ul>
    ),
  },
];

export default function TopBar() {
  const { exportRatingsJSON, exportAnalysisCSV, testMode, toggleTestMode } = useEvent();
  return (
    <motion.header
      initial={{ y: -12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/70"
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2 text-slate-900">
          <Trophy className="h-5 w-5 text-indigo-600" />
          <span className="text-sm font-semibold tracking-tight">TurboSmash</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={testMode.enabled ? "default" : "ghost"}
            size="sm"
            onClick={toggleTestMode}
            className="gap-2"
          >
            <FlaskConical className="h-4 w-4" />
            Test Mode
          </Button>
          <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary" size="sm" className="gap-2">
              <CircleHelp className="h-4 w-4" />
              How does Elo work (post-event)?
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>TurboSmash Elo manifesto</DialogTitle>
              <DialogDescription>
                Peek under the hood: why we use point share, how mini-rounds adapt, and where the guardrails live.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-8 pb-8">
              {sections.map((section) => (
                <ManifestoSection key={section.title} title={section.title}>
                  {section.body}
                </ManifestoSection>
              ))}
              <div className="mt-6 flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    const blob = new Blob([exportRatingsJSON()], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "ratings.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Ratings JSON
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    const blob = new Blob([exportAnalysisCSV()], { type: "text/csv" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "post-tournament-analysis.csv";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Export Analysis CSV
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        </div>
      </div>
    </motion.header>
  );
}

function ManifestoSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(title === "Overview");
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-5 py-3 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-200">
        <span>{title}</span>
        <ChevronDown className={twMerge("h-4 w-4 transition-transform", open ? "rotate-180" : "rotate-0")} />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-2 px-5 pb-4 pt-3 text-sm leading-relaxed text-slate-600">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
