// Age of War - Match Actor
// Manages game state, combat, and AI for a single match

import { actor, event } from "rivetkit";
import {
  TICK_MS,
  WORLD_WIDTH,
  GROUND_Y,
  BASE_HP,
  LEFT_BASE_X,
  RIGHT_BASE_X,
  STARTING_GOLD,
  GOLD_PER_TICK,
  GOLD_PER_KILL,
  XP_PER_KILL,
  XP_REQUIRED,
  EVOLUTION_COST,
  UNIT_CONFIGS,
  TURRET_CONFIGS,
  TURRET_SLOTS,
  TURRET_SLOT_SPACING,
  TURRET_SLOT_START_OFFSET,
  TURRET_SELL_RATIO,
  AI_TICK_DELAY,
  AI_SPAWN_CHANCE,
  AI_EVOLVE_PRIORITY,
  AI_TURRET_CHANCE,
  DISCONNECT_GRACE_MS,
  getAvailableUnits,
  getAvailableTurrets,
} from "./config.js";
import {
  Age,
  Side,
  GameMode,
  UnitType,
  TurretType,
  BaseState,
  UnitState,
  TurretState,
  ProjectileState,
  PlayerState,
  GameSnapshot,
  ActionResult,
} from "./types.js";

// ==================== INTERNAL STATE ====================

interface InternalPlayerState extends PlayerState {
  connId: string | null;
  disconnectedAt: number | null;
}

export interface MatchState {
  matchId: string;
  gameMode: GameMode;
  tick: number;
  gameOver: boolean;
  winningSide: Side | null;

  leftBase: BaseState;
  rightBase: BaseState;

  leftPlayer: InternalPlayerState;
  rightPlayer: InternalPlayerState;

  units: Record<string, UnitState>;
  turrets: Record<string, TurretState>;
  projectiles: Record<string, ProjectileState>;

  aiLastActionTick: number;
}

export interface MatchConnState {
  playerId: string;
  side: Side;
}

// ==================== HELPER FUNCTIONS ====================

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function getPlayer(state: MatchState, side: Side): InternalPlayerState {
  return side === Side.LEFT ? state.leftPlayer : state.rightPlayer;
}

function getBase(state: MatchState, side: Side): BaseState {
  return side === Side.LEFT ? state.leftBase : state.rightBase;
}

function getEnemyBase(state: MatchState, side: Side): BaseState {
  return side === Side.LEFT ? state.rightBase : state.leftBase;
}

function getEnemySide(side: Side): Side {
  return side === Side.LEFT ? Side.RIGHT : Side.LEFT;
}

// ==================== ACTOR DEFINITION ====================

