"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Map, { Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import Link from "next/link";
import CreateQuestModal from "./CreateQuestModal";
import ActiveQuestChat from "./ActiveQuestChat";
import AttendanceDrawer from "./AttendanceDrawer";
import DemoControlPanel from "./DemoControlPanel";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuests, Quest } from "@/context/QuestContext";
import { useToast } from "@/context/ToastContext";
import GeneratedAvatar from "./GeneratedAvatar";
import {
  DEMO_LOCATION_PRESETS,
  buildDemoChatSeed,
  createDemoQuest,
  createDemoReply,
  type DemoChatMessage,
} from "@/lib/demoScenario";

function hasGeolocationSupport() {
  return typeof navigator !== "undefined" && "geolocation" in navigator;
}

function getStoredDemoMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem("buffquest-demo-mode") === "1";
}

function getStoredDemoLocationId() {
  if (typeof window === "undefined") {
    return DEMO_LOCATION_PRESETS[0].id;
  }

  const storedLocation = window.localStorage.getItem("buffquest-demo-location");
  return DEMO_LOCATION_PRESETS.some((preset) => preset.id === storedLocation)
    ? storedLocation || DEMO_LOCATION_PRESETS[0].id
    : DEMO_LOCATION_PRESETS[0].id;
}

const CU_BOULDER_COORDS = {
  longitude: -105.2705,
  latitude: 40.0076,
  zoom: 14.5,
};

const CU_BOULDER_BOUNDS: [[number, number], [number, number]] = [
  [-105.280, 39.991],
  [-105.235, 40.017],
];

