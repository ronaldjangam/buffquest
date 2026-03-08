"use client";

import { QuestProvider } from "@/context/QuestContext";
import { ToastProvider } from "@/context/ToastContext";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <QuestProvider>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QuestProvider>
  );
}
