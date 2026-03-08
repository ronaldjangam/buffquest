"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/context/ToastContext";
import { useQuests } from "@/context/QuestContext";
import { getBackendApiUrl } from "@/lib/api";

interface AttendanceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

type VerificationStage = "idle" | "verifying" | "success" | "pending" | "failed";

const CAMPUS_BUILDINGS = [
  { id: 1, name: "Norlin Library" },
  { id: 2, name: "Duane Physics" },
  { id: 3, name: "UMC" },
  { id: 4, name: "Engineering Center" },
  { id: 5, name: "C4C" },
  { id: 6, name: "Rec Center" },
  { id: 7, name: "ATLAS" },
  { id: 8, name: "SEEC" },
  { id: 9, name: "Eaton Humanities" },
];

async function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export default function AttendanceDrawer({ isOpen, onClose }: AttendanceDrawerProps) {
  const { addToast } = useToast();
  const { refreshData } = useQuests();
  const scheduleInputRef = useRef<HTMLInputElement | null>(null);
  const classPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const [scheduleName, setScheduleName] = useState("");
  const [scheduleProof, setScheduleProof] = useState<string>("");
  const [classPhotoName, setClassPhotoName] = useState("");
  const [classPhotoProof, setClassPhotoProof] = useState<string>("");
  const [className, setClassName] = useState("CSCI 3104");
  const [scheduledStartTime, setScheduledStartTime] = useState(() => new Date().toISOString().slice(0, 16));
  const [selectedBuildingId, setSelectedBuildingId] = useState(1);
  const [stage, setStage] = useState<VerificationStage>("idle");

  const getCurrentLocation = () =>
    new Promise<GeolocationPosition>((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(new Error("Geolocation is not available in this browser."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      });
    });

  const handleScheduleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const encoded = await readFileAsDataUrl(file);
      setScheduleProof(encoded);
      setScheduleName(file.name);
      addToast("Schedule uploaded successfully!", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Unable to load schedule image.", "error");
    }
  };

  const handleClassPhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      const encoded = await readFileAsDataUrl(file);
      setClassPhotoProof(encoded);
      setClassPhotoName(file.name);
      addToast("Class photo attached.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Unable to load class photo.", "error");
    }
  };

  const handleCheckIn = async () => {
    if (!scheduleProof || !classPhotoProof) {
      addToast("Upload both your schedule and a class photo first.", "error");
      return;
    }

    setStage("verifying");

    try {
      const position = await getCurrentLocation();
      const res = await fetch(getBackendApiUrl("attendance/check-in"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          class_name: className,
          schedule_image_url: scheduleProof,
          class_photo_url: classPhotoProof,
          building_zone_id: selectedBuildingId,
          user_lat: position.coords.latitude,
          user_lon: position.coords.longitude,
          scheduled_start_time: new Date(scheduledStartTime).toISOString(),
        }),
      });

      if (res.ok) {
        const payload = await res.json();
        if (payload.verification_status === "approved" && payload.reward_issued) {
          setStage("success");
          addToast("+5 daily credits earned! 🎓", "reward");
        } else {
          setStage("pending");
          addToast("Attendance proof submitted for manual review.", "info");
        }
        await refreshData();
      } else {
        const errorData = await res.json();
        setStage("failed");
        addToast(errorData.detail || "Verification failed.", "error");
      }
    } catch {
      setStage("failed");
      addToast("Network error during check-in.", "error");
    }

    // Reset after delay
    setTimeout(() => {
      setStage("idle");
    }, 3000);
  };

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

          {/* Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 w-full max-h-[80dvh] z-[101] liquid-glass-dark rounded-t-[40px] flex flex-col shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-white/10 overflow-y-auto"
            style={{ paddingBottom: 'max(var(--sab), 2rem)' }}
          >
            {/* Handle */}
            <div className="w-full flex justify-center pt-4 pb-2 sm:hidden">
              <div className="w-12 h-1.5 bg-white/30 rounded-full" />
            </div>

            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-md flex items-center gap-2">
                    <span className="text-green-400">🎓</span> Attendance
                  </h2>
                  <p className="text-sm text-slate-400 font-medium mt-1">Earn daily credits by checking in to class</p>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Schedule Section */}
              <div className="liquid-glass-dark rounded-[28px] p-5 space-y-4">
                <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">Your Schedule</h3>
                {scheduleProof ? (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <span className="text-green-400 text-lg">✓</span>
                      </div>
                      <div>
                        <p className="text-white font-bold text-sm">{scheduleName}</p>
                        <p className="text-xs text-slate-500">Uploaded</p>
                      </div>
                    </div>
                    <button
                      onClick={() => { setScheduleProof(""); setScheduleName(""); if (scheduleInputRef.current) scheduleInputRef.current.value = ""; }}
                      className="text-xs text-slate-500 hover:text-red-400 font-bold transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <>
                    <input ref={scheduleInputRef} type="file" accept="image/*" className="hidden" onChange={handleScheduleUpload} />
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => scheduleInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-white/15 rounded-2xl py-6 flex flex-col items-center gap-2 text-slate-400 hover:border-yellow-400/30 hover:text-yellow-400 transition-all group"
                    >
                      <span className="text-3xl group-hover:scale-110 transition-transform">📋</span>
                      <span className="font-bold text-sm">Upload Class Schedule</span>
                      <span className="text-xs text-slate-500">Photo of your schedule or screenshot</span>
                    </motion.button>
                  </>
                )}
              </div>

              {/* Check-In Section */}
              <div className="liquid-glass-dark rounded-[28px] p-5 space-y-4">
                <h3 className="text-xs font-black tracking-widest text-slate-400 uppercase">Daily Check-In</h3>

                {stage === "idle" && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2 sm:col-span-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Class Name</label>
                        <input
                          value={className}
                          onChange={(event) => setClassName(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400/40"
                          placeholder="e.g. CSCI 3104"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Scheduled Start</label>
                        <input
                          type="datetime-local"
                          value={scheduledStartTime}
                          onChange={(event) => setScheduledStartTime(event.target.value)}
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400/40"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase tracking-widest text-slate-400">Campus Building</label>
                        <select
                          value={selectedBuildingId}
                          onChange={(event) => setSelectedBuildingId(Number(event.target.value))}
                          className="w-full rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-400/40"
                        >
                          {CAMPUS_BUILDINGS.map((building) => (
                            <option key={building.id} value={building.id} className="bg-slate-900">
                              {building.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-white/10 bg-black/20 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-white">Classroom Proof Photo</p>
                          <p className="text-xs text-slate-500">Take or upload a current photo from class.</p>
                        </div>
                        {classPhotoName && <span className="text-xs font-bold text-green-400">Attached</span>}
                      </div>
                      <input ref={classPhotoInputRef} type="file" accept="image/*" className="hidden" onChange={handleClassPhotoUpload} />
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => classPhotoInputRef.current?.click()}
                        className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/[0.08]"
                      >
                        {classPhotoName ? `Replace Photo: ${classPhotoName}` : "Upload Class Photo"}
                      </motion.button>
                    </div>

                    <p className="text-sm text-slate-400">
                      Submit a real schedule image, a classroom photo, your class time, and your current location to earn <span className="text-yellow-400 font-black">+5 credits</span>.
                    </p>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={handleCheckIn}
                      disabled={!scheduleProof || !classPhotoProof || !className.trim()}
                      className="w-full squishy-btn text-yellow-900 font-black py-4 rounded-[28px] uppercase tracking-widest text-base border-2 border-white/60 shadow-xl disabled:opacity-40 disabled:pointer-events-none"
                    >
                      📸 Check In Now
                    </motion.button>
                    {(!scheduleProof || !classPhotoProof) && (
                      <p className="text-xs text-center text-slate-500 font-medium">Upload both images to enable check-in</p>
                    )}
                  </div>
                )}

                {stage === "verifying" && (
                  <div className="flex flex-col items-center py-8 gap-4">
                    <div className="w-16 h-16 rounded-full bg-yellow-400/20 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full border-4 border-yellow-400/30 border-t-yellow-400 animate-spin" />
                    </div>
                    <p className="text-white font-bold text-sm">Verifying location & time...</p>
                    <p className="text-xs text-slate-500">Checking time window, proof images, and location</p>
                  </div>
                )}

                {stage === "success" && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="flex flex-col items-center py-8 gap-3"
                  >
                    <div className="text-5xl animate-reward-burst">🎉</div>
                    <span className="text-2xl font-black text-yellow-400 glow-gold">+5 Credits!</span>
                    <span className="text-sm font-bold text-green-400">Attendance verified</span>
                  </motion.div>
                )}

                {stage === "failed" && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="flex flex-col items-center py-8 gap-3"
                  >
                    <div className="text-5xl">❌</div>
                    <span className="text-lg font-black text-red-400">Verification Failed</span>
                    <span className="text-sm text-slate-400">Ensure you are in the correct building during class time.</span>
                  </motion.div>
                )}

                {stage === "pending" && (
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    className="flex flex-col items-center py-8 gap-3"
                  >
                    <div className="text-5xl">🕓</div>
                    <span className="text-lg font-black text-cyan-300">Submitted For Review</span>
                    <span className="text-sm text-slate-400 text-center">Your proof was saved, but the time window needs manual review before credits are issued.</span>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </React.Fragment>
      )}
    </AnimatePresence>
  );
}
