"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useEvent } from "@/lib/context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Button from "@/components/ui/button";
import { Trophy, Crown, TrendingUp, TrendingDown, Award, Download, RotateCcw } from "lucide-react";
import { rankPlayers } from "@/lib/elimination";

type Award = {
  id: string;
  title: string;
  emoji: string;
  playerId: string;
  description: string;
};

export default function PostTournamentScreen() {
  const { players, rounds, initialRatingsById, exportAnalysisCSV, exportRatingsJSON, resetAll } = useEvent();

  // Calculate final rankings
  const finalRankings = useMemo(() => {
    return rankPlayers(players, rounds);
  }, [players, rounds]);

  // Find the champion (top player from Final Four)
  const champion = finalRankings[0];
  const runnerUp = finalRankings[1];
  const thirdPlace = finalRankings[2];

  // Calculate awards
  const awards = useMemo((): Award[] => {
    if (players.length === 0) return [];

    const awardsCalculated: Award[] = [];
    const initialRatings = initialRatingsById || {};

    // Champion
    if (champion) {
      awardsCalculated.push({
        id: "champion",
        title: "Champion",
        emoji: "🏆",
        playerId: champion.id,
        description: "Tournament winner"
      });
    }

    // Fastest Rise (biggest Elo gain)
    const eloGains = players
      .map(p => ({
        player: p,
        gain: p.rating - (initialRatings[p.id] || p.rating)
      }))
      .filter(p => p.gain > 0)
      .sort((a, b) => b.gain - a.gain);

    if (eloGains.length > 0) {
      awardsCalculated.push({
        id: "fastest-rise",
        title: "Fastest Rise",
        emoji: "⚡",
        playerId: eloGains[0].player.id,
        description: `+${eloGains[0].gain} Elo rating`
      });
    }

    // Sharpshooter (highest average points per game)
    const avgPointsScored = players
      .filter(p => p.gamesPlayed > 0)
      .map(p => ({
        player: p,
        avg: p.pointsFor / p.gamesPlayed
      }))
      .sort((a, b) => b.avg - a.avg);

    if (avgPointsScored.length > 0) {
      awardsCalculated.push({
        id: "sharpshooter",
        title: "Sharpshooter",
        emoji: "🎯",
        playerId: avgPointsScored[0].player.id,
        description: `${avgPointsScored[0].avg.toFixed(1)} pts/game average`
      });
    }

    // Iron Wall (lowest points conceded per game)
    const avgPointsConceded = players
      .filter(p => p.gamesPlayed > 0)
      .map(p => ({
        player: p,
        avg: p.pointsAgainst / p.gamesPlayed
      }))
      .sort((a, b) => a.avg - b.avg);

    if (avgPointsConceded.length > 0) {
      awardsCalculated.push({
        id: "iron-wall",
        title: "Iron Wall",
        emoji: "🧱",
        playerId: avgPointsConceded[0].player.id,
        description: `Only ${avgPointsConceded[0].avg.toFixed(1)} pts/game conceded`
      });
    }

    return awardsCalculated;
  }, [players, initialRatingsById, champion]);

  const confettiAnimation = {
    initial: { opacity: 0, y: -20 },
    animate: {
      opacity: [0, 1, 1, 0],
      y: [0, 10, 50, 100],
      transition: { duration: 3, repeat: Infinity, repeatDelay: 1 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50">
      {/* Confetti Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`
            }}
            variants={confettiAnimation}
            initial="initial"
            animate="animate"
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-6xl p-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-2"
        >
          <h1 className="text-4xl font-bold text-amber-900">🎉 Tournament Complete! 🎉</h1>
          <p className="text-lg text-amber-700">Congratulations to all participants in this epic Turbosmash tournament!</p>
        </motion.div>

        {/* Champion Spotlight */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="border-4 border-yellow-400 bg-gradient-to-r from-yellow-100 via-amber-50 to-yellow-100 shadow-2xl">
            <CardContent className="p-8 text-center">
              <div className="space-y-4">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Trophy className="h-24 w-24 text-yellow-500 mx-auto drop-shadow-lg" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-bold text-amber-900 mb-2">CHAMPION</h2>
                  <div className="text-2xl font-semibold text-amber-800">{champion?.name}</div>
                  <div className="text-amber-700">
                    Final Rating: {champion?.rating} • Record: {champion?.gamesPlayed} games
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Podium - Top 3 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
        >
          {/* 2nd Place */}
          {runnerUp && (
            <Card className="border-2 border-slate-400 bg-gradient-to-b from-slate-100 to-slate-200">
              <CardContent className="p-6 text-center">
                <Crown className="h-12 w-12 text-slate-500 mx-auto mb-2" />
                <Badge className="mb-2 bg-slate-500">2nd Place</Badge>
                <div className="font-bold text-lg">{runnerUp.name}</div>
                <div className="text-sm text-slate-600">Rating: {runnerUp.rating}</div>
              </CardContent>
            </Card>
          )}

          {/* 1st Place (Champion) - Taller */}
          <Card className="border-4 border-yellow-400 bg-gradient-to-b from-yellow-200 to-amber-200 md:-mt-4">
            <CardContent className="p-8 text-center">
              <Crown className="h-16 w-16 text-yellow-600 mx-auto mb-2" />
              <Badge className="mb-2 bg-yellow-600">Champion</Badge>
              <div className="font-bold text-xl">{champion?.name}</div>
              <div className="text-amber-700">Rating: {champion?.rating}</div>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          {thirdPlace && (
            <Card className="border-2 border-orange-400 bg-gradient-to-b from-orange-100 to-orange-200">
              <CardContent className="p-6 text-center">
                <Crown className="h-12 w-12 text-orange-500 mx-auto mb-2" />
                <Badge className="mb-2 bg-orange-500">3rd Place</Badge>
                <div className="font-bold text-lg">{thirdPlace.name}</div>
                <div className="text-sm text-orange-600">Rating: {thirdPlace.rating}</div>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* Awards Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-6 w-6 text-amber-600" />
                Special Awards
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {awards.map((award, index) => (
                  <motion.div
                    key={award.id}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 1.2 + index * 0.2 }}
                    className="text-center p-4 rounded-lg border bg-gradient-to-b from-slate-50 to-slate-100 hover:shadow-md transition-shadow"
                  >
                    <div className="text-3xl mb-2">{award.emoji}</div>
                    <div className="font-semibold text-sm text-slate-800">{award.title}</div>
                    <div className="font-bold text-slate-900">
                      {players.find(p => p.id === award.playerId)?.name}
                    </div>
                    <div className="text-xs text-slate-600 mt-1">{award.description}</div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Final Leaderboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-6 w-6 text-amber-600" />
                Final Leaderboard
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {finalRankings.map((player, index) => {
                  const initialRating = initialRatingsById?.[player.id] || player.rating;
                  const ratingChange = player.rating - initialRating;
                  const seedChange = player.seed - (index + 1);
                  const pointDiff = (player.pointsFor || 0) - (player.pointsAgainst || 0);

                  return (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.5 + index * 0.1 }}
                      className={`flex items-center justify-between p-4 rounded-lg border ${
                        index === 0
                          ? 'bg-gradient-to-r from-yellow-100 to-amber-100 border-yellow-300'
                          : index === 1
                          ? 'bg-gradient-to-r from-slate-100 to-slate-200 border-slate-300'
                          : index === 2
                          ? 'bg-gradient-to-r from-orange-100 to-orange-200 border-orange-300'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${
                          index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-slate-500' : index === 2 ? 'bg-orange-500' : 'bg-slate-400'
                        }`}>
                          {index + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-lg">{player.name}</div>
                          <div className="text-sm text-slate-600">
                            Seed #{player.seed} • {player.gamesPlayed} games • {pointDiff > 0 ? '+' : ''}{pointDiff} point diff
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-1">
                        <div className="font-semibold">
                          Rating: {player.rating}
                          <span className={`ml-2 text-sm ${ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {ratingChange >= 0 ? '+' : ''}{ratingChange}
                          </span>
                        </div>
                        {seedChange !== 0 && (
                          <div className="flex items-center gap-1 text-sm">
                            {seedChange > 0 ? (
                              <>
                                <TrendingUp className="h-4 w-4 text-green-500" />
                                <span className="text-green-600">+{seedChange} places</span>
                              </>
                            ) : (
                              <>
                                <TrendingDown className="h-4 w-4 text-red-500" />
                                <span className="text-red-600">{seedChange} places</span>
                              </>
                            )}
                          </div>
                        )}
                        {player.eliminatedAtRound && (
                          <Badge variant="secondary" className="text-xs">
                            Eliminated R{player.eliminatedAtRound}
                          </Badge>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
          className="flex flex-wrap justify-center gap-4"
        >
          <Button
            onClick={() => {
              const blob = new Blob([exportAnalysisCSV()], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "tournament-results.csv";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4 mr-2" />
            Download Results
          </Button>

          <Button
            onClick={() => {
              const blob = new Blob([exportRatingsJSON()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "final-ratings.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
            variant="secondary"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Ratings
          </Button>

          <Button
            onClick={() => {
              if (confirm("Are you sure you want to start a new tournament? This will clear all current data.")) {
                resetAll();
              }
            }}
            variant="outline"
            className="border-orange-500 text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            New Tournament
          </Button>
        </motion.div>
      </div>
    </div>
  );
}