import React, { useEffect, useRef, useState, useCallback } from "react";
import { createRivetKit } from "@rivetkit/react";
import type { Registry } from "../actors/registry.js";
import {
  GameSnapshot,
  Side,
  GameMode,
  UnitType,
  TurretType,
  Age,
} from "../actors/types.js";
import {
  UNIT_CONFIGS,
  TURRET_CONFIGS,
  TURRET_SLOTS,
  AGE_NAMES,
  XP_REQUIRED,
  EVOLUTION_COST,
  getAvailableUnits,
  getAvailableTurrets,
} from "../actors/config.js";

interface GameProps {
  client: ReturnType<typeof import("rivetkit/client").createClient<Registry>>;
  matchId: string;
  playerId: string;
  side: Side;
  gameMode: GameMode;
  onGameOver: (winningSide: Side) => void;
}

// In production, connect through our server which returns the Rivet Cloud endpoint
// In local dev, connect to the local engine on port 6420
const endpoint = import.meta.env.DEV
  ? "http://localhost:6420"
  : window.location.origin + "/api/rivet";

const { useActor } = createRivetKit<Registry>({ endpoint });

// Canvas dimensions
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 500;

export default function Game({
  client,
  matchId,
  playerId,
  side,
  gameMode,
  onGameOver,
}: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [selectedTurretSlot, setSelectedTurretSlot] = useState<number | null>(null);

  const actor = useActor({
    name: "match",
    key: [matchId],
    params: { playerId, side, gameMode },
  });

  // Handle snapshot events
  actor.useEvent("snapshot", (data) => {
    setSnapshot(data as GameSnapshot);
  });

  // Handle game over events
  actor.useEvent("gameOver", (data) => {
    const { winningSide } = data as { winningSide: Side };
    onGameOver(winningSide);
  });

  // Action handlers
  const handleSpawnUnit = useCallback(
    (unitType: UnitType) => {
      if (actor.connection) {
        actor.connection.spawnUnit(unitType);
      }
    },
    [actor.connection]
  );

  const handleBuildTurret = useCallback(
    (turretType: TurretType, slotIndex: number) => {
      if (actor.connection) {
        actor.connection.buildTurret(turretType, slotIndex);
        setSelectedTurretSlot(null);
      }
    },
    [actor.connection]
  );

  const handleEvolve = useCallback(() => {
    if (actor.connection) {
      actor.connection.evolve();
    }
  }, [actor.connection]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Clear canvas with sky color
    ctx.fillStyle = "#87CEEB";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw ground
    ctx.fillStyle = "#8B4513";
    ctx.fillRect(0, snapshot.groundY, canvas.width, canvas.height - snapshot.groundY);

    // Draw ground line
    ctx.strokeStyle = "#5D3A1A";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, snapshot.groundY);
    ctx.lineTo(canvas.width, snapshot.groundY);
    ctx.stroke();

    // Draw bases
    drawBase(ctx, snapshot.leftBase, snapshot.groundY, side === Side.LEFT);
    drawBase(ctx, snapshot.rightBase, snapshot.groundY, side === Side.RIGHT);

    // Draw turret slots (empty slots)
    drawTurretSlots(ctx, Side.LEFT, snapshot.turrets, snapshot.groundY, selectedTurretSlot, side === Side.LEFT);
    drawTurretSlots(ctx, Side.RIGHT, snapshot.turrets, snapshot.groundY, selectedTurretSlot, side === Side.RIGHT);

    // Draw turrets
    for (const turret of snapshot.turrets) {
      drawTurret(ctx, turret, snapshot.groundY);
    }

    // Draw units
    for (const unit of snapshot.units) {
      drawUnit(ctx, unit, snapshot.groundY);
    }

    // Draw projectiles
    for (const proj of snapshot.projectiles) {
      drawProjectile(ctx, proj);
    }
  }, [snapshot, side, selectedTurretSlot]);

  if (!snapshot) {
    return (
      <div style={styles.loading}>
        <p>Loading battle...</p>
      </div>
    );
  }

  const playerState = side === Side.LEFT ? snapshot.leftPlayer : snapshot.rightPlayer;
  const enemyState = side === Side.LEFT ? snapshot.rightPlayer : snapshot.leftPlayer;
  const availableUnits = getAvailableUnits(playerState.currentAge);
  const availableTurrets = getAvailableTurrets(playerState.currentAge);

  const nextAge = playerState.currentAge < Age.FUTURE ? (playerState.currentAge + 1) as Age : null;
  const xpRequired = nextAge !== null ? XP_REQUIRED[nextAge] : 0;
  const evolveCost = nextAge !== null ? EVOLUTION_COST[nextAge] : 0;
  const canEvolve =
    nextAge !== null &&
    playerState.xp >= xpRequired &&
    playerState.gold >= evolveCost;

  return (
    <div style={styles.gameContainer}>
      {/* Top Bar */}
      <div style={styles.topBar}>
        <div style={styles.goldDisplay}>
          <span style={styles.goldIcon}>G</span>
          <span style={styles.goldAmount}>{playerState.gold}</span>
        </div>

        <div style={styles.ageIndicator}>
          <span style={styles.ageName}>{AGE_NAMES[playerState.currentAge]}</span>
          <span style={styles.ageNumber}>Age {playerState.currentAge + 1}/5</span>
        </div>

        <div style={styles.enemyInfo}>
          <span>Enemy: {AGE_NAMES[enemyState.currentAge]}</span>
          {enemyState.isAI && <span style={styles.aiLabel}> (AI)</span>}
        </div>
      </div>

      {/* Canvas */}
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* Bottom HUD */}
      <div style={styles.bottomBar}>
        {/* Unit Buttons */}
        <div style={styles.buttonGroup}>
          <span style={styles.groupLabel}>Units</span>
          <div style={styles.buttonRow}>
            {availableUnits.map((unitType) => {
              const config = UNIT_CONFIGS[unitType];
              const canAfford = playerState.gold >= config.cost;
              return (
                <button
                  key={unitType}
                  onClick={() => handleSpawnUnit(unitType)}
                  disabled={!canAfford}
                  style={{
                    ...styles.unitButton,
                    opacity: canAfford ? 1 : 0.5,
                    borderColor: config.color,
                  }}
                >
                  <div
                    style={{
                      ...styles.unitPreview,
                      backgroundColor: config.color,
                    }}
                  />
                  <span style={styles.unitName}>{config.name}</span>
                  <span style={styles.unitCost}>{config.cost}g</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Turret Buttons */}
        <div style={styles.buttonGroup}>
          <span style={styles.groupLabel}>Turrets</span>
          <div style={styles.buttonRow}>
            {availableTurrets.map((turretType) => {
              const config = TURRET_CONFIGS[turretType];
              const canAfford = playerState.gold >= config.cost;
              const occupiedSlots = snapshot.turrets
                .filter((t) => t.side === side)
                .map((t) => t.slotIndex);
              const hasEmptySlot = occupiedSlots.length < TURRET_SLOTS;

              return (
                <button
                  key={turretType}
                  onClick={() => {
                    if (selectedTurretSlot !== null) {
                      handleBuildTurret(turretType, selectedTurretSlot);
                    } else {
                      // Find first empty slot
                      for (let i = 0; i < TURRET_SLOTS; i++) {
                        if (!occupiedSlots.includes(i)) {
                          setSelectedTurretSlot(i);
                          break;
                        }
                      }
                    }
                  }}
                  disabled={!canAfford || !hasEmptySlot}
                  style={{
                    ...styles.turretButton,
                    opacity: canAfford && hasEmptySlot ? 1 : 0.5,
                    borderColor: config.color,
                  }}
                >
                  <div
                    style={{
                      ...styles.turretPreview,
                      borderBottomColor: config.color,
                    }}
                  />
                  <span style={styles.unitName}>{config.name}</span>
                  <span style={styles.unitCost}>{config.cost}g</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Evolve Button */}
        <div style={styles.evolveSection}>
          {nextAge !== null ? (
            <button
              onClick={handleEvolve}
              disabled={!canEvolve}
              style={{
                ...styles.evolveButton,
                opacity: canEvolve ? 1 : 0.6,
              }}
            >
              <span style={styles.evolveLabel}>EVOLVE</span>
              <span style={styles.evolveAge}>{AGE_NAMES[nextAge]}</span>
              <div style={styles.xpBarContainer}>
                <div
                  style={{
                    ...styles.xpBarFill,
                    width: `${Math.min(100, (playerState.xp / xpRequired) * 100)}%`,
                  }}
                />
              </div>
              <span style={styles.xpText}>
                {playerState.xp}/{xpRequired} XP
              </span>
              <span style={styles.evolveCost}>{evolveCost}g</span>
            </button>
          ) : (
            <div style={styles.maxAgeLabel}>MAX AGE</div>
          )}
        </div>
      </div>

      {/* Turret Slot Selection Overlay */}
      {selectedTurretSlot !== null && (
        <div style={styles.slotOverlay}>
          <p>Click a turret to build in slot {selectedTurretSlot + 1}</p>
          <button onClick={() => setSelectedTurretSlot(null)} style={styles.cancelButton}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ==================== DRAWING FUNCTIONS ====================

function drawBase(
  ctx: CanvasRenderingContext2D,
  base: { side: Side; hp: number; maxHp: number; x: number },
  groundY: number,
  isPlayer: boolean
) {
  const width = 80;
  const height = 120;
  const x = base.x - width / 2;
  const y = groundY - height;

  // Base body
  ctx.fillStyle = isPlayer ? "#3498db" : "#e74c3c";
  ctx.fillRect(x, y, width, height);

  // Base border
  ctx.strokeStyle = isPlayer ? "#2980b9" : "#c0392b";
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, width, height);

  // Windows/details
  ctx.fillStyle = isPlayer ? "#2980b9" : "#c0392b";
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 2; col++) {
      ctx.fillRect(x + 15 + col * 35, y + 20 + row * 35, 15, 20);
    }
  }

  // HP bar
  drawHPBar(ctx, x, y - 15, width, 8, base.hp, base.maxHp);
}

function drawTurretSlots(
  ctx: CanvasRenderingContext2D,
  baseSide: Side,
  turrets: { side: Side; slotIndex: number }[],
  groundY: number,
  selectedSlot: number | null,
  isPlayerSide: boolean
) {
  const baseX = baseSide === Side.LEFT ? 60 : 1140;
  const startOffset = 100;
  const spacing = 80;

  for (let i = 0; i < TURRET_SLOTS; i++) {
    const occupied = turrets.some((t) => t.side === baseSide && t.slotIndex === i);
    if (occupied) continue;

    const x = baseSide === Side.LEFT ? baseX + startOffset + i * spacing : baseX - startOffset - i * spacing;
    const y = groundY - 25;

    // Draw empty slot
    ctx.strokeStyle = selectedSlot === i && isPlayerSide ? "#fff" : "#555";
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(x - 20, y - 25, 40, 50);
    ctx.setLineDash([]);

    // Slot number
    ctx.fillStyle = "#555";
    ctx.font = "12px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`${i + 1}`, x, y + 35);
  }
}

function drawTurret(
  ctx: CanvasRenderingContext2D,
  turret: { type: TurretType; side: Side; x: number; y: number; hp: number; maxHp: number },
  groundY: number
) {
  const config = TURRET_CONFIGS[turret.type];

  // Turret base
  ctx.fillStyle = "#444";
  ctx.fillRect(turret.x - 15, groundY - 20, 30, 20);

  // Turret body (triangle pointing toward enemy)
  ctx.fillStyle = config.color;
  ctx.beginPath();
  if (turret.side === Side.LEFT) {
    ctx.moveTo(turret.x + 20, turret.y);
    ctx.lineTo(turret.x - 10, turret.y - 15);
    ctx.lineTo(turret.x - 10, turret.y + 15);
  } else {
    ctx.moveTo(turret.x - 20, turret.y);
    ctx.lineTo(turret.x + 10, turret.y - 15);
    ctx.lineTo(turret.x + 10, turret.y + 15);
  }
  ctx.closePath();
  ctx.fill();

  // HP bar
  drawHPBar(ctx, turret.x - 15, turret.y - 30, 30, 4, turret.hp, turret.maxHp);
}

function drawUnit(
  ctx: CanvasRenderingContext2D,
  unit: { type: UnitType; side: Side; x: number; y: number; hp: number; maxHp: number },
  groundY: number
) {
  const config = UNIT_CONFIGS[unit.type];
  const isLeft = unit.side === Side.LEFT;

  ctx.save();
  ctx.translate(unit.x, groundY);

  // Flip for right-side units
  if (!isLeft) {
    ctx.scale(-1, 1);
  }

  // Draw unit body based on config
  ctx.fillStyle = config.color;

  // Body rectangle
  ctx.fillRect(-config.width / 2, -config.height, config.width, config.height);

  // Head circle
  ctx.beginPath();
  ctx.arc(0, -config.height - 8, 8, 0, Math.PI * 2);
  ctx.fill();

  // Weapon indicator for ranged
  if (config.isRanged) {
    ctx.fillStyle = "#333";
    ctx.fillRect(config.width / 2, -config.height / 2 - 3, 15, 6);
  }

  ctx.restore();

  // HP bar (don't flip)
  drawHPBar(
    ctx,
    unit.x - config.width / 2,
    groundY - config.height - 25,
    config.width,
    3,
    unit.hp,
    unit.maxHp
  );
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  proj: { x: number; y: number; side: Side }
) {
  ctx.fillStyle = proj.side === Side.LEFT ? "#FFD700" : "#FF6B6B";
  ctx.beginPath();
  ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
  ctx.fill();
}

function drawHPBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  hp: number,
  maxHp: number
) {
  const ratio = hp / maxHp;

  // Background
  ctx.fillStyle = "#333";
  ctx.fillRect(x, y, width, height);

  // HP fill
  ctx.fillStyle = ratio > 0.5 ? "#2ecc71" : ratio > 0.25 ? "#f39c12" : "#e74c3c";
  ctx.fillRect(x, y, width * ratio, height);

  // Border
  ctx.strokeStyle = "#000";
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, width, height);
}

// ==================== STYLES ====================

const styles: Record<string, React.CSSProperties> = {
  gameContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    backgroundColor: "#1a1a2e",
    padding: "10px",
    boxSizing: "border-box",
  },
  loading: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontSize: "24px",
  },
  topBar: {
    width: CANVAS_WIDTH,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "10px 20px",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: "8px 8px 0 0",
  },
  goldDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#ffd700",
    fontSize: "24px",
    fontWeight: "bold",
  },
  goldIcon: {
    fontSize: "28px",
  },
  goldAmount: {
    minWidth: "60px",
  },
  ageIndicator: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    color: "#fff",
  },
  ageName: {
    fontSize: "20px",
    fontWeight: "bold",
  },
  ageNumber: {
    fontSize: "12px",
    color: "#888",
  },
  enemyInfo: {
    color: "#888",
    fontSize: "14px",
  },
  aiLabel: {
    color: "#e74c3c",
  },
  canvas: {
    border: "4px solid #333",
  },
  bottomBar: {
    width: CANVAS_WIDTH,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-end",
    gap: "30px",
    padding: "15px 20px",
    backgroundColor: "rgba(0,0,0,0.7)",
    borderRadius: "0 0 8px 8px",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
  },
  groupLabel: {
    color: "#888",
    fontSize: "12px",
    textTransform: "uppercase",
  },
  buttonRow: {
    display: "flex",
    gap: "8px",
  },
  unitButton: {
    width: "70px",
    height: "80px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    backgroundColor: "#16213e",
    border: "2px solid #555",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#fff",
    padding: "4px",
  },
  unitPreview: {
    width: "20px",
    height: "25px",
    borderRadius: "2px",
  },
  unitName: {
    fontSize: "10px",
    textAlign: "center",
  },
  unitCost: {
    fontSize: "11px",
    color: "#ffd700",
  },
  turretButton: {
    width: "70px",
    height: "80px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    backgroundColor: "#16213e",
    border: "2px solid #555",
    borderRadius: "8px",
    cursor: "pointer",
    color: "#fff",
    padding: "4px",
  },
  turretPreview: {
    width: 0,
    height: 0,
    borderLeft: "10px solid transparent",
    borderRight: "10px solid transparent",
    borderBottom: "20px solid #888",
  },
  evolveSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  evolveButton: {
    width: "120px",
    height: "90px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "4px",
    backgroundColor: "#2d1f4e",
    border: "2px solid #9b59b6",
    borderRadius: "12px",
    cursor: "pointer",
    color: "#fff",
    padding: "8px",
  },
  evolveLabel: {
    fontSize: "12px",
    fontWeight: "bold",
    color: "#9b59b6",
  },
  evolveAge: {
    fontSize: "14px",
    fontWeight: "bold",
  },
  xpBarContainer: {
    width: "100px",
    height: "6px",
    backgroundColor: "#333",
    borderRadius: "3px",
    overflow: "hidden",
  },
  xpBarFill: {
    height: "100%",
    backgroundColor: "#9b59b6",
    transition: "width 0.3s",
  },
  xpText: {
    fontSize: "10px",
    color: "#888",
  },
  evolveCost: {
    fontSize: "11px",
    color: "#ffd700",
  },
  maxAgeLabel: {
    fontSize: "14px",
    color: "#9b59b6",
    fontWeight: "bold",
  },
  slotOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    backgroundColor: "rgba(0,0,0,0.9)",
    padding: "20px 30px",
    borderRadius: "8px",
    textAlign: "center",
    color: "#fff",
  },
  cancelButton: {
    marginTop: "10px",
    padding: "8px 16px",
    backgroundColor: "#e74c3c",
    border: "none",
    borderRadius: "4px",
    color: "#fff",
    cursor: "pointer",
  },
};
