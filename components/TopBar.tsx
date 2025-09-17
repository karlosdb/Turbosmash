"use client";

import { motion } from "framer-motion";
import { Trophy } from "lucide-react";

export default function TopBar() {
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
      </div>
    </motion.header>
  );
}


