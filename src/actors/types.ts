// Age of War - Shared types for actors and client

// ==================== ENUMS ====================

export enum Age {
  CAVEMAN = 0,
  CASTLE = 1,
  RENAISSANCE = 2,
  MODERN = 3,
  FUTURE = 4,
}

export enum Side {
  LEFT = "left",
  RIGHT = "right",
}

export enum GameMode {
  PVP = "pvp",
  PVE = "pve",
}

// ==================== UNIT TYPES ====================

export enum UnitType {
  // Caveman Age (Age 0)
  CLUBMAN = "clubman",
  SLINGER = "slinger",
  DINO_RIDER = "dino_rider",

  // Castle Age (Age 1)
  SWORDSMAN = "swordsman",
  ARCHER = "archer",
  KNIGHT = "knight",

  // Renaissance Age (Age 2)
  MUSKETEER = "musketeer",
  CAVALRY = "cavalry",
  CANNON_CREW = "cannon_crew",

  // Modern Age (Age 3)
  INFANTRY = "infantry",
  TANK = "tank",
  HELICOPTER = "helicopter",

  // Future Age (Age 4)
  LASER_TROOPER = "laser_trooper",
  MECH = "mech",
  UFO = "ufo",
}

// ==================== TURRET TYPES ====================

export enum TurretType {
  ROCK_THROWER = "rock_thrower",
  ARROW_TOWER = "arrow_tower",
  CANNON_TOWER = "cannon_tower",
  MACHINE_GUN = "machine_gun",
  LASER_TURRET = "laser_turret",
}

// ==================== ENTITY STATES ====================

export interface BaseState {
  side: Side;
  hp: number;
  maxHp: number;
  x: number;
}

export interface UnitState {
  id: string;
  type: UnitType;
  side: Side;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  attackCooldown: number;
  targetId: string | null;
}

export interface TurretState {
  id: string;
  type: TurretType;
  side: Side;
  slotIndex: number;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  attackCooldown: number;
  targetId: string | null;
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  damage: number;
  side: Side;
}

// ==================== PLAYER STATE ====================

export interface PlayerState {
  side: Side;
  gold: number;
  currentAge: Age;
  xp: number;
  isAI: boolean;
}

// Client-visible player state (excludes internal fields)
export interface PlayerSnapshot {
  side: Side;
  gold: number;
  currentAge: Age;
  xp: number;
  isAI: boolean;
}

// ==================== GAME SNAPSHOT ====================

export interface GameSnapshot {
  tick: number;
  gameOver: boolean;
  winningSide: Side | null;

  leftBase: BaseState;
  rightBase: BaseState;

  leftPlayer: PlayerSnapshot;
  rightPlayer: PlayerSnapshot;

  units: UnitState[];
  turrets: TurretState[];
  projectiles: ProjectileState[];

  worldWidth: number;
  groundY: number;
}

// ==================== MATCHMAKING ====================

export interface JoinResult {
  matchId: string;
  playerId: string;
  side: Side;
  gameMode: GameMode;
}

export interface MatchRequest {
  playerName: string;
  gameMode: GameMode;
}

// ==================== ACTION RESULTS ====================

export interface ActionResult {
  success: boolean;
  error?: string;
}
