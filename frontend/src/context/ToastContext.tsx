"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";

type ToastType = "success" | "error" | "info" | "reward";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

interface ToastDetailEntry {
  msg?: string;
}

interface ToastObjectLike {
  detail?: string | ToastDetailEntry[];
  msg?: string;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

const TOAST_DURATION = 3500;

const typeStyles: Record<ToastType, string> = {
  success: "border-green-500/40 bg-green-500/15 text-green-300",
  error: "border-red-500/40 bg-red-500/15 text-red-300",
  info: "border-blue-500/40 bg-blue-500/15 text-blue-300",
  reward: "border-yellow-400/50 bg-yellow-400/15 text-yellow-300",
};

const typeIcons: Record<ToastType, string> = {
  success: "✓",
  error: "✕",
  info: "ℹ",
  reward: "💰",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: unknown, type: ToastType = "info") => {
    let finalMessage = message;

    // Safety check: if message is an object or array (common for Pydantic/Backend errors)
    if (typeof message === "object" && message !== null) {
      const typedMessage = message as ToastObjectLike;
      try {
        // If it's a Pydantic-style error with a 'detail' or 'msg' field
        if (typedMessage.detail) {
          finalMessage = Array.isArray(typedMessage.detail)
            ? typedMessage.detail.map((err) => err.msg || JSON.stringify(err)).join(", ")
            : typeof typedMessage.detail === "string" ? typedMessage.detail : JSON.stringify(typedMessage.detail);
        } else if (typedMessage.msg) {
          finalMessage = typedMessage.msg;
        } else {
          finalMessage = JSON.stringify(message);
        }
      } catch {
        finalMessage = "An unexpected error occurred.";
      }
    }

    const id = Date.now().toString() + Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message: String(finalMessage), type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION);
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none" style={{ paddingTop: 'var(--sat)', paddingRight: 'var(--sar)' }}>
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ x: 100, opacity: 0, scale: 0.9 }}
              animate={{ x: 0, opacity: 1, scale: 1 }}
              exit={{ x: 100, opacity: 0, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`pointer-events-auto backdrop-blur-xl border rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 max-w-xs ${typeStyles[toast.type]}`}
            >
              <span className="text-lg font-black shrink-0">{typeIcons[toast.type]}</span>
              <span className="text-sm font-bold leading-tight">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
