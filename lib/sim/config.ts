import type { Quality } from "@/lib/store/settings";

/** Entity budgets per quality tier (EntitySpawner config). */
export const SIM_DENSITY: Record<Quality, {
  vehicles: number; boats: number;
  walkers: number; strollers: number; groups: number; pets: number;
  flocks: number; pigeons: number; egrets: number;
}> = {
  // the detailed city is ~2.5x larger since the Bình Thạnh / Thảo Cầm Viên extension
  low: { vehicles: 360, boats: 8, walkers: 200, strollers: 80, groups: 12, pets: 0, flocks: 3, pigeons: 0, egrets: 0 },
  medium: { vehicles: 900, boats: 18, walkers: 560, strollers: 240, groups: 36, pets: 16, flocks: 6, pigeons: 70, egrets: 12 },
  high: { vehicles: 1500, boats: 26, walkers: 1000, strollers: 420, groups: 64, pets: 30, flocks: 9, pigeons: 150, egrets: 22 },
};

/** SimulationLOD: camera distances (m) beyond which a layer is hidden and not updated. */
export const SIM_LOD = { people: 1300, creaturesGround: 900, wheels: 650, wakes: 1800 };
