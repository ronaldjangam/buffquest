"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { authClient } from "@/lib/auth-client";

export type QuestStatus = "open" | "claimed" | "completed" | "verified" | "cancelled" | "rewarded";

export interface Quest {
  id: string;
  title: string;
  description: string;
  bounty: number; // For compatibility (backend expects cost_credits/reward_credits)
  cost_credits?: number;
  reward_credits?: number;
  reward_notoriety?: number;
  longitude: number;
  latitude: number;
  status: QuestStatus;
  building: string;
  building_name?: string;
  creatorId?: string;
  creator_id?: string;
  hunterId?: string;
  hunter_id?: string;
  createdAt?: string;
  created_at?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  display_name?: string;
  email: string;
  credits: number;
  notoriety: number;
  isVerifiedStudent: boolean;
  is_verified_student?: boolean;
}

export interface LeaderboardEntry {
  id: string;
  rank: number;
  name: string;
  notoriety: number;
  isYou: boolean;
  avatar: string;
  display_name?: string;
}

export interface QuestDraftInput {
  title: string;
  description: string;
  bounty: number;
  buildingId: number;
  longitude: number;
  latitude: number;
  building: string;
}

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

interface BackendQuestRecord {
  id: string | number;
  title: string;
  description: string;
  reward_credits?: number;
  bounty?: number;
  building_name?: string;
  building?: string;
  creator_id?: string;
  creatorId?: string;
  hunter_id?: string;
  hunterId?: string;
  created_at?: string;
  createdAt?: string;
  longitude: number;
  latitude: number;
  status: QuestStatus;
  cost_credits?: number;
  reward_notoriety?: number;
}

interface BackendUserRecord {
  id: string;
  name?: string;
  display_name?: string;
  email: string;
  credits: number;
  notoriety: number;
  is_verified_student?: boolean;
  isVerifiedStudent?: boolean;
}

interface BackendErrorShape {
  detail?: string;
  error?: string;
}

interface QuestContextType {
  quests: Quest[];
  user: UserProfile | null;
  leaderboard: LeaderboardEntry[];
  addQuest: (quest: QuestDraftInput) => Promise<{ success: boolean; error?: string }>;
  claimQuest: (id: string) => Promise<{ success: boolean; error?: string }>;
  completeQuest: (id: string) => Promise<void>;
  verifyQuest: (id: string) => Promise<void>;
  cancelQuest: (id: string) => Promise<void>;
  getActiveQuests: () => Quest[];
  getMyQuests: () => Quest[];
  isLoading: boolean;
  refreshData: () => Promise<void>;
}

const QuestContext = createContext<QuestContextType | undefined>(undefined);

const getApiBase = () => {
  return "/api/backend";
};

const fetchOpts = (method: string, body?: JsonValue | Record<string, unknown>) => {
  const headers: HeadersInit = {};

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const opts: RequestInit = {
    method,
    headers,
    credentials: "include",
  };

  if (body !== undefined) {
    opts.body = JSON.stringify(body);
  }

  return opts;
};

