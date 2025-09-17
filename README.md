TurboSmash Lite — 3-round doubles badminton tournament manager.

Tech: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn-like UI primitives, Framer Motion, Lucide. No backend; state persisted to localStorage with JSON import/export.

Getting Started
1) Install deps
   npm install

2) Dev server
   npm run dev
   Open http://localhost:3000

3) Production build
   npm run build
   npm start

Deploy
- Push to a Git repo and import into Vercel
- Framework preset: Next.js

Features
- Players tab: add/remove players with manual seeds, demo 12, export JSON, reset
- Rounds tab: generate Round 1; close R1 to auto-cut; generate R2; close R2 to Final Four; generate Final; enter scores per match and Elo updates apply immediately
- Leaderboard tab: live rating-sorted standings with points +/-

Notes
- Ratings are point-based Elo with round-aware K and difficulty adjustment
- LocalStorage persistence is automatic on each change
