// Age of War - Game configuration and balance constants

import { Age, UnitType, TurretType } from "./types.js";

// ==================== GENERAL CONFIG ====================

export const TICK_MS = 50; // 20 ticks per second
export const WORLD_WIDTH = 1200;
export const WORLD_HEIGHT = 500;
export const GROUND_Y = 400;

// Base configuration
export const BASE_WIDTH = 80;
export const BASE_HEIGHT = 120;
export const BASE_HP = 1000;
export const LEFT_BASE_X = 60;
export const RIGHT_BASE_X = WORLD_WIDTH - 60;

// Turret slots
export const TURRET_SLOTS = 3;
export const TURRET_SLOT_SPACING = 80;
export const TURRET_SLOT_START_OFFSET = 100;

// ==================== ECONOMY CONFIG ====================

export const STARTING_GOLD = 100;
export const GOLD_PER_TICK = 0.5;
export const GOLD_PER_KILL = 25;
export const XP_PER_KILL = 50;
export const TURRET_SELL_RATIO = 0.5;

// ==================== AGE EVOLUTION CONFIG ====================

export const XP_REQUIRED: Record<Age, number> = {
  [Age.CAVEMAN]: 0,
  [Age.CASTLE]: 500,
  [Age.RENAISSANCE]: 1200,
  [Age.MODERN]: 2500,
  [Age.FUTURE]: 5000,
};

export const EVOLUTION_COST: Record<Age, number> = {
  [Age.CAVEMAN]: 0,
  [Age.CASTLE]: 200,
  [Age.RENAISSANCE]: 500,
  [Age.MODERN]: 1000,
  [Age.FUTURE]: 2000,
};

export const AGE_NAMES: Record<Age, string> = {
  [Age.CAVEMAN]: "Stone Age",
  [Age.CASTLE]: "Medieval",
  [Age.RENAISSANCE]: "Renaissance",
  [Age.MODERN]: "Modern Era",
  [Age.FUTURE]: "Future",
};

// ==================== UNIT CONFIG ====================

export interface UnitConfig {
  age: Age;
  name: string;
  cost: number;
  hp: number;
  damage: number;
  attackSpeed: number; // Ticks between attacks
  speed: number; // Pixels per tick
  range: number; // Attack range in pixels
  isRanged: boolean;
  width: number;
  height: number;
  color: string;
}

export const UNIT_CONFIGS: Record<UnitType, UnitConfig> = {
  // ===== CAVEMAN AGE =====
  [UnitType.CLUBMAN]: {
    age: Age.CAVEMAN,
    name: "Clubman",
    cost: 25,
    hp: 50,
    damage: 10,
    attackSpeed: 20,
    speed: 2,
    range: 30,
    isRanged: false,
    width: 20,
    height: 40,
    color: "#8B4513",
  },
  [UnitType.SLINGER]: {
    age: Age.CAVEMAN,
    name: "Slinger",
    cost: 40,
    hp: 30,
    damage: 8,
    attackSpeed: 30,
    speed: 1.5,
    range: 150,
    isRanged: true,
    width: 20,
    height: 40,
    color: "#A0522D",
  },
  [UnitType.DINO_RIDER]: {
    age: Age.CAVEMAN,
    name: "Dino Rider",
    cost: 100,
    hp: 120,
    damage: 25,
    attackSpeed: 25,
    speed: 3,
    range: 40,
    isRanged: false,
    width: 50,
    height: 50,
    color: "#228B22",
  },

  // ===== CASTLE AGE =====
  [UnitType.SWORDSMAN]: {
    age: Age.CASTLE,
    name: "Swordsman",
    cost: 35,
    hp: 70,
    damage: 15,
    attackSpeed: 18,
    speed: 2,
    range: 30,
    isRanged: false,
    width: 20,
    height: 45,
    color: "#708090",
  },
  [UnitType.ARCHER]: {
    age: Age.CASTLE,
    name: "Archer",
    cost: 50,
    hp: 40,
    damage: 12,
    attackSpeed: 25,
    speed: 1.5,
    range: 180,
    isRanged: true,
    width: 20,
    height: 45,
    color: "#2E8B57",
  },
  [UnitType.KNIGHT]: {
    age: Age.CASTLE,
    name: "Knight",
    cost: 120,
    hp: 150,
    damage: 30,
    attackSpeed: 22,
    speed: 3.5,
    range: 35,
    isRanged: false,
    width: 40,
    height: 50,
    color: "#4682B4",
  },

  // ===== RENAISSANCE AGE =====
  [UnitType.MUSKETEER]: {
    age: Age.RENAISSANCE,
    name: "Musketeer",
    cost: 45,
    hp: 60,
    damage: 20,
    attackSpeed: 35,
    speed: 1.8,
    range: 200,
    isRanged: true,
    width: 20,
    height: 45,
    color: "#4169E1",
  },
  [UnitType.CAVALRY]: {
    age: Age.RENAISSANCE,
    name: "Cavalry",
    cost: 80,
    hp: 100,
    damage: 25,
    attackSpeed: 20,
    speed: 4,
    range: 35,
    isRanged: false,
    width: 45,
    height: 45,
    color: "#8B0000",
  },
  [UnitType.CANNON_CREW]: {
    age: Age.RENAISSANCE,
    name: "Cannon",
    cost: 150,
    hp: 80,
    damage: 50,
    attackSpeed: 60,
    speed: 1,
    range: 250,
    isRanged: true,
    width: 50,
    height: 40,
    color: "#2F4F4F",
  },

  // ===== MODERN AGE =====
  [UnitType.INFANTRY]: {
    age: Age.MODERN,
    name: "Infantry",
    cost: 55,
    hp: 80,
    damage: 25,
    attackSpeed: 15,
    speed: 2.2,
    range: 180,
    isRanged: true,
    width: 20,
    height: 45,
    color: "#556B2F",
  },
  [UnitType.TANK]: {
    age: Age.MODERN,
    name: "Tank",
    cost: 200,
    hp: 300,
    damage: 60,
    attackSpeed: 40,
    speed: 1.5,
    range: 200,
    isRanged: true,
    width: 60,
    height: 40,
    color: "#3D5A3D",
  },
  [UnitType.HELICOPTER]: {
    age: Age.MODERN,
    name: "Helicopter",
    cost: 180,
    hp: 120,
    damage: 40,
    attackSpeed: 20,
    speed: 3,
    range: 220,
    isRanged: true,
    width: 50,
    height: 30,
    color: "#696969",
  },

  // ===== FUTURE AGE =====
  [UnitType.LASER_TROOPER]: {
    age: Age.FUTURE,
    name: "Laser Trooper",
    cost: 70,
    hp: 100,
    damage: 35,
    attackSpeed: 12,
    speed: 2.5,
    range: 200,
    isRanged: true,
    width: 25,
    height: 50,
    color: "#00CED1",
  },
  [UnitType.MECH]: {
    age: Age.FUTURE,
    name: "Mech",
    cost: 300,
    hp: 500,
    damage: 80,
    attackSpeed: 30,
    speed: 1.8,
    range: 60,
    isRanged: false,
    width: 60,
    height: 70,
    color: "#4682B4",
  },
  [UnitType.UFO]: {
    age: Age.FUTURE,
    name: "UFO",
    cost: 250,
    hp: 200,
    damage: 60,
    attackSpeed: 18,
    speed: 3.5,
    range: 280,
    isRanged: true,
    width: 50,
    height: 25,
    color: "#9400D3",
  },
};

