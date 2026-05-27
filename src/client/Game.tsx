import React, { useEffect, useRef, useState, useCallback } from "react";
import { createRivetKit } from "@rivetkit/react";
import type { Registry } from "../actors/registry.js";
import type { GameSnapshot, Player, LeaderboardEntry } from "../actors/types.js";

interface GameProps {
  client: ReturnType<typeof import("rivetkit/client").createClient<Registry>>;
  matchId: string;
  playerId: string;
  playerName: string;
  onDeath: (killerName: string) => void;
}

// In production, connect through our server which returns the Rivet Cloud endpoint
// In local dev, connect to the local engine on port 6420
const endpoint = import.meta.env.DEV
  ? "http://localhost:6420"
  : window.location.origin + "/api/rivet";

const { useActor } = createRivetKit<Registry>({ endpoint });

export default function Game({ client, matchId, playerId, playerName, onDeath }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const actor = useActor({
    name: "match",
    key: [matchId],
    params: { playerId, name: playerName },
  });

  // Handle snapshot events
  actor.useEvent("snapshot", (data: GameSnapshot) => {
    setSnapshot(data);
  });

  // Handle death events
  actor.useEvent("playerDied", (data: { playerId: string; killerName: string }) => {
    if (data.playerId === playerId) {
      onDeath(data.killerName);
    }
  });

  // Mouse movement handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Calculate direction from center to mouse
      const dx = e.clientX - rect.left - centerX;
      const dy = e.clientY - rect.top - centerY;

      // Normalize to -1 to 1
      const maxDistance = Math.min(rect.width, rect.height) / 3;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const factor = Math.min(1, distance / maxDistance);

      if (distance > 5) {
        mousePos.current = {
          x: (dx / distance) * factor,
          y: (dy / distance) * factor,
        };
      } else {
        mousePos.current = { x: 0, y: 0 };
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Send input to server
  useEffect(() => {
    const interval = setInterval(() => {
      if (actor.connection) {
        actor.connection.setInput(mousePos.current.x, mousePos.current.y);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [actor.connection]);

  // Render game
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Find current player
    const currentPlayer = snapshot.players.find((p) => p.id === playerId);
    if (!currentPlayer) return;

    // Calculate camera offset (center on player)
    const cameraX = currentPlayer.x - canvas.width / 2;
    const cameraY = currentPlayer.y - canvas.height / 2;

    // Clear canvas
    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = "#2d2d4a";
    ctx.lineWidth = 1;
    const gridSize = 50;
    const startX = -cameraX % gridSize;
    const startY = -cameraY % gridSize;

    for (let x = startX; x < canvas.width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = startY; y < canvas.height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw world boundary
    ctx.strokeStyle = "#e74c3c";
    ctx.lineWidth = 4;
    ctx.strokeRect(-cameraX, -cameraY, snapshot.worldSize, snapshot.worldSize);

    // Draw food
    for (const food of snapshot.food) {
      const screenX = food.x - cameraX;
      const screenY = food.y - cameraY;

      // Skip if off screen
      if (screenX < -20 || screenX > canvas.width + 20 ||
          screenY < -20 || screenY > canvas.height + 20) {
        continue;
      }

      ctx.beginPath();
      ctx.arc(screenX, screenY, 5, 0, Math.PI * 2);
      ctx.fillStyle = food.color;
      ctx.fill();
    }

    // Draw players (sorted by size, smallest first)
    const sortedPlayers = [...snapshot.players].sort((a, b) => a.radius - b.radius);

    for (const player of sortedPlayers) {
      const screenX = player.x - cameraX;
      const screenY = player.y - cameraY;

      // Skip if off screen
      if (screenX < -player.radius * 2 || screenX > canvas.width + player.radius * 2 ||
          screenY < -player.radius * 2 || screenY > canvas.height + player.radius * 2) {
        continue;
      }

      // Draw cell body
      ctx.beginPath();
      ctx.arc(screenX, screenY, player.radius, 0, Math.PI * 2);
      ctx.fillStyle = player.color;
      ctx.fill();

      // Draw cell border
      ctx.strokeStyle = darkenColor(player.color, 0.3);
      ctx.lineWidth = 3;
      ctx.stroke();

      // Draw name
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${Math.max(12, player.radius / 3)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(player.name, screenX, screenY);

      // Draw score below name
      ctx.font = `${Math.max(10, player.radius / 4)}px sans-serif`;
      ctx.fillText(String(player.score), screenX, screenY + player.radius / 3 + 5);
    }
  }, [snapshot, playerId]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const currentPlayer = snapshot?.players.find((p) => p.id === playerId);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />

      {/* Leaderboard */}
      {snapshot && (
        <div style={styles.leaderboard}>
          <h3 style={styles.leaderboardTitle}>Leaderboard</h3>
          {snapshot.leaderboard.map((entry, i) => (
            <div
              key={entry.id}
              style={{
                ...styles.leaderboardEntry,
                fontWeight: entry.id === playerId ? "bold" : "normal",
                color: entry.id === playerId ? "#3498db" : "#fff",
              }}
            >
              <span>{i + 1}. {entry.name}</span>
              <span>{entry.score}</span>
            </div>
          ))}
        </div>
      )}

      {/* Minimap */}
      {snapshot && currentPlayer && (
        <Minimap
          players={snapshot.players}
          currentPlayerId={playerId}
          worldSize={snapshot.worldSize}
        />
      )}

      {/* Score display */}
      {currentPlayer && (
        <div style={styles.scoreDisplay}>
          Score: {currentPlayer.score}
        </div>
      )}
    </div>
  );
}

function Minimap({
  players,
  currentPlayerId,
  worldSize,
}: {
  players: Player[];
  currentPlayerId: string;
  worldSize: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = 150;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = size;
    canvas.height = size;

    // Background
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, size, size);

    // Border
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, size, size);

    // Scale factor
    const scale = size / worldSize;

    // Draw players
    for (const player of players) {
      const x = player.x * scale;
      const y = player.y * scale;
      const r = Math.max(2, player.radius * scale);

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = player.id === currentPlayerId ? "#3498db" : player.color;
      ctx.fill();
    }
  }, [players, currentPlayerId, worldSize]);

  return (
    <canvas
      ref={canvasRef}
      style={styles.minimap}
    />
  );
}

function darkenColor(color: string, amount: number): string {
  const hex = color.replace("#", "");
  const r = Math.max(0, parseInt(hex.slice(0, 2), 16) * (1 - amount));
  const g = Math.max(0, parseInt(hex.slice(2, 4), 16) * (1 - amount));
  const b = Math.max(0, parseInt(hex.slice(4, 6), 16) * (1 - amount));
  return `rgb(${Math.floor(r)}, ${Math.floor(g)}, ${Math.floor(b)})`;
}

const styles: Record<string, React.CSSProperties> = {
  leaderboard: {
    position: "absolute",
    top: "20px",
    right: "20px",
    background: "rgba(0, 0, 0, 0.7)",
    padding: "16px",
    borderRadius: "8px",
    minWidth: "180px",
  },
  leaderboardTitle: {
    color: "#fff",
    margin: "0 0 12px 0",
    fontSize: "18px",
    borderBottom: "1px solid #444",
    paddingBottom: "8px",
  },
  leaderboardEntry: {
    display: "flex",
    justifyContent: "space-between",
    color: "#fff",
    fontSize: "14px",
    padding: "4px 0",
  },
  minimap: {
    position: "absolute",
    bottom: "20px",
    right: "20px",
    borderRadius: "4px",
  },
  scoreDisplay: {
    position: "absolute",
    top: "20px",
    left: "20px",
    background: "rgba(0, 0, 0, 0.7)",
    padding: "12px 20px",
    borderRadius: "8px",
    color: "#fff",
    fontSize: "24px",
    fontWeight: "bold",
  },
};
