import React, { useState, useCallback } from "react";
import { createClient } from "rivetkit/client";
import type { Registry } from "../actors/registry.js";
import Game from "./Game.js";
import { GameMode, Side, JoinResult } from "../actors/types.js";

// In production, connect through our server which returns the Rivet Cloud endpoint
// In local dev, connect to the local engine on port 6420
const endpoint = import.meta.env.DEV
  ? "http://localhost:6420"
  : window.location.origin + "/api/rivet";

const client = createClient<Registry>({ endpoint });

type AppState = "menu" | "modeSelect" | "pvpJoining" | "pvpWaiting" | "playing" | "gameOver";

export default function App() {
  const [appState, setAppState] = useState<AppState>("menu");
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [matchInfo, setMatchInfo] = useState<JoinResult | null>(null);
  const [gameResult, setGameResult] = useState<"win" | "lose" | null>(null);

  const handleStartPvE = useCallback(async () => {
    setGameMode(GameMode.PVE);
    setAppState("playing");

    try {
      const matchmaker = client.matchmaker.getOrCreate(["main"]);
      const result = await matchmaker.findMatch(GameMode.PVE);
      setMatchInfo(result);
    } catch (error) {
      console.error("Failed to start PvE game:", error);
      setAppState("modeSelect");
    }
  }, []);

  const handleStartPvP = useCallback(async () => {
    if (!playerName.trim()) return;

    setGameMode(GameMode.PVP);
    setAppState("pvpWaiting");

    try {
      const matchmaker = client.matchmaker.getOrCreate(["main"]);
      const result = await matchmaker.findMatch(GameMode.PVP);
      setMatchInfo(result);
      setAppState("playing");
    } catch (error) {
      console.error("Failed to join PvP:", error);
      setAppState("pvpJoining");
    }
  }, [playerName]);

  const handleGameOver = useCallback((winningSide: Side) => {
    const playerSide = matchInfo?.side;
    setGameResult(winningSide === playerSide ? "win" : "lose");
    setAppState("gameOver");
    setMatchInfo(null);
  }, [matchInfo]);

  const handlePlayAgain = useCallback(() => {
    setAppState("modeSelect");
    setGameResult(null);
  }, []);

  const handleMainMenu = useCallback(() => {
    setAppState("menu");
    setGameMode(null);
    setGameResult(null);
  }, []);

  // Main Menu
  if (appState === "menu") {
    return (
      <div style={styles.menuContainer}>
        <h1 style={styles.title}>Age of War</h1>
        <p style={styles.subtitle}>Battle through the ages!</p>
        <button
          onClick={() => setAppState("modeSelect")}
          style={styles.button}
        >
          Play
        </button>
        <div style={styles.instructions}>
          <p>Spawn units to attack the enemy base</p>
          <p>Build turrets to defend your base</p>
          <p>Evolve through 5 ages to unlock stronger units!</p>
        </div>
      </div>
    );
  }

  // Mode Selection
  if (appState === "modeSelect") {
    return (
      <div style={styles.menuContainer}>
        <h2 style={styles.title}>Select Game Mode</h2>
        <div style={styles.modeButtons}>
          <button onClick={handleStartPvE} style={styles.modeButton}>
            <span style={styles.modeIcon}>AI</span>
            <span style={styles.modeLabel}>Play vs AI</span>
            <span style={styles.modeDesc}>Single Player</span>
          </button>
          <button
            onClick={() => setAppState("pvpJoining")}
            style={styles.modeButton}
          >
            <span style={styles.modeIcon}>VS</span>
            <span style={styles.modeLabel}>Play vs Player</span>
            <span style={styles.modeDesc}>1v1 Multiplayer</span>
          </button>
        </div>
        <button onClick={handleMainMenu} style={styles.backButton}>
          Back
        </button>
      </div>
    );
  }

  // PvP Name Input
  if (appState === "pvpJoining") {
    return (
      <div style={styles.menuContainer}>
        <h2 style={styles.title}>Enter Your Name</h2>
        <div style={styles.inputContainer}>
          <input
            type="text"
            placeholder="Commander name..."
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleStartPvP()}
            style={styles.input}
            maxLength={16}
          />
        </div>
        <div style={styles.buttonRow}>
          <button onClick={() => setAppState("modeSelect")} style={styles.backButton}>
            Back
          </button>
          <button
            onClick={handleStartPvP}
            style={styles.button}
            disabled={!playerName.trim()}
          >
            Find Match
          </button>
        </div>
      </div>
    );
  }

  // PvP Waiting
  if (appState === "pvpWaiting") {
    return (
      <div style={styles.menuContainer}>
        <h2 style={styles.title}>Finding Opponent...</h2>
        <div style={styles.spinner} />
        <p style={styles.waitingText}>Waiting for another player to join</p>
        <button onClick={handleMainMenu} style={styles.backButton}>
          Cancel
        </button>
      </div>
    );
  }

  // Game Over
  if (appState === "gameOver") {
    return (
      <div style={styles.menuContainer}>
        <h1 style={gameResult === "win" ? styles.winTitle : styles.loseTitle}>
          {gameResult === "win" ? "Victory!" : "Defeat!"}
        </h1>
        <p style={styles.resultText}>
          {gameResult === "win"
            ? "You destroyed the enemy base!"
            : "Your base was destroyed!"}
        </p>
        <div style={styles.buttonRow}>
          <button onClick={handleMainMenu} style={styles.backButton}>
            Main Menu
          </button>
          <button onClick={handlePlayAgain} style={styles.button}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // Playing
  if (appState === "playing" && matchInfo) {
    return (
      <Game
        client={client}
        matchId={matchInfo.matchId}
        playerId={matchInfo.playerId}
        side={matchInfo.side}
        gameMode={matchInfo.gameMode}
        onGameOver={handleGameOver}
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
    backgroundColor: "#1a1a2e",
  },
  title: {
    fontSize: "56px",
    color: "#fff",
    textShadow: "0 0 20px rgba(52, 152, 219, 0.8)",
    margin: 0,
  },
  subtitle: {
    fontSize: "24px",
    color: "#888",
    margin: 0,
  },
  winTitle: {
    fontSize: "64px",
    color: "#2ecc71",
    textShadow: "0 0 30px rgba(46, 204, 113, 0.8)",
    margin: 0,
  },
  loseTitle: {
    fontSize: "64px",
    color: "#e74c3c",
    textShadow: "0 0 30px rgba(231, 76, 60, 0.8)",
    margin: 0,
  },
  resultText: {
    fontSize: "24px",
    color: "#fff",
    margin: 0,
  },
  modeButtons: {
    display: "flex",
    gap: "24px",
    marginTop: "20px",
  },
  modeButton: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "32px 48px",
    fontSize: "18px",
    borderRadius: "12px",
    border: "2px solid #3498db",
    background: "#16213e",
    color: "#fff",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  modeIcon: {
    fontSize: "36px",
    fontWeight: "bold",
    color: "#3498db",
  },
  modeLabel: {
    fontSize: "20px",
    fontWeight: "bold",
  },
  modeDesc: {
    fontSize: "14px",
    color: "#888",
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
    width: "300px",
  },
  buttonRow: {
    display: "flex",
    gap: "16px",
    marginTop: "16px",
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
  backButton: {
    padding: "16px 32px",
    fontSize: "18px",
    borderRadius: "8px",
    border: "2px solid #555",
    background: "transparent",
    color: "#888",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "all 0.2s",
  },
  instructions: {
    color: "#888",
    textAlign: "center" as const,
    lineHeight: "1.8",
    marginTop: "20px",
  },
  waitingText: {
    fontSize: "18px",
    color: "#888",
  },
  spinner: {
    width: "50px",
    height: "50px",
    border: "4px solid #333",
    borderTop: "4px solid #3498db",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
};

// Add keyframes for spinner animation
const styleSheet = document.createElement("style");
styleSheet.textContent = `
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;
document.head.appendChild(styleSheet);