export const match = actor({
  state: {
    matchId: "",
    gameMode: GameMode.PVE,
    tick: 0,
    gameOver: false,
    winningSide: null,

    leftBase: {
      side: Side.LEFT,
      hp: BASE_HP,
      maxHp: BASE_HP,
      x: LEFT_BASE_X,
    },
    rightBase: {
      side: Side.RIGHT,
      hp: BASE_HP,
      maxHp: BASE_HP,
      x: RIGHT_BASE_X,
    },

    leftPlayer: {
      side: Side.LEFT,
      gold: STARTING_GOLD,
      currentAge: Age.CAVEMAN,
      xp: 0,
      isAI: false,
      connId: null,
      disconnectedAt: null,
    },
    rightPlayer: {
      side: Side.RIGHT,
      gold: STARTING_GOLD,
      currentAge: Age.CAVEMAN,
      xp: 0,
      isAI: true,
      connId: null,
      disconnectedAt: null,
    },

    units: {},
    turrets: {},
    projectiles: {},

    aiLastActionTick: 0,
  } satisfies MatchState,

  events: {
    snapshot: event<GameSnapshot>(),
    gameOver: event<{ winningSide: Side }>(),
  },

  createConnState: (
    _c,
    params: { playerId: string; side: Side; gameMode?: GameMode }
  ): MatchConnState => ({
    playerId: params.playerId,
    side: params.side,
  }),

  onCreate: (c) => {
    c.state.matchId = generateId();
  },

  onConnect: (c, conn) => {
    const { side } = conn.state;
    const player = getPlayer(c.state, side);
    player.connId = conn.id;
    player.disconnectedAt = null;
    player.isAI = false;
  },

  onDisconnect: (c, conn) => {
    const { side } = conn.state;
    const player = getPlayer(c.state, side);
    player.disconnectedAt = Date.now();
  },

  // ==================== GAME LOOP ====================
  run: async (c) => {
    while (!c.aborted) {
      if (!c.state.gameOver) {
        c.state.tick++;
        const now = Date.now();

        // Handle disconnections - convert to AI after grace period
        handleDisconnections(c.state, now);

        // Generate passive gold
        generateGold(c.state);

        // Run AI logic for AI-controlled players
        runAI(c.state);

        // Update units (movement and targeting)
        updateUnits(c.state);

        // Update turrets (targeting)
        updateTurrets(c.state);

        // Process combat (attacks and damage)
        processCombat(c.state);

        // Update projectiles (movement)
        updateProjectiles(c.state);

        // Check win condition
        if (checkWinCondition(c.state)) {
          c.broadcast("gameOver", { winningSide: c.state.winningSide! });
        }
      }

      // Broadcast snapshot to all connected clients
      c.broadcast("snapshot", buildSnapshot(c.state));

      // Wait for next tick
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, TICK_MS);
        c.abortSignal.addEventListener(
          "abort",
          () => {
            clearTimeout(timeout);
            resolve();
          },
          { once: true }
        );
      });
    }
  },

  // ==================== ACTIONS ====================
  actions: {
    spawnUnit: (c, unitType: UnitType): ActionResult => {
      const side = c.conn?.state.side;
      if (!side) return { success: false, error: "Not connected" };
      return spawnUnit(c.state, side, unitType);
    },

    buildTurret: (c, turretType: TurretType, slotIndex: number): ActionResult => {
      const side = c.conn?.state.side;
      if (!side) return { success: false, error: "Not connected" };
      return buildTurret(c.state, side, turretType, slotIndex);
    },

    sellTurret: (c, turretId: string): ActionResult => {
      const side = c.conn?.state.side;
      if (!side) return { success: false, error: "Not connected" };
      return sellTurret(c.state, side, turretId);
    },

    evolve: (c): ActionResult => {
      const side = c.conn?.state.side;
      if (!side) return { success: false, error: "Not connected" };
      return evolveAge(c.state, side);
    },

    getSnapshot: (c): GameSnapshot => {
      return buildSnapshot(c.state);
    },
  },
});

// ==================== GAME LOGIC FUNCTIONS ====================

function handleDisconnections(state: MatchState, now: number): void {
  for (const player of [state.leftPlayer, state.rightPlayer]) {
    if (
      player.disconnectedAt !== null &&
      now - player.disconnectedAt > DISCONNECT_GRACE_MS
    ) {
      player.isAI = true;
    }
  }
}

function generateGold(state: MatchState): void {
  state.leftPlayer.gold += GOLD_PER_TICK;
  state.rightPlayer.gold += GOLD_PER_TICK;
}

function runAI(state: MatchState): void {
  if (state.leftPlayer.isAI) {
    runAIForSide(state, Side.LEFT);
  }
  if (state.rightPlayer.isAI) {
    runAIForSide(state, Side.RIGHT);
  }
}

function runAIForSide(state: MatchState, side: Side): void {
  // Only act every AI_TICK_DELAY ticks
  if (state.tick % AI_TICK_DELAY !== 0) {
    return;
  }

  const player = getPlayer(state, side);
  const availableUnits = getAvailableUnits(player.currentAge);
  const availableTurrets = getAvailableTurrets(player.currentAge);

  // Decision: Evolve age?
  if (player.currentAge < Age.FUTURE && Math.random() < AI_EVOLVE_PRIORITY) {
    const nextAge = (player.currentAge + 1) as Age;
    const requiredXP = XP_REQUIRED[nextAge];
    const cost = EVOLUTION_COST[nextAge];

    if (player.xp >= requiredXP && player.gold >= cost) {
      evolveAge(state, side);
      return;
    }
  }

  // Decision: Build turret?
  if (availableTurrets.length > 0 && Math.random() < AI_TURRET_CHANCE) {
    const turretType = availableTurrets[availableTurrets.length - 1]; // Best available
    const config = TURRET_CONFIGS[turretType];

    if (player.gold >= config.cost) {
      // Find empty slot
      for (let slot = 0; slot < TURRET_SLOTS; slot++) {
        const occupied = Object.values(state.turrets).some(
          (t) => t.side === side && t.slotIndex === slot
        );
        if (!occupied) {
          buildTurret(state, side, turretType, slot);
          return;
        }
      }
    }
  }

  // Decision: Spawn unit
  if (Math.random() < AI_SPAWN_CHANCE) {
    // Filter to affordable units
    const affordableUnits = availableUnits.filter(
      (type) => UNIT_CONFIGS[type].cost <= player.gold
    );

    if (affordableUnits.length > 0) {
      // Randomly pick one
      const selectedUnit =
        affordableUnits[Math.floor(Math.random() * affordableUnits.length)];
      spawnUnit(state, side, selectedUnit);
    }
  }
}

