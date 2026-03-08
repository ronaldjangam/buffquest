"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useDragControls, PanInfo } from "framer-motion";
import { useQuests } from "@/context/QuestContext";
import { useToast } from "@/context/ToastContext";

interface CreateQuestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CAMPUS_ZONES = [
  { name: "Norlin Library", lng: -105.2730, lat: 40.0085 },
  { name: "Duane Physics", lng: -105.2670, lat: 40.0060 },
  { name: "UMC", lng: -105.2720, lat: 40.0050 },
  { name: "Engineering Center", lng: -105.2635, lat: 40.0070 },
  { name: "C4C", lng: -105.2635, lat: 40.0043 },
  { name: "Rec Center", lng: -105.2680, lat: 40.0090 },
  { name: "ATLAS", lng: -105.2630, lat: 40.0065 },
  { name: "SEEC", lng: -105.2410, lat: 40.0095 },
];

export default function CreateQuestModal({ isOpen, onClose }: CreateQuestModalProps) {
  const { addQuest, user } = useQuests();
  const { addToast } = useToast();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bounty, setBounty] = useState(10);
  const [zoneIndex, setZoneIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [moderationError, setModerationError] = useState("");

  const selectedZone = CAMPUS_ZONES[zoneIndex];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || bounty <= 0) return;

    setIsSubmitting(true);
    setModerationError("");

    // AI Moderation and Database insertion are now handled in context.addQuest

    const result = await addQuest({
      title,
      description,
      bounty,
      buildingId: zoneIndex + 1, // Pass ID (1-based index)
      longitude: selectedZone.lng,
      latitude: selectedZone.lat,
      building: selectedZone.name,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setModerationError(result.error || "Failed to post quest.");
      setIsSubmitting(false);
      return;
    }

    addToast(`Quest deployed! −${bounty} credits`, "reward");

    // Reset form
    setTitle("");
    setDescription("");
    setBounty(10);
    setZoneIndex(0);
    setModerationError("");
    onClose();
  };

  const dragY = useMotionValue(0);
  const dragControls = useDragControls();

  const handleDragEnd = useCallback((_e: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 120 || info.velocity.y > 500) {
      dragY.set(0);
      onClose();
    }
  }, [onClose, dragY]);

  // Reset dragY whenever the modal reopens
  React.useEffect(() => {
    if (isOpen) {
      dragY.set(0);
    }
  }, [isOpen, dragY]);

  if (!user) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          {/* Dark Backdrop */}
          <motion.div
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
          />

          {/* Modal Container — Draggable */}
          <motion.div
            initial={{ y: 800, opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 800, opacity: 0.8 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={handleDragEnd}
            className="relative w-full sm:w-[500px] max-h-[90vh] overflow-y-auto liquid-glass-dark rounded-t-[40px] sm:rounded-[40px] border-b-0 sm:border-b pointer-events-auto"
            style={{ paddingBottom: 'max(var(--sab), 2rem)', y: dragY }}
          >
            {/* Drag Handle Bar */}
            <div
              onPointerDown={(e) => dragControls.start(e)}
              className="w-full flex justify-center pt-4 pb-2 cursor-grab active:cursor-grabbing touch-none"
            >
              <div className="w-12 h-1.5 bg-white/30 rounded-full hover:bg-white/50 transition-colors" />
            </div>

            <div className="p-6 pt-10 sm:pt-8 w-full">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md flex items-center gap-2">
                  <span className="text-yellow-400">✚</span> Post Quest
                </h2>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Credit Balance Pill */}
              <div className="mb-5 flex items-center gap-2">
                <span className="bg-yellow-400/10 border border-yellow-400/20 text-yellow-400 text-xs font-black px-3 py-1.5 rounded-full tracking-wider">
                  Balance: {user.credits} 💰
                </span>
                {user.credits < bounty && (
                  <span className="text-red-400 text-xs font-bold">Insufficient credits!</span>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Title Input */}
                <div className="space-y-2">
                  <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Quest Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Need Coffee to Norlin"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium"
                    required
                    maxLength={120}
                  />
                </div>

                {/* Building Zone */}
                <div className="space-y-2">
                  <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Location Zone</label>
                  <select
                    value={zoneIndex}
                    onChange={(e) => setZoneIndex(Number(e.target.value))}
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium appearance-none cursor-pointer"
                  >
                    {CAMPUS_ZONES.map((zone, i) => (
                      <option key={zone.name} value={i} className="bg-slate-900">{zone.name}</option>
                    ))}
                  </select>
                </div>

                {/* Bounty Slider/Input */}
                <div className="space-y-2 bg-yellow-500/10 p-5 rounded-[24px] border border-yellow-500/20">
                  <label className="text-xs font-black tracking-widest text-yellow-500/80 uppercase flex justify-between items-center w-full">
                    <span>Reward Bounty</span>
                    <span className="text-yellow-400 text-lg font-black tracking-tighter">{bounty} 💰</span>
                  </label>
                  <div className="flex items-center gap-4 pt-2">
                    <button 
                      type="button"
                      onClick={() => setBounty(Math.max(5, bounty - 5))}
                      className="w-10 h-10 rounded-full bg-black/40 text-yellow-500 font-bold hover:bg-black/60 flex items-center justify-center shrink-0 border border-white/5 active:scale-90 transition-transform"
                    >
                      −
                    </button>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={bounty}
                      onChange={(e) => setBounty(Number(e.target.value))}
                      className="w-full h-2 rounded-lg cursor-pointer"
                    />
                    <button 
                      type="button"
                      onClick={() => setBounty(Math.min(100, bounty + 5))}
                      className="w-10 h-10 rounded-full bg-black/40 text-yellow-500 font-bold hover:bg-black/60 flex items-center justify-center shrink-0 border border-white/5 active:scale-90 transition-transform"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Description Textarea */}
                <div className="space-y-2">
                  <label className="text-xs font-black tracking-widest text-slate-400 uppercase ml-2">Description / Instructions</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Details about the quest..."
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-400/50 focus:ring-1 focus:ring-yellow-400/50 transition-all font-medium min-h-[100px] resize-none"
                    required
                    maxLength={2000}
                  />
                </div>

                {/* Moderation Error Banner */}
                <AnimatePresence>
                  {moderationError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="liquid-glass-red rounded-2xl px-5 py-3 text-sm font-bold text-red-300 flex items-start gap-2"
                    >
                      <span className="text-red-400 text-lg shrink-0">⚠</span>
                      <span>{moderationError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.95 }}
                  type="submit"
                  disabled={isSubmitting || user.credits < bounty}
                  className="w-full squishy-btn text-yellow-900 font-black py-4 rounded-[28px] uppercase tracking-widest text-lg border-2 border-white/60 shadow-xl mt-2 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <span className="w-5 h-5 border-2 border-yellow-900/30 border-t-yellow-900 rounded-full animate-spin" />
                      AI Reviewing...
                    </span>
                  ) : (
                    "Deploy Quest"
                  )}
                </motion.button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