export default function MapMockup() {
  const { quests, user, claimQuest, getActiveQuests, isLoading } = useQuests();
  const { addToast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);
  const [liveLocation, setLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(hasGeolocationSupport() ? null : "Location unavailable");
  const [isLocating, setIsLocating] = useState(hasGeolocationSupport());

  // Active quest chat state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [activeChatQuest, setActiveChatQuest] = useState<Quest | null>(null);
  const [chatRole, setChatRole] = useState<"creator" | "hunter">("hunter");
  const [demoMode, setDemoMode] = useState(getStoredDemoMode);
  const [demoLocationId, setDemoLocationId] = useState(getStoredDemoLocationId);
  const [demoQuest, setDemoQuest] = useState<Quest | null>(() => {
    if (!getStoredDemoMode()) {
      return null;
    }

    const preset = DEMO_LOCATION_PRESETS.find((item) => item.id === getStoredDemoLocationId()) || DEMO_LOCATION_PRESETS[0];
    return createDemoQuest(preset);
  });
  const [demoMessages, setDemoMessages] = useState<DemoChatMessage[]>([]);
  const [demoTypingText, setDemoTypingText] = useState<string | null>(null);
  const [isAutoDemoRunning, setIsAutoDemoRunning] = useState(false);
  const [demoCelebrateToken, setDemoCelebrateToken] = useState(0);
  const demoTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const didInitRef = useRef(false);

  const selectedDemoLocation = DEMO_LOCATION_PRESETS.find((preset) => preset.id === demoLocationId) || DEMO_LOCATION_PRESETS[0];
  const activeQuests = getActiveQuests();
  const effectiveLocation = useMemo(
    () => (demoMode
      ? { latitude: selectedDemoLocation.latitude, longitude: selectedDemoLocation.longitude }
      : liveLocation),
    [demoMode, liveLocation, selectedDemoLocation.latitude, selectedDemoLocation.longitude]
  );

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const isTokenMissing = !token || token === "YOUR_MAPBOX_TOKEN_HERE";

  const getLightPreset = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 8) return "dawn";
    if (hour >= 8 && hour < 17) return "day";
    if (hour >= 17 && hour < 19) return "dusk";
    return "night";
  };

  const lightPreset = getLightPreset();
  const mapRef = useRef<MapRef | null>(null);

  const clearDemoTimers = useCallback(() => {
    demoTimersRef.current.forEach((timer) => clearTimeout(timer));
    demoTimersRef.current = [];
  }, []);

  const scheduleDemoStep = useCallback((delayMs: number, callback: () => void) => {
    const timer = setTimeout(callback, delayMs);
    demoTimersRef.current.push(timer);
  }, []);

  const appendDemoMessage = (sender: "you" | "other" | "system", text: string) => {
    setDemoMessages((current) => [
      ...current,
      {
        id: `demo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender,
        text,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  };

  const recenterToDemoLocation = useCallback((location = selectedDemoLocation, zoom = 16.6) => {
    if (!mapRef.current) {
      return;
    }

    mapRef.current.flyTo({
      center: [location.longitude, location.latitude],
      zoom,
      duration: 900,
      essential: true,
    });
  }, [selectedDemoLocation]);

  const resetDemoScenario = useCallback((locationId = demoLocationId) => {
    clearDemoTimers();
    const preset = DEMO_LOCATION_PRESETS.find((item) => item.id === locationId) || DEMO_LOCATION_PRESETS[0];
    setDemoQuest(createDemoQuest(preset));
    setDemoMessages([]);
    setDemoTypingText(null);
    setDemoCelebrateToken(0);
    setIsAutoDemoRunning(false);
    setSelectedQuest(null);
    setIsChatOpen(false);
    setActiveChatQuest(null);
    setChatRole("hunter");
  }, [clearDemoTimers, demoLocationId]);

  const disableDemoMode = useCallback(() => {
    clearDemoTimers();
    setDemoMode(false);
    setDemoQuest(null);
    setDemoMessages([]);
    setDemoTypingText(null);
    setIsAutoDemoRunning(false);
    setDemoCelebrateToken(0);
    setSelectedQuest(null);
    setActiveChatQuest(null);
    setIsChatOpen(false);
    setChatRole("hunter");
  }, [clearDemoTimers]);

  const claimDemoQuest = (questToClaim: Quest) => {
    if (!user) {
      return;
    }

    const claimedQuest = {
      ...questToClaim,
      status: "claimed" as const,
      hunterId: user.id,
      hunter_id: user.id,
    };

    setDemoQuest(claimedQuest);
    setSelectedQuest(null);
    setDemoMessages(buildDemoChatSeed());
    setDemoTypingText(null);
    setActiveChatQuest(claimedQuest);
    setChatRole("hunter");
    setIsChatOpen(true);
    addToast(`Demo quest claimed: \"${questToClaim.title}\"`, "success");
  };

  const handleDemoSendMessage = (text: string) => {
    appendDemoMessage("you", text);
    setDemoTypingText("Creator is typing...");

    scheduleDemoStep(1100, () => {
      setDemoTypingText(null);
      appendDemoMessage("other", createDemoReply(text));
    });
  };

  const handleDemoComplete = () => {
    setDemoQuest((current) => (current ? { ...current, status: "completed" } : current));
    appendDemoMessage("system", "Hunter marked the quest complete. Creator review requested.");
    addToast("Demo quest marked complete.", "info");
  };

  const handleDemoVerify = () => {
    setDemoQuest((current) => (current ? { ...current, status: "verified" } : current));
    appendDemoMessage("system", "Creator verified the delivery. Credits and notoriety awarded.");
    setDemoCelebrateToken((current) => current + 1);
    addToast(`+${selectedDemoLocation.bounty} credits demo payout`, "reward");
  };

  const handleDemoCancel = () => {
    resetDemoScenario(demoLocationId);
    addToast("Demo scenario reset.", "info");
  };

  const runAutoDemo = () => {
    clearDemoTimers();
    setDemoMode(true);
    resetDemoScenario(demoLocationId);
    setIsAutoDemoRunning(true);

    const scriptedQuest = createDemoQuest(selectedDemoLocation);
    setDemoQuest(scriptedQuest);

    scheduleDemoStep(350, () => {
      recenterToDemoLocation(selectedDemoLocation, 16.8);
      addToast(`Demo locked to ${selectedDemoLocation.name}.`, "info");
    });

    scheduleDemoStep(1400, () => {
      setSelectedQuest(scriptedQuest);
      addToast("Quest discovered on the building board.", "success");
    });

    scheduleDemoStep(2800, () => {
      claimDemoQuest(scriptedQuest);
    });

    scheduleDemoStep(4300, () => {
      appendDemoMessage("you", "I am already in Eaton and heading to the lobby now.");
    });

    scheduleDemoStep(5600, () => {
      setDemoTypingText("Creator is typing...");
    });

    scheduleDemoStep(7000, () => {
      setDemoTypingText(null);
      appendDemoMessage("other", "Perfect. I can verify this right away so the judges see the full reward loop.");
    });

    scheduleDemoStep(8600, () => {
      handleDemoComplete();
    });

    scheduleDemoStep(10200, () => {
      setChatRole("creator");
      setDemoTypingText("Creator is reviewing delivery...");
    });

    scheduleDemoStep(11600, () => {
      setDemoTypingText(null);
      handleDemoVerify();
    });

    scheduleDemoStep(13800, () => {
      setIsAutoDemoRunning(false);
      addToast("Autoplay finished. You can keep exploring in demo mode.", "success");
    });
  };

  const recenterToLiveLocation = useCallback((zoom = 16.8) => {
    if (!mapRef.current || !effectiveLocation) {
      return;
    }

    mapRef.current.flyTo({
      center: [effectiveLocation.longitude, effectiveLocation.latitude],
      zoom,
      duration: 900,
      essential: true,
    });
  }, [effectiveLocation]);

  const handleMarkerClick = (quest: Quest) => {
    setSelectedQuest(quest);
    
    // Smoothly fly to the marker location
    if (mapRef.current) {
      mapRef.current.flyTo({
        center: [quest.longitude, quest.latitude],
        duration: 1200,
        zoom: 16.5,
        essential: true,
        padding: { bottom: 100, top: 0, left: 0, right: 0 } // Offset slightly for the popup
      });
    }
  };

  useEffect(() => {
    if (didInitRef.current) {
      return;
    }

    didInitRef.current = true;

    const mountTimer = setTimeout(() => {
      setIsClient(true);

      if (typeof window === "undefined") {
        return;
      }

      const storedMode = window.localStorage.getItem("buffquest-demo-mode") === "1";
      const storedLocation = getStoredDemoLocationId();

      if (storedLocation !== demoLocationId) {
        setDemoLocationId(storedLocation);
      }

      if (storedMode !== demoMode) {
        setDemoMode(storedMode);
        if (storedMode) {
          resetDemoScenario(storedLocation);
        }
      }
    }, 0);

    return () => clearTimeout(mountTimer);
  }, [demoLocationId, demoMode, resetDemoScenario]);

  useEffect(() => {
    if (!isClient || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("buffquest-demo-mode", demoMode ? "1" : "0");
    window.localStorage.setItem("buffquest-demo-location", demoLocationId);
  }, [demoLocationId, demoMode, isClient]);

  useEffect(() => {
    if (!isClient || !hasGeolocationSupport()) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLiveLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationError(null);
        setIsLocating(false);
      },
      (error) => {
        setLocationError(error.message || "Location blocked");
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isClient]);

  useEffect(() => {
    if (!effectiveLocation || !mapRef.current) {
      return;
    }

    recenterToLiveLocation(15.8);
  }, [demoMode, effectiveLocation, recenterToLiveLocation]);

  useEffect(() => {
    return () => clearDemoTimers();
  }, [clearDemoTimers]);

  if (!isClient) return null;
  if (isLoading) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-950 text-white">
        <div className="rounded-[28px] border border-white/10 bg-black/40 px-6 py-4 text-center backdrop-blur-md">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">BuffQuest</p>
          <p className="mt-2 text-base font-semibold text-white">Loading campus map...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gray-950 text-white">
        <div className="max-w-md rounded-[28px] border border-red-400/20 bg-black/50 px-6 py-5 text-center backdrop-blur-md">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-red-300">Session Required</p>
          <p className="mt-2 text-base text-slate-200">
            BuffQuest could not load your profile session. Refresh the page or sign in again.
          </p>
        </div>
      </div>
    );
  }

  const isLightMap = lightPreset === "day" || lightPreset === "dawn";
  const glassChip = isLightMap
    ? "bg-black/50 backdrop-blur-[15px] border border-white/10 shadow-lg text-white"
    : "bg-white/60 backdrop-blur-[15px] border border-white/40 shadow-lg text-slate-900";
  const chipLabel = isLightMap
    ? "text-white/70"
    : "text-slate-500";
  const locationChipTone = isLightMap
    ? "bg-emerald-400/15 text-emerald-100 border border-emerald-300/20"
    : "bg-emerald-500/10 text-emerald-900 border border-emerald-700/10";

  const openQuests = quests.filter((q) => q.status === "open");
  const visibleOpenQuests = demoMode && demoQuest?.status === "open"
    ? [demoQuest, ...openQuests.filter((quest) => quest.id !== demoQuest.id)]
    : openQuests;
  const visibleActiveQuests = demoMode && demoQuest && (demoQuest.status === "claimed" || demoQuest.status === "completed")
    ? [demoQuest, ...activeQuests.filter((quest) => quest.id !== demoQuest.id)]
    : activeQuests;
  const resolvedActiveChatQuest = activeChatQuest?.id
    ? (demoMode && demoQuest && activeChatQuest.id === demoQuest.id
        ? demoQuest
        : quests.find((quest) => quest.id === activeChatQuest.id) || activeChatQuest)
    : null;

  const handleClaim = async (quest: Quest) => {
    if (demoMode && demoQuest && quest.id === demoQuest.id) {
      claimDemoQuest(quest);
      return;
    }

    const result = await claimQuest(quest.id);
    if (!result.success) {
      addToast(result.error || "Unable to claim quest.", "error");
      return;
    }

    setSelectedQuest(null);
    addToast(`Quest claimed: "${quest.title}"`, "success");

    // Open the chat session for the newly claimed quest
    setTimeout(() => {
      const updatedQuest = { ...quest, status: "claimed" as const, hunterId: user.id };
      setActiveChatQuest(updatedQuest);
      setChatRole("hunter");
      setIsChatOpen(true);
    }, 500);
  };

  const openActiveQuestChat = (quest: Quest) => {
    setActiveChatQuest(quest);
    if (demoMode && demoQuest && quest.id === demoQuest.id) {
      setChatRole(chatRole);
    } else {
      setChatRole(quest.creatorId === user.id ? "creator" : "hunter");
    }
    setIsChatOpen(true);
  };

  return (
    <div className="relative w-full h-full bg-gray-900">
      {isTokenMissing && (
        <div className="absolute z-50 top-4 left-1/2 -translate-x-1/2 liquid-glass-red text-red-300 px-6 py-3 rounded-2xl shadow-lg font-bold flex flex-col items-center">
          <span>Mapbox Token Missing!</span>
          <span className="text-sm font-normal text-red-300/70">
            Please add NEXT_PUBLIC_MAPBOX_TOKEN to .env.local
          </span>
        </div>
      )}

      {/* ─── Map Overlay Header ─── */}
      <div className="absolute z-10 top-0 left-0 w-full p-4 sm:p-6 pointer-events-none flex justify-between items-start" style={{ paddingTop: 'max(var(--sat), 1rem)' }}>
        <div className="flex gap-2 sm:gap-4 mt-1 sm:mt-2 flex-wrap max-w-[70%]">
          {/* Credits Chip */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${glassChip} pointer-events-auto px-3 py-2 sm:px-5 sm:py-3 rounded-[40px] font-black flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base`}
          >
            <span className="tracking-tight">{user.credits} <span className={`text-[10px] sm:text-xs ${chipLabel} font-bold uppercase tracking-widest pl-0.5 sm:pl-1`}>Credits</span></span>
          </motion.div>
 
          {/* Notoriety Chip */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`${glassChip} pointer-events-auto px-3 py-2 sm:px-5 sm:py-3 rounded-[40px] font-black flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base`}
          >
            <span className="tracking-tight">{user.notoriety} <span className={`text-[10px] sm:text-xs ${chipLabel} font-bold uppercase tracking-widest pl-0.5 sm:pl-1`}>Notoriety</span></span>
          </motion.div>

          <motion.button
            whileHover={effectiveLocation ? { scale: 1.04 } : undefined}
            whileTap={effectiveLocation ? { scale: 0.96 } : undefined}
            onClick={() => recenterToLiveLocation()}
            disabled={!effectiveLocation}
            className={`${glassChip} ${locationChipTone} pointer-events-auto px-3 py-2 sm:px-4 sm:py-3 rounded-[28px] font-bold flex items-center gap-2 text-xs sm:text-sm disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${effectiveLocation ? "bg-emerald-400 orb-pulse-green" : "bg-amber-400"}`} />
            <span className="tracking-wide uppercase">
              {demoMode ? "Demo" : isLocating ? "Locating" : effectiveLocation ? "Live" : "Location Off"}
            </span>
          </motion.button>
        </div>

        {/* Right Side: Attendance + Profile */}
        <div className="flex gap-2 sm:gap-3 mt-1 sm:mt-2 shrink-0">
          {/* Attendance Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsAttendanceOpen(true)}
            className={`${glassChip} pointer-events-auto h-11 w-11 sm:h-14 sm:w-14 rounded-full flex items-center justify-center text-xl sm:text-2xl transition-transform relative`}
          >
            🎓
            {/* Green online dot */}
            <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-black/50 orb-pulse-green" />
          </motion.button>

          {/* Profile Avatar */}
          <Link 
            href="/profile" 
            className={`${glassChip} pointer-events-auto h-11 w-11 sm:h-14 sm:w-14 rounded-full flex items-center justify-center hover:scale-105 active:scale-90 transition-transform relative shrink-0 overflow-hidden p-0.5 sm:p-1`}
          >
            <GeneratedAvatar name={user.name} size="md" className="h-full w-full border-none shadow-none" />
          </Link>
        </div>
      </div>

      {(demoMode || locationError || isLocating) && (
        <div className="absolute z-10 top-[5.75rem] left-4 sm:left-6 pointer-events-none" style={{ paddingTop: 'var(--sat)' }}>
          <div className={`${glassChip} pointer-events-auto rounded-[24px] px-4 py-2.5 text-xs sm:text-sm font-semibold max-w-xs`}>
            {demoMode
              ? `Demo mode locked to ${selectedDemoLocation.name}`
              : isLocating
                ? "Finding your live location..."
                : `Location notice: ${locationError}`}
          </div>
        </div>
      )}

      <DemoControlPanel
        demoMode={demoMode}
        autoDemoRunning={isAutoDemoRunning}
        selectedLocationId={demoLocationId}
        locations={DEMO_LOCATION_PRESETS}
        onToggleDemo={() => {
          if (demoMode) {
            disableDemoMode();
            addToast("Demo mode disabled.", "info");
            return;
          }

          setDemoMode(true);
          resetDemoScenario(demoLocationId);
          recenterToDemoLocation(selectedDemoLocation);
          addToast(`Demo mode enabled for ${selectedDemoLocation.name}.`, "success");
        }}
        onSelectLocation={(locationId) => {
          setDemoLocationId(locationId);
          const nextLocation = DEMO_LOCATION_PRESETS.find((preset) => preset.id === locationId) || DEMO_LOCATION_PRESETS[0];
          if (demoMode && !isAutoDemoRunning) {
            resetDemoScenario(locationId);
          }
          recenterToDemoLocation(nextLocation);
        }}
        onRunAutoDemo={runAutoDemo}
        onStopAutoDemo={() => {
          clearDemoTimers();
          setIsAutoDemoRunning(false);
          setDemoTypingText(null);
          addToast("Autoplay stopped.", "info");
        }}
      />

      {/* ─── Active Quest Indicator (if any) ─── */}
      <AnimatePresence>
        {visibleActiveQuests.length > 0 && !isChatOpen && (
          <motion.div
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="absolute z-10 top-20 sm:top-24 left-4 right-4 pointer-events-none flex justify-center"
            style={{ paddingTop: 'var(--sat)' }}
          >
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => openActiveQuestChat(visibleActiveQuests[0])}
              className="pointer-events-auto liquid-glass-dark px-5 py-3 rounded-[28px] flex items-center gap-3 shadow-xl max-w-sm w-full"
            >
              <div className="w-3 h-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)] shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-white font-black text-sm truncate">{visibleActiveQuests[0].title}</p>
                <p className="text-slate-400 text-xs font-medium">
                  {visibleActiveQuests[0].status === "claimed" ? "In Progress" : "Awaiting Verification"} · {visibleActiveQuests[0].bounty} 💰
                </p>
              </div>
              <span className="text-yellow-400 font-black text-xs uppercase tracking-widest shrink-0">Active</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Mapbox ─── */}
      <Map
        ref={mapRef}
        reuseMaps
        mapboxAccessToken={isTokenMissing ? "" : token}
        initialViewState={{
          longitude: CU_BOULDER_COORDS.longitude,
          latitude: CU_BOULDER_COORDS.latitude,
          zoom: 15.2,
          pitch: 62,
          bearing: -17.6,
        }}
        maxBounds={CU_BOULDER_BOUNDS}
        style={{ width: "100%", height: "100%" }}
        mapStyle="mapbox://styles/mapbox/standard"
        maxPitch={85}
        minZoom={14}
        maxZoom={20}
        logoPosition="bottom-left"
        attributionControl={true}
        onLoad={(event) => {
          const map = event.target;
          try {
            map.setConfigProperty('basemap', 'lightPreset', lightPreset);
          } catch {}
          
          map.on('style.load', () => {
            map.setConfigProperty('basemap', 'lightPreset', lightPreset);
          });
        }}
      >
        {/* ─── Quest Markers ─── */}
        {visibleOpenQuests.map((quest) => (
          <Marker
            key={quest.id}
            longitude={quest.longitude}
            latitude={quest.latitude}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              handleMarkerClick(quest);
            }}
          >
            <div 
              className="cursor-pointer flex flex-col items-center group relative pt-4 hover:scale-110 active:scale-95 transition-transform duration-200"
            >
              {/* Hover Label */}
              <div className="absolute -top-6 bg-yellow-400 text-yellow-900 font-black px-3 py-1 rounded-[20px] text-xs shadow-xl border-2 border-white opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 z-10 whitespace-nowrap">
                +{quest.bounty} 💰
              </div>
              
              {/* Orb */}
              <div className="relative flex items-center justify-center w-8 h-8">
                <div className="absolute inset-0 rounded-full bg-yellow-400 orb-pulse"></div>
                <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-500 shadow-[inset_0_-2px_4px_rgba(0,0,0,0.2),_0_4px_8px_rgba(255,214,10,0.5)] border-2 border-white z-10 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-white/80"></div>
                </div>
              </div>
            </div>
          </Marker>
        ))}

        {effectiveLocation && (
          <Marker
            longitude={effectiveLocation.longitude}
            latitude={effectiveLocation.latitude}
            anchor="center"
          >
            <div className="relative flex items-center justify-center">
              <div className="absolute h-16 w-16 rounded-full bg-cyan-400/20 blur-md" />
              <div className="absolute h-10 w-10 rounded-full border border-cyan-200/60 bg-cyan-300/20 orb-pulse" />
              <div className="relative rounded-full border-2 border-white/90 shadow-[0_10px_25px_rgba(34,211,238,0.35)] bg-slate-950/60 p-1.5 backdrop-blur-md">
                <GeneratedAvatar name={user.name} size="sm" className="border-none shadow-none" />
              </div>
            </div>
          </Marker>
        )}

        {/* ─── Quest Popup ─── */}
        <AnimatePresence>
          {selectedQuest && (
            <Popup
              longitude={selectedQuest.longitude}
              latitude={selectedQuest.latitude}
              anchor="bottom"
              offset={24}
              onClose={() => setSelectedQuest(null)}
              closeOnClick={false}
              closeButton={false}
              className="liquid-popup"
            >
              <motion.div 
                initial={{ opacity: 0, scale: 0.8, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.8, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                className="liquid-glass p-5 text-slate-900 w-72 rounded-[32px]"
              >
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-extrabold text-[1.1rem] leading-tight tracking-tight text-slate-800 drop-shadow-sm flex-1">{selectedQuest.title}</h3>
                  <button onClick={() => setSelectedQuest(null)} className="text-slate-400 hover:text-slate-600 bg-white/40 rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs backdrop-blur-sm shrink-0 ml-2">✕</button>
                </div>

                <p className="text-xs text-slate-500 mb-2 font-medium">📍 {selectedQuest.building}</p>

                {selectedQuest.description && (
                  <p className="text-sm text-slate-600 mb-3 leading-relaxed line-clamp-3">{selectedQuest.description}</p>
                )}
                
                <p className="text-yellow-600 font-black mb-4 flex items-center gap-1 text-sm bg-yellow-500/10 w-max px-3 py-1 rounded-xl">
                  <span className="drop-shadow-sm">💰</span> {selectedQuest.bounty} Credits
                </p>
                <motion.button 
                  whileTap={{ scale: 0.94 }}
                  className="w-full squishy-btn text-yellow-900 font-black py-3 rounded-[24px] uppercase tracking-wider text-sm border-2 border-white/60"
                  onClick={() => void handleClaim(selectedQuest)}
                >
                  Claim Quest
                </motion.button>
              </motion.div>
            </Popup>
          )}
        </AnimatePresence>
      </Map>

      {/* ─── Bottom Action Buttons ─── */}
      <div className="absolute z-10 bottom-6 sm:bottom-8 left-0 w-full pointer-events-none flex items-start justify-center" style={{ paddingBottom: 'var(--sab)' }}>
        <motion.div 
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.9, y: 2 }}
          className="pointer-events-auto"
        >
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="squishy-btn text-yellow-900 px-6 py-4 sm:px-8 sm:py-5 rounded-[40px] font-black text-base sm:text-[1.1rem] uppercase tracking-widest border-2 border-white/80 flex items-center gap-2 sm:gap-3 whitespace-nowrap"
          >
            <span className="text-xl sm:text-2xl drop-shadow-sm inner-glow-text text-white">✚</span> POST QUEST
          </button>
        </motion.div>
      </div>

      {/* ─── Modals & Drawers ─── */}
      <CreateQuestModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
      />

      <AttendanceDrawer
        isOpen={isAttendanceOpen}
        onClose={() => setIsAttendanceOpen(false)}
      />

      <ActiveQuestChat
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        quest={resolvedActiveChatQuest}
        role={chatRole}
        demoMode={demoMode && resolvedActiveChatQuest?.id === demoQuest?.id}
        demoMessages={demoMessages}
        demoParticipantName="Maya R."
        demoTypingText={demoTypingText}
        demoCelebrateToken={demoCelebrateToken}
        onDemoSendMessage={handleDemoSendMessage}
        onDemoComplete={handleDemoComplete}
        onDemoVerify={handleDemoVerify}
        onDemoCancel={handleDemoCancel}
      />
    </div>
  );
}