function spawnUnit(
  state: MatchState,
  side: Side,
  unitType: UnitType
): ActionResult {
  const player = getPlayer(state, side);
  const config = UNIT_CONFIGS[unitType];

  // Check age requirement
  if (config.age > player.currentAge) {
    return { success: false, error: "Unit not available in current age" };
  }

  // Check gold
  if (player.gold < config.cost) {
    return { success: false, error: "Not enough gold" };
  }

  // Deduct gold
  player.gold -= config.cost;

  // Create unit at base position
  const base = getBase(state, side);
  const id = generateId();
  const spawnOffset = side === Side.LEFT ? 40 : -40;

  state.units[id] = {
    id,
    type: unitType,
    side,
    hp: config.hp,
    maxHp: config.hp,
    x: base.x + spawnOffset,
    y: GROUND_Y,
    attackCooldown: 0,
    targetId: null,
  };

  return { success: true };
}

function buildTurret(
  state: MatchState,
  side: Side,
  turretType: TurretType,
  slotIndex: number
): ActionResult {
  const player = getPlayer(state, side);
  const config = TURRET_CONFIGS[turretType];

  // Validate slot
  if (slotIndex < 0 || slotIndex >= TURRET_SLOTS) {
    return { success: false, error: "Invalid turret slot" };
  }

  // Check if slot is occupied
  const existingTurret = Object.values(state.turrets).find(
    (t) => t.side === side && t.slotIndex === slotIndex
  );
  if (existingTurret) {
    return { success: false, error: "Slot already occupied" };
  }

  // Check age requirement
  if (config.age > player.currentAge) {
    return { success: false, error: "Turret not available in current age" };
  }

  // Check gold
  if (player.gold < config.cost) {
    return { success: false, error: "Not enough gold" };
  }

  // Deduct gold
  player.gold -= config.cost;

  // Calculate turret position
  const base = getBase(state, side);
  const offsetX = TURRET_SLOT_START_OFFSET + slotIndex * TURRET_SLOT_SPACING;
  const x = side === Side.LEFT ? base.x + offsetX : base.x - offsetX;

  const id = generateId();
  state.turrets[id] = {
    id,
    type: turretType,
    side,
    slotIndex,
    hp: config.hp,
    maxHp: config.hp,
    x,
    y: GROUND_Y - config.height / 2,
    attackCooldown: 0,
    targetId: null,
  };

  return { success: true };
}

function sellTurret(
  state: MatchState,
  side: Side,
  turretId: string
): ActionResult {
  const turret = state.turrets[turretId];

  if (!turret || turret.side !== side) {
    return { success: false, error: "Turret not found" };
  }

  const config = TURRET_CONFIGS[turret.type];
  const player = getPlayer(state, side);

  // Refund portion of cost
  player.gold += Math.floor(config.cost * TURRET_SELL_RATIO);

  delete state.turrets[turretId];

  return { success: true };
}

function evolveAge(state: MatchState, side: Side): ActionResult {
  const player = getPlayer(state, side);

  // Check if already at max age
  if (player.currentAge >= Age.FUTURE) {
    return { success: false, error: "Already at maximum age" };
  }

  const nextAge = (player.currentAge + 1) as Age;
  const requiredXP = XP_REQUIRED[nextAge];
  const cost = EVOLUTION_COST[nextAge];

  // Check XP requirement
  if (player.xp < requiredXP) {
    return { success: false, error: "Not enough experience" };
  }

  // Check gold requirement
  if (player.gold < cost) {
    return { success: false, error: "Not enough gold" };
  }

  // Deduct gold and evolve
  player.gold -= cost;
  player.currentAge = nextAge;

  return { success: true };
}

