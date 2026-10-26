import type { Quality } from "@/lib/store/settings";

/** Entity budgets per quality tier (EntitySpawner config). */
export const SIM_DENSITY: Record<Quality, {
  vehicles: number; boats: number;
  walkers: number; strollers: number; groups: number; pets: number;
  flocks: number; pigeons: number; egrets: number;
}> = {
  low: { vehicles: 220, boats: 6, walkers: 120, strollers: 50, groups: 8, pets: 0, flocks: 2, pigeons: 0, egrets: 0 },
  medium: { vehicles: 520, boats: 12, walkers: 320, strollers: 140, groups: 22, pets: 10, flocks: 4, pigeons: 40, egrets: 8 },
  high: { vehicles: 900, boats: 18, walkers: 600, strollers: 260, groups: 40, pets: 20, flocks: 6, pigeons: 90, egrets: 14 },
};

/** SimulationLOD: camera distances (m) beyond which a layer is hidden and not updated. */
export const SIM_LOD = { people: 1300, creaturesGround: 900, wheels: 650, wakes: 1800 };
