export interface DemoLocationPreset {
  id: string;
  name: string;
  buildingId: number;
  latitude: number;
  longitude: number;
  questTitle: string;
  questDescription: string;
  bounty: number;
}

export interface DemoChatMessage {
  id: string;
  sender: "you" | "other" | "system";
  text: string;
  timestamp: string;
}

export const DEMO_LOCATION_PRESETS: DemoLocationPreset[] = [
  {
    id: "eaton",
    name: "Eaton Humanities",
    buildingId: 1,
    latitude: 40.00925,
    longitude: -105.27187,
    questTitle: "Bring my charger to Eaton",
    questDescription: "I am presenting in Eaton and forgot my USB-C charger. Drop it by the front lobby table.",
    bounty: 20,
  },
  {
    id: "norlin",
    name: "Norlin Library",
    buildingId: 1,
    latitude: 40.0085,
    longitude: -105.273,
    questTitle: "Need notes from Econ lecture",
    questDescription: "Grab a photo of the whiteboard notes from the 2pm Econ lecture and send them in chat.",
    bounty: 15,
  },
  {
    id: "umc",
    name: "UMC",
    buildingId: 3,
    latitude: 40.005,
    longitude: -105.272,
    questTitle: "Coffee pickup at UMC",
    questDescription: "Pick up an iced coffee from the UMC cafe and meet near the west entrance.",
    bounty: 25,
  },
  {
    id: "engineering",
    name: "Engineering Center",
    buildingId: 4,
    latitude: 40.007,
    longitude: -105.2635,
    questTitle: "Need a study partner for circuits",
    questDescription: "Looking for someone nearby to review a circuits practice set for 20 minutes.",
    bounty: 10,
  },
];

function timestampLabel(offsetMinutes = 0) {
  return new Date(Date.now() + offsetMinutes * 60000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function createDemoQuest(preset: DemoLocationPreset) {
  return {
    id: `demo-${preset.id}`,
    title: preset.questTitle,
    description: preset.questDescription,
    bounty: preset.bounty,
    cost_credits: preset.bounty,
    reward_credits: preset.bounty,
    reward_notoriety: Math.max(1, Math.round(preset.bounty / 10)),
    longitude: preset.longitude,
    latitude: preset.latitude,
    status: "open" as const,
    building: preset.name,
    building_name: preset.name,
    creatorId: "demo-creator",
    creator_id: "demo-creator",
    createdAt: new Date().toISOString(),
    created_at: new Date().toISOString(),
  };
}

export function buildDemoChatSeed() {
  return [
    {
      id: "demo-seed-1",
      sender: "other" as const,
      text: "Thanks for grabbing this. I am by the lobby and can verify fast.",
      timestamp: timestampLabel(-1),
    },
    {
      id: "demo-seed-2",
      sender: "system" as const,
      text: "Live quest session created. Creator and hunter can chat until reward is issued.",
      timestamp: timestampLabel(0),
    },
  ];
}

export function createDemoReply(input: string) {
  const normalized = input.trim().toLowerCase();

  if (normalized.includes("here") || normalized.includes("outside")) {
    return "Perfect. I am walking down now and can verify as soon as I get it.";
  }
  if (normalized.includes("late") || normalized.includes("minute")) {
    return "All good. Judges are still rotating, so a couple minutes is fine.";
  }
  if (normalized.includes("done") || normalized.includes("completed") || normalized.includes("delivered")) {
    return "Got it. Mark the quest complete and I will verify right away.";
  }
  if (normalized.includes("where") || normalized.includes("meet")) {
    return "Meet me by the Eaton lobby seating area near the front doors.";
  }

  return "Looks good. This is the kind of fast campus coordination BuffQuest is built for.";
}