function updateUnits(state: MatchState): void {
  for (const unit of Object.values(state.units)) {
    const config = UNIT_CONFIGS[unit.type];
    const direction = unit.side === Side.LEFT ? 1 : -1;
    const enemySide = getEnemySide(unit.side);

    // Decrease attack cooldown
    if (unit.attackCooldown > 0) {
      unit.attackCooldown--;
    }

    // Find closest enemy unit or base in range
    let target: { id: string; type: "unit" | "turret" | "base"; x: number } | null = null;
    let closestDist = Infinity;

    // Check enemy units
    for (const enemy of Object.values(state.units)) {
      if (enemy.side === enemySide) {
        const dist = Math.abs(unit.x - enemy.x);
        if (dist <= config.range && dist < closestDist) {
          target = { id: enemy.id, type: "unit", x: enemy.x };
          closestDist = dist;
        }
      }
    }

    // Check enemy turrets
    for (const turret of Object.values(state.turrets)) {
      if (turret.side === enemySide) {
        const dist = Math.abs(unit.x - turret.x);
        if (dist <= config.range && dist < closestDist) {
          target = { id: turret.id, type: "turret", x: turret.x };
          closestDist = dist;
        }
      }
    }

    // Check enemy base
    const enemyBase = getEnemyBase(state, unit.side);
    const baseDist = Math.abs(unit.x - enemyBase.x);
    if (baseDist <= config.range && baseDist < closestDist) {
      target = { id: enemySide, type: "base", x: enemyBase.x };
    }

    if (target) {
      unit.targetId = target.id;
      // Stop moving - in attack mode
    } else {
      unit.targetId = null;
      // Move toward enemy base
      unit.x += config.speed * direction;

      // Clamp to battlefield bounds
      unit.x = Math.max(LEFT_BASE_X, Math.min(RIGHT_BASE_X, unit.x));
    }
  }
}

function updateTurrets(state: MatchState): void {
  for (const turret of Object.values(state.turrets)) {
    const config = TURRET_CONFIGS[turret.type];
    const enemySide = getEnemySide(turret.side);

    // Decrease attack cooldown
    if (turret.attackCooldown > 0) {
      turret.attackCooldown--;
    }

    // Find closest enemy unit in range
    let closestEnemy: UnitState | null = null;
    let closestDist = Infinity;

    for (const unit of Object.values(state.units)) {
      if (unit.side === enemySide) {
        const dist = Math.abs(turret.x - unit.x);
        if (dist <= config.range && dist < closestDist) {
          closestEnemy = unit;
          closestDist = dist;
        }
      }
    }

    turret.targetId = closestEnemy?.id ?? null;
  }
}

function processCombat(state: MatchState): void {
  const unitsToRemove: string[] = [];
  const turretsToRemove: string[] = [];

  // Process unit attacks
  for (const unit of Object.values(state.units)) {
    if (unit.attackCooldown > 0 || !unit.targetId) continue;

    const config = UNIT_CONFIGS[unit.type];

    // Determine target type and apply damage
    const enemyUnit = state.units[unit.targetId];
    const enemyTurret = state.turrets[unit.targetId];

    if (enemyUnit) {
      // Attack enemy unit
      applyDamage(state, unit, enemyUnit, config.damage, config.isRanged);
      unit.attackCooldown = config.attackSpeed;

      if (enemyUnit.hp <= 0) {
        unitsToRemove.push(enemyUnit.id);
        awardKill(state, unit.side);
      }
    } else if (enemyTurret) {
      // Attack enemy turret
      applyDamageToTurret(state, unit, enemyTurret, config.damage, config.isRanged);
      unit.attackCooldown = config.attackSpeed;

      if (enemyTurret.hp <= 0) {
        turretsToRemove.push(enemyTurret.id);
        awardKill(state, unit.side);
      }
    } else if (unit.targetId === Side.LEFT || unit.targetId === Side.RIGHT) {
      // Attack base
      const targetBase =
        unit.targetId === Side.LEFT ? state.leftBase : state.rightBase;
      applyDamageToBase(state, unit, targetBase, config.damage, config.isRanged);
      unit.attackCooldown = config.attackSpeed;
    }
  }

  // Process turret attacks
  for (const turret of Object.values(state.turrets)) {
    if (turret.attackCooldown > 0 || !turret.targetId) continue;

    const config = TURRET_CONFIGS[turret.type];
    const target = state.units[turret.targetId];

    if (target) {
      // Create projectile
      const id = generateId();
      state.projectiles[id] = {
        id,
        x: turret.x,
        y: turret.y,
        targetX: target.x,
        targetY: target.y,
        damage: config.damage,
        side: turret.side,
      };

      // Apply damage immediately (projectile is visual only)
      target.hp -= config.damage;
      turret.attackCooldown = config.attackSpeed;

      if (target.hp <= 0) {
        unitsToRemove.push(target.id);
        awardKill(state, turret.side);
      }
    }
  }

  // Remove dead units and turrets
  for (const id of unitsToRemove) {
    delete state.units[id];
  }
  for (const id of turretsToRemove) {
    delete state.turrets[id];
  }
}

