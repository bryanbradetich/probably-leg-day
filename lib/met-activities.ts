/**
 * MET (metabolic equivalent) values for activity energy expenditure.
 * Calories burned = MET × weight_kg × duration_hours, where duration_hours = duration_minutes / 60.
 */

export type MetActivity = {
  name: string;
  met: number;
  category: string;
};

/** Display order for grouped dropdowns */
export const MET_ACTIVITY_CATEGORY_ORDER: string[] = [
  "Walking & Running",
  "Cycling",
  "Swimming",
  "Court & Field Sports",
  "Gym & Fitness",
  "Outdoor & Recreation",
  "Daily Activities",
];

const BY_CATEGORY: Record<string, { name: string; met: number }[]> = {
  "Walking & Running": [
    { name: "Hiking", met: 6.0 },
    { name: "Running, 10 mph (6 min/mile)", met: 14.5 },
    { name: "Running, 5 mph (12 min/mile)", met: 8.3 },
    { name: "Running, 6 mph (10 min/mile)", met: 9.8 },
    { name: "Running, 7 mph (8.5 min/mile)", met: 11.0 },
    { name: "Running, 8 mph (7.5 min/mile)", met: 11.8 },
    { name: "Walking, brisk (3.5 mph)", met: 4.3 },
    { name: "Walking, fast (4 mph)", met: 5.0 },
    { name: "Walking, moderate (3 mph)", met: 3.5 },
    { name: "Walking, slow (2 mph)", met: 2.8 },
  ],
  Cycling: [
    { name: "Cycling, leisure (10-12 mph)", met: 6.8 },
    { name: "Cycling, moderate (12-14 mph)", met: 8.0 },
    { name: "Cycling, racing (16+ mph)", met: 12.0 },
    { name: "Cycling, vigorous (14-16 mph)", met: 10.0 },
    { name: "Stationary bike, moderate", met: 5.5 },
    { name: "Stationary bike, vigorous", met: 8.5 },
  ],
  Swimming: [
    { name: "Swimming, leisure", met: 6.0 },
    { name: "Swimming, laps, vigorous", met: 10.0 },
    { name: "Swimming, moderate", met: 8.3 },
  ],
  "Court & Field Sports": [
    { name: "Basketball", met: 8.0 },
    { name: "Golf, riding cart", met: 3.5 },
    { name: "Golf, walking with clubs", met: 4.3 },
    { name: "Pickleball", met: 6.5 },
    { name: "Racquetball", met: 10.0 },
    { name: "Soccer", met: 10.0 },
    { name: "Tennis, doubles", met: 6.0 },
    { name: "Tennis, singles", met: 8.0 },
    { name: "Volleyball", met: 4.0 },
  ],
  "Gym & Fitness": [
    { name: "Circuit training", met: 8.0 },
    { name: "Elliptical, moderate", met: 5.0 },
    { name: "Elliptical, vigorous", met: 7.5 },
    { name: "HIIT", met: 10.0 },
    { name: "Pilates", met: 3.5 },
    { name: "Rowing machine, moderate", met: 7.0 },
    { name: "Rowing machine, vigorous", met: 8.5 },
    { name: "Stair climber", met: 9.0 },
    { name: "Stretching", met: 2.5 },
    { name: "Weight training, moderate", met: 3.5 },
    { name: "Weight training, vigorous", met: 6.0 },
    { name: "Yoga", met: 3.0 },
  ],
  "Outdoor & Recreation": [
    { name: "Dancing", met: 5.5 },
    { name: "Jump rope", met: 11.8 },
    { name: "Kayaking", met: 5.0 },
    { name: "Rock climbing", met: 11.0 },
    { name: "Skiing, cross-country", met: 9.0 },
    { name: "Skiing, downhill", met: 6.0 },
    { name: "Snowboarding", met: 5.3 },
    { name: "Stand-up paddleboarding", met: 6.0 },
    { name: "Surfing", met: 6.0 },
  ],
  "Daily Activities": [
    { name: "Cleaning, vigorous", met: 3.5 },
    { name: "Moving / carrying boxes", met: 5.0 },
    { name: "Shoveling snow", met: 6.0 },
    { name: "Yard work / gardening", met: 4.0 },
  ],
};

function sortByName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

/** Flat list: each category’s activities sorted alphabetically by name */
export const MET_ACTIVITIES: MetActivity[] = MET_ACTIVITY_CATEGORY_ORDER.flatMap((category) =>
  [...(BY_CATEGORY[category] ?? [])].sort(sortByName).map((row) => ({
    name: row.name,
    met: row.met,
    category,
  }))
);

const EXACT_NAME_TO_MET = new Map<string, number>(
  MET_ACTIVITIES.map((a) => [a.name.toLowerCase(), a.met])
);

/** Resolves MET when the activity string exactly matches a library name (trimmed). */
export function metForExactActivityName(name: string): number | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  const met = EXACT_NAME_TO_MET.get(key);
  return met ?? null;
}

/** Canonical MET row when `name` matches a library activity (trimmed, case-insensitive). */
export function findMetActivityByExactName(name: string): MetActivity | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  return MET_ACTIVITIES.find((a) => a.name.toLowerCase() === key) ?? null;
}

export function estimateCaloriesFromMet(met: number, weightKg: number, durationMinutes: number): number {
  const hours = durationMinutes / 60;
  return met * weightKg * hours;
}