export function QuestProvider({ children }: { children: ReactNode }) {
  const [quests, setQuests] = useState<Quest[]>([]);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = getApiBase();

  const { data: session, isPending: isSessionLoading } = authClient.useSession();

  const getCurrentLocation = useCallback(() => {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        reject(new Error("Geolocation is not available in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
    });
  }, []);

  const readJson = useCallback(async <T,>(response: Response): Promise<T | null> => {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return null;
    }
    return response.json() as Promise<T>;
  }, []);

  // Normalizer functions to map Python snake_case to React camelCase if necessary
  const normalizeQuest = (q: BackendQuestRecord): Quest => ({
    ...q,
    id: String(q.id),
    bounty: q.reward_credits || q.bounty || 0,
    building: q.building_name || q.building || "Campus Building",
    creatorId: q.creator_id || q.creatorId,
    hunterId: q.hunter_id || q.hunterId,
    createdAt: q.created_at || q.createdAt,
  });

  const normalizeUser = (u: BackendUserRecord): UserProfile => ({
    ...u,
    isVerifiedStudent: u.is_verified_student || u.isVerifiedStudent || false,
    name: u.display_name || u.name || "Anonymous Buff",
  });

  const refreshData = useCallback(async () => {
    try {
      const requests: Promise<Response>[] = [];
      if (session) {
        requests.push(fetch(`${apiBase}/users/me`, fetchOpts("GET")));
      }
      requests.push(
        fetch(`${apiBase}/quests?limit=100`, fetchOpts("GET")),
        fetch(`${apiBase}/leaderboard`, fetchOpts("GET")),
      );

      const results = await Promise.allSettled(requests);
      const userResult = session ? results[0] : null;
      const questsResult = results[session ? 1 : 0];
      const leaderboardResult = results[session ? 2 : 1];

      if (userResult && userResult.status === "fulfilled") {
        if (userResult.value.ok) {
          const userData = await readJson<BackendUserRecord>(userResult.value);
          if (userData && typeof userData === "object" && userData.id) {
            setUser(normalizeUser(userData));
          } else {
            console.error("Invalid user data received", userData);
            setUser(null);
          }
        } else if (userResult.value.status === 401) {
          setUser(null);
        } else {
          console.error("Failed to load user profile", userResult.value.status);
          setUser(null);
        }
      } else if (userResult && userResult.status === "rejected") {
        console.error("Failed to fetch user profile", userResult.reason);
        setUser(null);
      } else if (!session) {
        setUser(null);
      }

      if (questsResult.status === "fulfilled" && questsResult.value.ok) {
        const questsData = await readJson<BackendQuestRecord[]>(questsResult.value);
        setQuests(Array.isArray(questsData) ? questsData.map(normalizeQuest) : []);
      } else if (questsResult.status === "rejected") {
        console.error("Failed to fetch quests", questsResult.reason);
      }

      if (leaderboardResult.status === "fulfilled" && leaderboardResult.value.ok) {
        const leaderboardData = await readJson<LeaderboardEntry[]>(leaderboardResult.value);
        setLeaderboard(Array.isArray(leaderboardData) ? leaderboardData : []);
      } else {
        setLeaderboard([
          { id: "chip-id", rank: 1, name: "Chip", notoriety: 89, isYou: false, avatar: "👑" },
          { id: "ralphie-id", rank: 2, name: "Ralphie", notoriety: 12, isYou: true, avatar: "🧑‍🎓" },
          { id: "alex-id", rank: 3, name: "Alex", notoriety: 6, isYou: false, avatar: "🎒" }
        ]);
      }
    } catch (error) {
      console.error("Network error fetching initial QuestContext data", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiBase, readJson, session]);

  useEffect(() => {
    if (!isSessionLoading) {
      refreshData();
    }
  }, [refreshData, isSessionLoading, session]);

  useEffect(() => {
    if (isSessionLoading) {
      return;
    }

    const intervalId = setInterval(() => {
      void refreshData();
    }, 12000);

    return () => clearInterval(intervalId);
  }, [isSessionLoading, refreshData]);

  const addQuest = useCallback(async (questData: QuestDraftInput) => {
    if (!user) return { success: false, error: "Please log in first." };
    if (user.credits < questData.bounty) {
      return { success: false, error: "Not enough credits to post this quest." };
    }

    try {
      // First hit AI Moderation Check (Next.js API route)
      const modRes = await fetch("/api/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          title: questData.title,
          description: questData.description,
          buildingId: questData.buildingId,
          rewardCredits: questData.bounty,
          creatorId: user.id,
          skipDb: true 
        }),
      });

      const modResult = await modRes.json() as BackendErrorShape;

      if (!modRes.ok) {
        return { 
          success: false, 
          error: modResult.detail || modResult.error || "Quest flagged by AI Moderation." 
        };
      }

      // Then hit FastAPI Backend
      const backendPayload = {
        title: questData.title,
        description: questData.description,
        building_zone_id: questData.buildingId || 1, // Fallback ID
        cost_credits: questData.bounty,
        reward_credits: questData.bounty,
        reward_notoriety: 1,
        moderation_status: "approved",
      };

      const res = await fetch(`${apiBase}/quests`, fetchOpts("POST", backendPayload));
      const resData = await res.json() as BackendErrorShape;

      if (!res.ok) {
        const errorMsg = resData.detail || resData.error || "Database error creating quest.";
        return { 
          success: false, 
          error: typeof errorMsg === 'string' ? errorMsg : JSON.stringify(errorMsg) 
        };
      }

      // Refresh data to show new quest
      await refreshData();
      return { success: true };
    } catch {
      return { success: false, error: "Network error submitting quest." };
    }
  }, [apiBase, user, refreshData]);

  const claimQuest = useCallback(async (id: string) => {
    try {
      const position = await getCurrentLocation();
      const response = await fetch(
        `${apiBase}/quests/${id}/claim`,
        fetchOpts("POST", {
          user_lat: position.coords.latitude,
          user_lon: position.coords.longitude,
        })
      );

      if (!response.ok) {
        const errorData = await readJson<BackendErrorShape>(response);
        return {
          success: false,
          error: errorData?.detail || errorData?.error || "Unable to claim quest.",
        };
      }

      await refreshData();
      return { success: true };
    } catch (error) {
      console.error("Failed to claim quest", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unable to access your location.",
      };
    }
  }, [apiBase, getCurrentLocation, readJson, refreshData]);

  const completeQuest = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/quests/${id}/complete`, fetchOpts("POST"));
      await refreshData();
    } catch (error) {
      console.error("Failed to complete quest", error);
    }
  }, [apiBase, refreshData]);

  const verifyQuest = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/quests/${id}/verify`, fetchOpts("POST"));
      await fetch(`${apiBase}/quests/${id}/reward`, fetchOpts("POST"));
      await refreshData();
    } catch (error) {
      console.error("Failed to verify & reward quest", error);
    }
  }, [apiBase, refreshData]);

  const cancelQuest = useCallback(async (id: string) => {
    try {
      await fetch(`${apiBase}/quests/${id}/cancel`, fetchOpts("POST"));
      await refreshData();
    } catch (error) {
      console.error("Failed to cancel quest", error);
    }
  }, [apiBase, refreshData]);

  const getActiveQuests = useCallback(() => {
    if (!user) return [];
    return quests.filter(
      (q) =>
        (q.status === "claimed" || q.status === "completed") &&
        (q.hunterId === user.id || q.creatorId === user.id)
    );
  }, [quests, user]);

  const getMyQuests = useCallback(() => {
    if (!user) return [];
    return quests.filter(
      (q) => q.creatorId === user.id && q.status !== "cancelled" && q.status !== "verified" && q.status !== "rewarded"
    );
  }, [quests, user]);

  return (
    <QuestContext.Provider
      value={{
        quests,
        user,
        leaderboard,
        addQuest,
        claimQuest,
        completeQuest,
        verifyQuest,
        cancelQuest,
        getActiveQuests,
        getMyQuests,
        isLoading,
        refreshData,
      }}
    >
      {children}
    </QuestContext.Provider>
  );
}

export function useQuests() {
  const context = useContext(QuestContext);
  if (context === undefined) {
    throw new Error("useQuests must be used within a QuestProvider");
  }
  return context;
}