function applyDamage(
  state: MatchState,
  attacker: UnitState,
  target: UnitState,
  damage: number,
  isRanged: boolean
): void {
  if (isRanged) {
    // Create projectile
    const id = generateId();
    state.projectiles[id] = {
      id,
      x: attacker.x,
      y: attacker.y,
      targetX: target.x,
      targetY: target.y,
      damage,
      side: attacker.side,
    };
  }
  // Apply damage immediately (projectile is visual only)
  target.hp -= damage;
}

function applyDamageToTurret(
  state: MatchState,
  attacker: UnitState,
  target: TurretState,
  damage: number,
  isRanged: boolean
): void {
  if (isRanged) {
    const id = generateId();
    state.projectiles[id] = {
      id,
      x: attacker.x,
      y: attacker.y,
      targetX: target.x,
      targetY: target.y,
      damage,
      side: attacker.side,
    };
  }
  target.hp -= damage;
}

function applyDamageToBase(
  state: MatchState,
  attacker: UnitState,
  target: BaseState,
  damage: number,
  isRanged: boolean
): void {
  if (isRanged) {
    const id = generateId();
    state.projectiles[id] = {
      id,
      x: attacker.x,
      y: attacker.y,
      targetX: target.x,
      targetY: GROUND_Y - 50,
      damage,
      side: attacker.side,
    };
  }
  target.hp -= damage;
}

function awardKill(state: MatchState, killerSide: Side): void {
  const player = getPlayer(state, killerSide);
  player.gold += GOLD_PER_KILL;
  player.xp += XP_PER_KILL;
}

function updateProjectiles(state: MatchState): void {
  const toRemove: string[] = [];

  for (const proj of Object.values(state.projectiles)) {
    // Move projectile toward target
    const dx = proj.targetX - proj.x;
    const dy = proj.targetY - proj.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = 15; // Projectile speed

    if (dist < speed) {
      // Projectile reached target
      toRemove.push(proj.id);
    } else {
      proj.x += (dx / dist) * speed;
      proj.y += (dy / dist) * speed;
    }
  }

  for (const id of toRemove) {
    delete state.projectiles[id];
  }
}

function checkWinCondition(state: MatchState): boolean {
  if (state.leftBase.hp <= 0) {
    state.gameOver = true;
    state.winningSide = Side.RIGHT;
    return true;
  }
  if (state.rightBase.hp <= 0) {
    state.gameOver = true;
    state.winningSide = Side.LEFT;
    return true;
  }
  return false;
}

// ==================== SNAPSHOT ====================

function buildSnapshot(state: MatchState): GameSnapshot {
  return {
    tick: state.tick,
    gameOver: state.gameOver,
    winningSide: state.winningSide,

    leftBase: state.leftBase,
    rightBase: state.rightBase,

    leftPlayer: {
      side: state.leftPlayer.side,
      gold: Math.floor(state.leftPlayer.gold),
      currentAge: state.leftPlayer.currentAge,
      xp: state.leftPlayer.xp,
      isAI: state.leftPlayer.isAI,
    },
    rightPlayer: {
      side: state.rightPlayer.side,
      gold: Math.floor(state.rightPlayer.gold),
      currentAge: state.rightPlayer.currentAge,
      xp: state.rightPlayer.xp,
      isAI: state.rightPlayer.isAI,
    },

    units: Object.values(state.units),
    turrets: Object.values(state.turrets),
    projectiles: Object.values(state.projectiles),

    worldWidth: WORLD_WIDTH,
    groundY: GROUND_Y,
  };
}
