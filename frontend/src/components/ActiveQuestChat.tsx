"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuests, Quest } from "@/context/QuestContext";
import { useToast } from "@/context/ToastContext";
import { getBackendApiUrl, getBackendWebSocketUrl } from "@/lib/api";

interface Message {
  id: string;
  sender: "you" | "other" | "system";
  text: string;
  timestamp: string;
}

interface BackendChatMessage {
  id: string | number;
  sender_id: string;
  text: string;
  created_at: string;
}

type ConnectionState = "connecting" | "live" | "fallback" | "offline";

interface ActiveQuestChatProps {
  isOpen: boolean;
  onClose: () => void;
  quest: Quest | null;
  role: "creator" | "hunter";
  demoMode?: boolean;
  demoMessages?: Message[];
  demoParticipantName?: string;
  demoTypingText?: string | null;
  demoCelebrateToken?: number;
  onDemoSendMessage?: (text: string) => void;
  onDemoComplete?: () => void;
  onDemoVerify?: () => void;
  onDemoCancel?: () => void;
}

const QUICK_REPLIES = ["I am here", "Running 2 min late", "Need clarification", "Done - check it out"];

export default function ActiveQuestChat({
  isOpen,
  onClose,
  quest,
  role,
  demoMode = false,
  demoMessages = [],
  demoParticipantName = "Quest Partner",
  demoTypingText = null,
  demoCelebrateToken = 0,
  onDemoSendMessage,
  onDemoComplete,
  onDemoVerify,
  onDemoCancel,
}: ActiveQuestChatProps) {
  const { completeQuest, verifyQuest, cancelQuest } = useQuests();
  const { addToast } = useToast();

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [showReward, setShowReward] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>(demoMode ? "live" : "connecting");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const mapBackendMessage = useCallback((msg: BackendChatMessage): Message => {
    const isYou = msg.sender_id === quest?.creatorId && role === "creator"
      ? true
      : msg.sender_id === quest?.hunterId && role === "hunter";

    return {
      id: String(msg.id),
      sender: isYou ? "you" : "other",
      text: msg.text,
      timestamp: new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
  }, [quest?.creatorId, quest?.hunterId, role]);

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessages((current) => {
      const merged = [...current];
      for (const nextMessage of incoming) {
        if (!merged.some((existing) => existing.id === nextMessage.id)) {
          merged.push(nextMessage);
        }
      }
      return merged;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    if (!quest || demoMode) {
      return;
    }

    try {
      const response = await fetch(getBackendApiUrl(`quests/${quest.id}/messages`), {
        credentials: "include",
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json() as BackendChatMessage[];
      if (!Array.isArray(data)) {
        return;
      }

      mergeMessages(data.map(mapBackendMessage));
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  }, [demoMode, mapBackendMessage, mergeMessages, quest]);

  const startPolling = useCallback(() => {
    if (demoMode || pollTimerRef.current) {
      return;
    }

    pollTimerRef.current = setInterval(() => {
      void loadHistory();
    }, 4000);
  }, [demoMode, loadHistory]);

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [demoMessages, isOpen, messages]);

  useEffect(() => {
    if (!demoMode || demoCelebrateToken === 0) {
      return;
    }

    const startTimer = setTimeout(() => setShowReward(true), 0);
    const stopTimer = setTimeout(() => setShowReward(false), 2200);
    return () => {
      clearTimeout(startTimer);
      clearTimeout(stopTimer);
    };
  }, [demoCelebrateToken, demoMode]);

  useEffect(() => {
    if (!isOpen || !quest) {
      stopPolling();
      return;
    }

    if (demoMode) {
      stopPolling();
      return;
    }

    let isCancelled = false;
    const resetTimer = setTimeout(() => {
      setMessages([]);
      setConnectionState("connecting");
    }, 0);
    const historyTimer = setTimeout(() => {
      void loadHistory();
    }, 0);

    const wsUrl = getBackendWebSocketUrl(`quests/${quest.id}/ws`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (isCancelled) {
        return;
      }
      stopPolling();
      setConnectionState("live");
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        mergeMessages([mapBackendMessage(payload)]);
      } catch (err) {
        console.error("Message parse error:", err);
      }
    };

    ws.onerror = () => {
      if (isCancelled) {
        return;
      }
      setConnectionState("fallback");
      startPolling();
    };

    ws.onclose = () => {
      if (isCancelled) {
        return;
      }
      console.log("Chat disconnected.");
      setConnectionState("fallback");
      startPolling();
    };

    return () => {
      isCancelled = true;
      clearTimeout(resetTimer);
      clearTimeout(historyTimer);
      stopPolling();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [demoMode, isOpen, loadHistory, mapBackendMessage, mergeMessages, quest, role, startPolling, stopPolling]);

  const sendViaHttpFallback = useCallback(async (text: string) => {
    if (!quest) {
      return false;
    }

    try {
      const response = await fetch(getBackendApiUrl(`quests/${quest.id}/messages`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        return false;
      }

      const payload = await response.json() as BackendChatMessage;
      mergeMessages([mapBackendMessage(payload)]);
      setConnectionState("fallback");
      return true;
    } catch (error) {
      console.error("Failed to send fallback message", error);
      return false;
    }
  }, [mapBackendMessage, mergeMessages, quest]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || !quest) {
      return;
    }

    if (demoMode) {
      onDemoSendMessage?.(trimmed);
      setInputText("");
      return;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(trimmed);
      setInputText("");
      return;
    }

    const didSend = await sendViaHttpFallback(trimmed);
    if (didSend) {
      setInputText("");
      addToast("Message sent using backup mode.", "info");
      return;
    }

    setConnectionState("offline");
    addToast("Chat is disconnected. Try again in a moment.", "error");
  };

  const handleComplete = () => {
    if (!quest) return;
    if (demoMode) {
      onDemoComplete?.();
      return;
    }
    completeQuest(quest.id);
    addToast("Quest marked as completed! Awaiting creator verification.", "info");
  };

  const handleVerify = () => {
    if (!quest) return;
    if (demoMode) {
      onDemoVerify?.();
      setShowReward(true);
      setTimeout(() => setShowReward(false), 2200);
      addToast(`+${quest.bounty} credits earned!`, "reward");
      return;
    }
    verifyQuest(quest.id);
    setShowReward(true);
    addToast(`+${quest.bounty} credits earned! 🎉`, "reward");
    setTimeout(() => {
      setShowReward(false);
      onClose();
    }, 2500);
  };

  const handleCancel = () => {
    if (!quest) return;
    if (demoMode) {
      onDemoCancel?.();
      onClose();
      return;
    }
    cancelQuest(quest.id);
    addToast("Quest cancelled. Credits refunded.", "info");
    onClose();
  };

  if (!quest) return null;

  const visibleMessages = demoMode ? demoMessages : messages;
  const isChatLocked = quest.status === "verified" || quest.status === "rewarded" || quest.status === "cancelled";
  const participantLabel = demoMode
    ? demoParticipantName
    : role === "hunter"
      ? "Chat with creator"
      : "Chat with hunter";
  const connectionLabel = demoMode
    ? "demo"
    : connectionState === "live"
      ? "live"
      : connectionState === "fallback"
        ? "backup"
        : connectionState === "connecting"
          ? "connecting"
          : "offline";

  return (
    <AnimatePresence>
      {isOpen && (
        <React.Fragment>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md"
          />

          {/* Chat Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 w-full h-[85dvh] z-[101] liquid-glass-dark rounded-t-[40px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10"
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex justify-between items-center bg-white/5 rounded-t-[40px]">
              <div className="flex-1 min-w-0">
                <h3 className="font-black text-white text-lg drop-shadow-sm truncate">{quest.title}</h3>
                <div className="flex items-center gap-3 mt-1">
                  <p className="text-sm font-bold text-slate-400 flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${
                      quest.status === "claimed" ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" :
                      quest.status === "completed" ? "bg-yellow-400 shadow-[0_0_8px_rgba(255,214,10,0.8)]" :
                      "bg-slate-500"
                    }`} />
                    {quest.status === "claimed" && "In Progress"}
                    {quest.status === "completed" && "Awaiting Verification"}
                    {quest.status === "verified" && "Verified ✓"}
                    {quest.status === "rewarded" && "Reward Issued ✓"}
                  </p>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200 bg-cyan-300/10 px-2 py-1 rounded-full border border-cyan-300/15">
                    {participantLabel}
                  </span>
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-300 bg-white/8 px-2 py-1 rounded-full border border-white/10">
                    {connectionLabel}
                  </span>
                  <span className="text-xs text-yellow-400 font-black bg-yellow-400/10 px-2 py-0.5 rounded-full">
                    {quest.bounty} 💰
                  </span>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition-colors shrink-0 ml-3"
              >
                ✕
              </button>
            </div>

            {/* Message Feed */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {visibleMessages.length === 0 && (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.04] px-4 py-5 text-center text-sm font-semibold text-slate-400">
                  This quest chat opens as soon as the creator and hunter are matched.
                </div>
              )}

              {visibleMessages.map((msg) => {
                const isYou = msg.sender === "you";
                const isSystem = msg.sender === "system";

                if (isSystem) {
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={msg.id}
                      className="flex justify-center"
                    >
                      <div className="max-w-[90%] rounded-full border border-cyan-300/15 bg-cyan-300/10 px-4 py-2 text-center text-xs font-black uppercase tracking-[0.16em] text-cyan-100">
                        {msg.text}
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={msg.id}
                    className={`flex flex-col ${isYou ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-5 py-3 rounded-2xl shadow-lg ${
                        isYou
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm font-bold"
                          : "bg-gradient-to-br from-pink-500/90 to-pink-600/90 text-white rounded-tl-sm font-medium"
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </motion.div>
                );
              })}

              {demoTypingText && (
                <div className="flex items-start">
                  <div className="rounded-2xl rounded-tl-sm bg-white/10 px-4 py-3 text-sm font-semibold text-slate-300">
                    {demoTypingText}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />

              {/* Reward Burst Animation */}
              <AnimatePresence>
                {showReward && (
                  <motion.div
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="flex flex-col items-center justify-center py-8"
                  >
                    <div className="text-6xl mb-3 animate-reward-burst">🎉</div>
                    <span className="text-2xl font-black text-yellow-400 glow-gold">+{quest.bounty} Credits!</span>
                    <span className="text-sm font-bold text-slate-400 mt-1">Quest Complete</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {!isChatLocked && (
              <div className="px-6 pb-1 pt-2 flex gap-2 overflow-x-auto border-t border-white/5 bg-black/10">
                {QUICK_REPLIES.map((reply) => (
                  <button
                    key={reply}
                    onClick={() => setInputText(reply)}
                    className="shrink-0 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-slate-300 transition-colors hover:bg-white/[0.1]"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Action Buttons Area */}
            {!isChatLocked && (
              <div className="px-6 py-3 border-t border-white/10 bg-black/10 flex gap-3">
                {role === "hunter" && quest.status === "claimed" && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleComplete}
                    className="flex-1 squishy-btn text-yellow-900 font-black py-3 rounded-[24px] uppercase tracking-wider text-sm"
                  >
                    Mark Completed
                  </motion.button>
                )}
                {role === "creator" && quest.status === "completed" && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={handleVerify}
                    className="flex-1 squishy-btn text-yellow-900 font-black py-3 rounded-[24px] uppercase tracking-wider text-sm"
                  >
                    Verify & Reward
                  </motion.button>
                )}
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCancel}
                  className="px-5 py-3 rounded-[24px] bg-white/10 text-slate-400 font-black uppercase tracking-wider text-sm hover:bg-red-500/20 hover:text-red-400 transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            )}

            {/* Input Area */}
            {!isChatLocked && (
              <div className="p-4 sm:p-6 border-t border-white/10 bg-black/20" style={{ paddingBottom: 'calc(var(--sab) + 1.5rem)' }}>
                <form onSubmit={handleSend} className="relative flex items-center">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-white/10 border border-white/20 text-white placeholder-slate-400 rounded-full py-4 pl-6 pr-16 focus:outline-none focus:ring-2 focus:ring-yellow-400/50 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-yellow-400 text-yellow-900 rounded-full flex items-center justify-center shadow-lg hover:bg-yellow-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100 transition-all font-black text-xl"
                  >
                    ↑
                  </button>
                </form>
              </div>
            )}

            {/* Locked Chat State */}
            {isChatLocked && (
              <div className="p-6 border-t border-white/10 bg-black/20 text-center" style={{ paddingBottom: 'calc(var(--sab) + 1.5rem)' }}>
                <p className="text-slate-500 font-bold text-sm">This quest session has ended.</p>
              </div>
            )}
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
