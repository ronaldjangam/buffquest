"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { DemoLocationPreset } from "@/lib/demoScenario";

interface DemoControlPanelProps {
  demoMode: boolean;
  autoDemoRunning: boolean;
  selectedLocationId: string;
  locations: DemoLocationPreset[];
  onToggleDemo: () => void;
  onSelectLocation: (locationId: string) => void;
  onRunAutoDemo: () => void;
  onStopAutoDemo: () => void;
}

export default function DemoControlPanel({
  demoMode,
  autoDemoRunning,
  selectedLocationId,
  locations,
  onToggleDemo,
  onSelectLocation,
  onRunAutoDemo,
  onStopAutoDemo,
}: DemoControlPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="absolute bottom-28 right-4 z-20 flex flex-col items-end gap-3 pointer-events-none sm:bottom-32 sm:right-6">
      <motion.button
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => setIsExpanded((value) => !value)}
        className="pointer-events-auto rounded-full border border-cyan-300/25 bg-slate-950/80 px-4 py-3 text-xs font-black uppercase tracking-[0.2em] text-cyan-200 shadow-[0_12px_30px_rgba(8,47,73,0.45)] backdrop-blur-xl"
      >
        Demo Deck
      </motion.button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="pointer-events-auto w-[19rem] rounded-[28px] border border-white/10 bg-slate-950/80 p-4 text-white shadow-[0_24px_60px_rgba(2,6,23,0.5)] backdrop-blur-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-cyan-300">Judge Mode</p>
                <h3 className="mt-1 text-base font-black tracking-tight">Autoplay the BuffQuest story</h3>
              </div>
              <button
                onClick={onToggleDemo}
                className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em] transition-colors ${
                  demoMode
                    ? "bg-cyan-300 text-slate-950"
                    : "bg-white/10 text-slate-300 hover:bg-white/15"
                }`}
              >
                {demoMode ? "On" : "Off"}
              </button>
            </div>

            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Freeze the experience to preset campus locations and run a scripted claim-to-chat-to-reward walkthrough.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              {locations.map((location) => (
                <button
                  key={location.id}
                  onClick={() => onSelectLocation(location.id)}
                  className={`rounded-2xl border px-3 py-2 text-left transition-colors ${
                    selectedLocationId === location.id
                      ? "border-cyan-300/40 bg-cyan-300/12 text-white"
                      : "border-white/8 bg-white/[0.04] text-slate-300 hover:bg-white/[0.08]"
                  }`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.15em]">{location.name}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{location.questTitle}</p>
                </button>
              ))}
            </div>

            <div className="mt-4 flex gap-2">
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={autoDemoRunning ? onStopAutoDemo : onRunAutoDemo}
                className={`flex-1 rounded-[22px] px-4 py-3 text-sm font-black uppercase tracking-[0.16em] ${
                  autoDemoRunning
                    ? "bg-red-500/20 text-red-200 border border-red-400/30"
                    : "bg-gradient-to-r from-cyan-300 to-teal-300 text-slate-950"
                }`}
              >
                {autoDemoRunning ? "Stop Demo" : "Run Auto Demo"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}