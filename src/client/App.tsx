import React, { useState, useCallback } from "react";
import { createClient } from "rivetkit/client";
import type { Registry } from "../actors/registry.js";
import Game from "./Game.js";
import type { JoinResult } from "../actors/types.js";

// In production, connect through our server which returns the Rivet Cloud endpoint
// In local dev, connect to the local engine on port 6420
const endpoint = import.meta.env.DEV
  ? "http://localhost:6420"
  : window.location.origin + "/api/rivet";

const client = createClient<Registry>({ endpoint });

type GameState = "menu" | "joining" | "playing" | "dead";

export default function App() {
  const [gameState, setGameState] = useState<GameState>("menu");
  const [playerName, setPlayerName] = useState("");
  const [matchInfo, setMatchInfo] = useState<JoinResult | null>(null);
  const [killerName, setKillerName] = useState<string | null>(null);

  const handleJoin = useCallback(async () => {
    if (!playerName.trim()) return;

    setGameState("joining");

    try {
      const matchmaker = client.matchmaker.getOrCreate(["main"]);
      const result = await matchmaker.findMatch(playerName.trim());
      setMatchInfo(result);
      setGameState("playing");
      setKillerName(null);
    } catch (error) {
      console.error("Failed to join:", error);
      setGameState("menu");
    }
  }, [playerName]);

  const handleDeath = useCallback((killer: string) => {
    setKillerName(killer);
    setGameState("dead");
    setMatchInfo(null);
  }, []);

  const handleRespawn = useCallback(() => {
    setGameState("menu");
  }, []);

  if (gameState === "menu" || gameState === "joining") {
    return (
      <div style={styles.menuContainer}>
        <h1 style={styles.title}>Agar Clone</h1>
        <div style={styles.inputContainer}>
          <input
            type="text"
            placeholder="Enter your name"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            style={styles.input}
            maxLength={16}
            disabled={gameState === "joining"}
          />
          <button
            onClick={handleJoin}
            style={styles.button}
            disabled={gameState === "joining" || !playerName.trim()}
          >
            {gameState === "joining" ? "Joining..." : "Play"}
          </button>
        </div>
        <div style={styles.instructions}>
          <p>Move your mouse to control your cell</p>
          <p>Eat food to grow bigger</p>
          <p>Eat smaller players to dominate!</p>
        </div>
      </div>
    );
  }

  if (gameState === "dead") {
    return (
      <div style={styles.menuContainer}>
        <h1 style={styles.deathTitle}>You were eaten!</h1>
        {killerName && <p style={styles.killerText}>Killed by: {killerName}</p>}
        <button onClick={handleRespawn} style={styles.button}>
          Play Again
        </button>
      </div>
    );
  }

  if (gameState === "playing" && matchInfo) {
    return (
      <Game
        client={client}
        matchId={matchInfo.matchId}
        playerId={matchInfo.playerId}
        playerName={playerName}
        onDeath={handleDeath}
      />
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  menuContainer: {
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
  },
  title: {
    fontSize: "64px",
    color: "#fff",
    textShadow: "0 0 20px rgba(52, 152, 219, 0.8)",
  },
  deathTitle: {
    fontSize: "48px",
    color: "#e74c3c",
    textShadow: "0 0 20px rgba(231, 76, 60, 0.8)",
  },
  killerText: {
    fontSize: "24px",
    color: "#fff",
  },
  inputContainer: {
    display: "flex",
    gap: "12px",
  },
  input: {
    padding: "16px 24px",
    fontSize: "18px",
    borderRadius: "8px",
    border: "2px solid #3498db",
    background: "#16213e",
    color: "#fff",
    outline: "none",
    width: "250px",
  },
  button: {
    padding: "16px 32px",
    fontSize: "18px",
    borderRadius: "8px",
    border: "none",
    background: "#3498db",
    color: "#fff",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "background 0.2s",
  },
  instructions: {
    color: "#888",
    textAlign: "center" as const,
    lineHeight: "1.8",
    marginTop: "20px",
  },
};
