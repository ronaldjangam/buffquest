"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useQuests, Quest } from "@/context/QuestContext";
import { useToast } from "@/context/ToastContext";
import ActiveQuestChat from "@/components/ActiveQuestChat";
import GeneratedAvatar from "@/components/GeneratedAvatar";

const MEDAL_STYLES = [
  "medal-gold border-yellow-400/40",
  "medal-silver border-slate-300/30",
  "medal-bronze border-orange-400/30",
];

const RANK_COLORS = [
  "text-yellow-400",
  "text-slate-300",
  "text-orange-400",
];

/* stagger children helper */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 22 } },
};

export default function ProfilePage() {
  const { quests, user, leaderboard, getActiveQuests, getMyQuests, completeQuest, cancelQuest } = useQuests();
  const { addToast } = useToast();
  const activeQuests = getActiveQuests();
  const myQuests = getMyQuests();

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatQuest, setActiveChatQuest] = useState<Quest | null>(null);
  const [chatRole, setChatRole] = useState<"creator" | "hunter">("hunter");
  const [activeTab, setActiveTab] = useState<"active" | "posted">("active");

  if (!user) return null;

  const openChat = (quest: Quest) => {
    setActiveChatQuest(quest);
    setChatRole(quest.creatorId === user.id ? "creator" : "hunter");
    setIsChatOpen(true);
  };

  const handleCancel = (quest: Quest) => {
    cancelQuest(quest.id);
    addToast("Quest cancelled. Credits refunded.", "info");
  };

  const completedCount = quests.filter(q => q.status === "verified" && (q.hunterId === user.id || q.creatorId === user.id)).length;

  const displayedQuests = activeTab === "active" ? activeQuests : myQuests;
  const resolvedActiveChatQuest = activeChatQuest?.id
    ? quests.find((quest) => quest.id === activeChatQuest.id) || activeChatQuest
    : null;

  return (
    <main className="relative h-[100dvh] w-full overflow-y-auto overscroll-y-contain bg-[#060a14] text-slate-100" style={{ paddingTop: 'var(--sat)', paddingBottom: 'var(--sab)' }}>

      {/* ─── Ambient Background Orbs ─── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-yellow-500/[0.07] rounded-full blur-[120px]" />
        <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-purple-600/[0.06] rounded-full blur-[140px]" />
        <div className="absolute -bottom-24 left-1/4 w-80 h-80 bg-cyan-500/[0.05] rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-2xl min-h-full">

        {/* ─── Header ─── */}
        <motion.div
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
          className="sticky top-0 z-20 px-5 py-4 sm:px-8 sm:py-5 flex items-center justify-between"
          style={{ background: "linear-gradient(to bottom, #060a14 60%, transparent)" }}
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="bg-white/[0.08] backdrop-blur-xl hover:bg-white/[0.15] active:scale-90 transition-all w-11 h-11 flex items-center justify-center rounded-full text-lg border border-white/[0.06]">
              ←
            </Link>
            <GeneratedAvatar name={user.name} size="lg" className="shadow-[0_12px_28px_rgba(15,23,42,0.35)]" />
            <div>
              <h1 className="text-xl font-black tracking-tight drop-shadow-md">{user.name}&apos;s Profile</h1>
              <p className="text-[11px] text-slate-500 font-semibold tracking-wide">{user.email}</p>
            </div>
          </div>
          {user.isVerifiedStudent && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 20, delay: 0.3 }}
              className="bg-green-500/10 backdrop-blur-xl border border-green-500/25 text-green-400 text-[10px] font-black px-3.5 py-1.5 rounded-full uppercase tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.15)]"
            >
              ✦ Verified
            </motion.span>
          )}
        </motion.div>

        {/* ─── Profile Content ─── */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="px-5 sm:px-8 pb-12 space-y-7"
        >

          {/* ─── Stats Cards ─── */}
          <motion.section variants={fadeUp} className="grid grid-cols-3 gap-3">
            {/* Credits */}
            <motion.div
              whileHover={{ scale: 1.06, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="relative overflow-hidden bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 rounded-[28px] flex flex-col items-center justify-center text-center cursor-default group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-3xl mb-1.5 drop-shadow-[0_0_16px_rgba(255,214,10,0.7)] relative z-10">💰</span>
              <span className="text-3xl font-black text-white drop-shadow-md tracking-tighter relative z-10">{user.credits}</span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 relative z-10">Credits</span>
            </motion.div>

            {/* Notoriety */}
            <motion.div
              whileHover={{ scale: 1.06, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="relative overflow-hidden bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 rounded-[28px] flex flex-col items-center justify-center text-center cursor-default group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-3xl mb-1.5 drop-shadow-[0_0_16px_rgba(168,85,247,0.7)] relative z-10">🔥</span>
              <span className="text-3xl font-black text-white drop-shadow-md tracking-tighter relative z-10">{user.notoriety}</span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 relative z-10">Notoriety</span>
            </motion.div>

            {/* Completed */}
            <motion.div
              whileHover={{ scale: 1.06, y: -4 }}
              whileTap={{ scale: 0.96 }}
              className="relative overflow-hidden bg-white/[0.04] backdrop-blur-xl border border-white/[0.08] p-5 rounded-[28px] flex flex-col items-center justify-center text-center cursor-default group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/[0.08] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <span className="text-3xl mb-1.5 drop-shadow-[0_0_16px_rgba(34,197,94,0.6)] relative z-10">✦</span>
              <span className="text-3xl font-black text-white drop-shadow-md tracking-tighter relative z-10">{completedCount}</span>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1 relative z-10">Done</span>
            </motion.div>
          </motion.section>

          {/* ─── Tab Bar ─── */}
          <motion.section variants={fadeUp}>
            <div className="flex gap-2 mb-4">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setActiveTab("active")}
                className={`relative px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  activeTab === "active"
                    ? "bg-yellow-400/15 text-yellow-400 border border-yellow-400/30 shadow-[0_0_20px_rgba(255,214,10,0.1)]"
                    : "bg-white/[0.04] text-slate-500 border border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                Active ({activeQuests.length})
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setActiveTab("posted")}
                className={`relative px-5 py-2.5 rounded-full text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 ${
                  activeTab === "posted"
                    ? "bg-purple-400/15 text-purple-400 border border-purple-400/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]"
                    : "bg-white/[0.04] text-slate-500 border border-white/[0.06] hover:text-slate-300 hover:bg-white/[0.08]"
                }`}
              >
                My Quests ({myQuests.length})
              </motion.button>
            </div>

            {/* Quest Cards */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ type: "spring", stiffness: 300, damping: 26 }}
                className="space-y-3"
              >
                {displayedQuests.length === 0 ? (
                  <div className="bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-10 rounded-[32px] text-center">
                    <p className="text-slate-500 font-bold mb-5 text-sm">
                      {activeTab === "active" ? "No active quests right now." : "You haven\u0027t posted any quests yet."}
                    </p>
                    <Link href="/">
                      <motion.button whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.95 }} className="squishy-btn text-yellow-900 px-7 py-3 rounded-full font-black uppercase tracking-widest text-xs border-2 border-white/60 shadow-lg">
                        {activeTab === "active" ? "Find Quests" : "Post a Quest"}
                      </motion.button>
                    </Link>
                  </div>
                ) : (
                  displayedQuests.map((quest, i) => (
                    <motion.div
                      key={quest.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, type: "spring", stiffness: 280, damping: 24 }}
                      whileHover={{ scale: 1.01 }}
                      className={`relative overflow-hidden bg-white/[0.04] backdrop-blur-xl border border-white/[0.07] p-5 rounded-[24px] group ${
                        activeTab === "active" ? "border-l-[3px] border-l-yellow-400/60" : "border-l-[3px] border-l-purple-400/60"
                      }`}
                    >
                      {/* Hover glow */}
                      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                        activeTab === "active"
                          ? "bg-gradient-to-r from-yellow-500/[0.04] to-transparent"
                          : "bg-gradient-to-r from-purple-500/[0.04] to-transparent"
                      }`} />

                      <div className="flex justify-between items-start mb-2 relative z-10">
                        <h3 className="font-bold text-white text-[1rem] leading-tight tracking-tight">{quest.title}</h3>
                        <span className="font-black text-yellow-400 bg-yellow-400/10 px-3 py-1 rounded-full tracking-tight border border-yellow-400/20 text-sm shrink-0 ml-3 shadow-[0_0_12px_rgba(255,214,10,0.08)]">
                          {quest.bounty} 💰
                        </span>
                      </div>

                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mb-1 font-medium relative z-10">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" /> {quest.building}
                      </p>

                      <p className="text-xs text-slate-500 mb-3.5 relative z-10">
                        Status:{" "}
                        <span className={`font-black ${
                          activeTab === "active"
                            ? quest.status === "claimed" ? "text-green-400" : "text-yellow-400"
                            : quest.status === "open" ? "text-blue-400"
                            : quest.status === "claimed" ? "text-green-400"
                            : quest.status === "completed" ? "text-yellow-400"
                            : "text-slate-400"
                        }`}>
                          {activeTab === "active"
                            ? quest.status === "claimed" ? "In Progress" : "Awaiting Verification"
                            : quest.status === "open" ? "Waiting for Hunter"
                            : quest.status === "claimed" ? "Hunter Active"
                            : quest.status === "completed" ? "Needs Your Verification"
                            : quest.status
                          }
                        </span>
                      </p>

                      <div className="flex gap-2.5 relative z-10">
                        {activeTab === "active" && (
                          <>
                            <motion.button onClick={() => openChat(quest)} whileTap={{ scale: 0.9 }} className="flex-1 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-black py-3 rounded-[18px] transition-all border border-white/[0.08] uppercase tracking-widest backdrop-blur-sm">Chat</motion.button>
                            {quest.hunterId === user.id && quest.status === "claimed" && (
                              <motion.button onClick={() => { completeQuest(quest.id); addToast("Marked as complete!", "success"); }} whileTap={{ scale: 0.9 }} className="flex-1 squishy-btn text-yellow-900 text-xs font-black py-3 rounded-[18px] uppercase tracking-widest border border-white/40">Complete</motion.button>
                            )}
                          </>
                        )}
                        {activeTab === "posted" && (
                          <>
                            {quest.status === "completed" && (
                              <motion.button onClick={() => openChat(quest)} whileTap={{ scale: 0.9 }} className="flex-1 squishy-btn text-yellow-900 text-xs font-black py-3 rounded-[18px] uppercase tracking-widest border border-white/40">Verify & Reward</motion.button>
                            )}
                            {quest.status === "claimed" && (
                              <motion.button onClick={() => openChat(quest)} whileTap={{ scale: 0.9 }} className="flex-1 bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-black py-3 rounded-[18px] transition-all border border-white/[0.08] uppercase tracking-widest backdrop-blur-sm">Chat</motion.button>
                            )}
                            {(quest.status === "open" || quest.status === "claimed") && (
                              <motion.button onClick={() => handleCancel(quest)} whileTap={{ scale: 0.9 }} className="px-5 py-3 rounded-[18px] bg-white/[0.04] text-slate-500 text-xs font-black uppercase tracking-widest hover:bg-red-500/[0.12] hover:text-red-400 hover:border-red-500/20 transition-all border border-white/[0.06]">Cancel</motion.button>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  ))
                )}
              </motion.div>
            </AnimatePresence>
          </motion.section>

          {/* ─── Leaderboard ─── */}
          <motion.section variants={fadeUp}>
            <div className="flex items-center gap-3 mb-4 px-1">
              <h2 className="text-lg font-black text-white drop-shadow-sm tracking-tight">Campus Leaderboard</h2>
              <span className="text-[10px] font-black bg-purple-500/10 text-purple-400 px-2.5 py-1 rounded-full border border-purple-500/15 tracking-widest uppercase">Top {leaderboard.length}</span>
            </div>
            <div className="bg-white/[0.03] backdrop-blur-xl rounded-[28px] overflow-hidden border border-white/[0.06]">
              {leaderboard.map((entry, i) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.07, type: "spring", stiffness: 260, damping: 22 }}
                  whileHover={{ backgroundColor: "rgba(255,255,255,0.04)" }}
                  className={`flex items-center px-5 py-4 transition-colors relative ${
                    i < leaderboard.length - 1 ? "border-b border-white/[0.04]" : ""
                  } ${entry.isYou ? "bg-white/[0.04]" : ""} ${i < 3 ? MEDAL_STYLES[i] : ""}`}
                >
                  {/* Rank glow for top 3 */}
                  {i < 3 && (
                    <div className={`absolute left-0 top-0 bottom-0 w-1 rounded-r-full ${
                      i === 0 ? "bg-yellow-400 shadow-[0_0_12px_rgba(255,214,10,0.5)]"
                      : i === 1 ? "bg-slate-300 shadow-[0_0_12px_rgba(203,213,225,0.3)]"
                      : "bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.4)]"
                    }`} />
                  )}

                  <span className={`font-black w-8 text-lg text-center drop-shadow-md ${
                    i < 3 ? RANK_COLORS[i] : "text-slate-600"
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="text-2xl mr-3 drop-shadow-md">{entry.avatar}</span>
                  <span className="font-bold text-white flex-1 text-[0.95rem] tracking-tight">
                    {entry.name}
                    {entry.isYou && <span className="text-slate-500 text-xs ml-1.5 font-semibold">(You)</span>}
                  </span>
                  <span className="font-black text-purple-400 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/15 tracking-tight text-sm shadow-[0_0_12px_rgba(168,85,247,0.08)]">
                    {entry.notoriety} 🔥
                  </span>
                </motion.div>
              ))}
            </div>
          </motion.section>

        </motion.div>
      </div>

      <ActiveQuestChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        quest={resolvedActiveChatQuest}
        role={chatRole}
      />
    </main>
  );
}