// ==================== TURRET CONFIG ====================

export interface TurretConfig {
  age: Age;
  name: string;
  cost: number;
  hp: number;
  damage: number;
  attackSpeed: number; // Ticks between attacks
  range: number;
  width: number;
  height: number;
  color: string;
}

export const TURRET_CONFIGS: Record<TurretType, TurretConfig> = {
  [TurretType.ROCK_THROWER]: {
    age: Age.CAVEMAN,
    name: "Rock Thrower",
    cost: 75,
    hp: 100,
    damage: 15,
    attackSpeed: 40,
    range: 200,
    width: 40,
    height: 50,
    color: "#696969",
  },
  [TurretType.ARROW_TOWER]: {
    age: Age.CASTLE,
    name: "Arrow Tower",
    cost: 100,
    hp: 150,
    damage: 20,
    attackSpeed: 25,
    range: 250,
    width: 40,
    height: 60,
    color: "#8B4513",
  },
  [TurretType.CANNON_TOWER]: {
    age: Age.RENAISSANCE,
    name: "Cannon Tower",
    cost: 150,
    hp: 200,
    damage: 40,
    attackSpeed: 50,
    range: 300,
    width: 45,
    height: 55,
    color: "#2F4F4F",
  },
  [TurretType.MACHINE_GUN]: {
    age: Age.MODERN,
    name: "Machine Gun",
    cost: 200,
    hp: 250,
    damage: 15,
    attackSpeed: 8,
    range: 280,
    width: 45,
    height: 50,
    color: "#556B2F",
  },
  [TurretType.LASER_TURRET]: {
    age: Age.FUTURE,
    name: "Laser Turret",
    cost: 300,
    hp: 350,
    damage: 50,
    attackSpeed: 15,
    range: 350,
    width: 50,
    height: 60,
    color: "#FF4500",
  },
};

// ==================== AI CONFIG ====================

export const AI_TICK_DELAY = 40; // AI makes decisions every 2 seconds
export const AI_SPAWN_CHANCE = 0.7; // 70% chance to spawn when able
export const AI_EVOLVE_PRIORITY = 0.6; // 60% chance to prioritize evolution
export const AI_TURRET_CHANCE = 0.3; // 30% chance to build turret

// ==================== DISCONNECT CONFIG ====================

export const DISCONNECT_GRACE_MS = 10000; // 10 seconds before converting to AI

// ==================== HELPER FUNCTIONS ====================

export function getUnitsForAge(age: Age): UnitType[] {
  return (Object.entries(UNIT_CONFIGS) as [UnitType, UnitConfig][])
    .filter(([_, config]) => config.age === age)
    .map(([type, _]) => type);
}

export function getAvailableUnits(currentAge: Age): UnitType[] {
  return (Object.entries(UNIT_CONFIGS) as [UnitType, UnitConfig][])
    .filter(([_, config]) => config.age <= currentAge)
    .map(([type, _]) => type);
}

export function getTurretForAge(age: Age): TurretType | null {
  const entry = (Object.entries(TURRET_CONFIGS) as [TurretType, TurretConfig][])
    .find(([_, config]) => config.age === age);
  return entry ? entry[0] : null;
}

export function getAvailableTurrets(currentAge: Age): TurretType[] {
  return (Object.entries(TURRET_CONFIGS) as [TurretType, TurretConfig][])
    .filter(([_, config]) => config.age <= currentAge)
    .map(([type, _]) => type);
}

export function canEvolve(currentAge: Age, xp: number, gold: number): boolean {
  if (currentAge >= Age.FUTURE) return false;
  const nextAge = (currentAge + 1) as Age;
  return xp >= XP_REQUIRED[nextAge] && gold >= EVOLUTION_COST[nextAge];
}

export function getNextAge(currentAge: Age): Age | null {
  if (currentAge >= Age.FUTURE) return null;
  return (currentAge + 1) as Age;
}
