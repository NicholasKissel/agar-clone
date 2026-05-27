import { actor, event } from "rivetkit";
import {
  CAPACITY,
  WORLD_SIZE,
  TICK_MS,
  PLAYER_START_RADIUS,
  PLAYER_MAX_RADIUS,
  PLAYER_MIN_SPEED,
  PLAYER_MAX_SPEED,
  FOOD_COUNT,
  FOOD_RADIUS,
  FOOD_VALUE,
  EAT_RATIO,
  DISCONNECT_GRACE_MS,
  LEADERBOARD_SIZE,
} from "./config.js";
import type { Player, Food, GameSnapshot, LeaderboardEntry } from "./types.js";

interface PlayerState extends Player {
  connId: string;
  inputX: number;
  inputY: number;
  disconnectedAt: number | null;
}

interface State {
  matchId: string;
  tick: number;
  players: Record<string, PlayerState>;
  food: Record<string, Food>;
}

interface ConnState {
  playerId: string;
  name: string;
}

const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e91e63", "#00bcd4", "#ff5722", "#607d8b",
];

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function randomPosition(): { x: number; y: number } {
  const margin = 100;
  return {
    x: margin + Math.random() * (WORLD_SIZE - margin * 2),
    y: margin + Math.random() * (WORLD_SIZE - margin * 2),
  };
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function getSpeed(radius: number): number {
  const ratio = (radius - PLAYER_START_RADIUS) / (PLAYER_MAX_RADIUS - PLAYER_START_RADIUS);
  return PLAYER_MAX_SPEED - ratio * (PLAYER_MAX_SPEED - PLAYER_MIN_SPEED);
}

function radiusToScore(radius: number): number {
  return Math.floor(Math.PI * radius * radius / 100);
}

export const match = actor({
  state: {
    matchId: "",
    tick: 0,
    players: {} as Record<string, PlayerState>,
    food: {} as Record<string, Food>,
  } satisfies State,

  events: {
    snapshot: event<GameSnapshot>(),
    playerDied: event<{ playerId: string; killerName: string }>(),
  },

  createConnState: (_c, params: { playerId: string; name: string }): ConnState => ({
    playerId: params.playerId,
    name: params.name,
  }),

  onCreate: (c) => {
    c.state.matchId = generateId();

    // Spawn initial food
    for (let i = 0; i < FOOD_COUNT; i++) {
      const id = generateId();
      const pos = randomPosition();
      c.state.food[id] = {
        id,
        x: pos.x,
        y: pos.y,
        color: randomColor(),
      };
    }
  },

  onConnect: (c, conn) => {
    const { playerId, name } = conn.state;
    const existing = c.state.players[playerId];

    if (existing) {
      // Reconnecting player
      existing.connId = conn.id;
      existing.disconnectedAt = null;
    } else {
      // New player
      const activeCount = Object.values(c.state.players).filter(
        (p) => p.disconnectedAt === null
      ).length;

      if (activeCount >= CAPACITY) {
        throw new Error("Match is full");
      }

      const pos = randomPosition();
      c.state.players[playerId] = {
        id: playerId,
        name: name || "Anonymous",
        connId: conn.id,
        x: pos.x,
        y: pos.y,
        radius: PLAYER_START_RADIUS,
        color: randomColor(),
        score: radiusToScore(PLAYER_START_RADIUS),
        inputX: 0,
        inputY: 0,
        disconnectedAt: null,
      };
    }
  },

  onDisconnect: (c, conn) => {
    const player = c.state.players[conn.state.playerId];
    if (player) {
      player.disconnectedAt = Date.now();
    }
  },

  // Game tick loop
  run: async (c) => {
    while (!c.aborted) {
      c.state.tick++;
      const now = Date.now();

      // Update player positions and check collisions
      const playersToRemove: string[] = [];
      const eatenPlayers: string[] = [];

      for (const player of Object.values(c.state.players)) {
        // Remove disconnected players past grace period
        if (player.disconnectedAt !== null) {
          if (now - player.disconnectedAt > DISCONNECT_GRACE_MS) {
            playersToRemove.push(player.id);
          }
          continue;
        }

        // Update position based on input
        const speed = getSpeed(player.radius);
        player.x += player.inputX * speed;
        player.y += player.inputY * speed;

        // Clamp to world bounds
        player.x = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(WORLD_SIZE - player.radius, player.y));

        // Check food collision
        for (const food of Object.values(c.state.food)) {
          if (distance(player, food) < player.radius) {
            // Eat food
            player.radius = Math.min(PLAYER_MAX_RADIUS, player.radius + FOOD_VALUE);
            player.score = radiusToScore(player.radius);
            delete c.state.food[food.id];

            // Respawn food
            const newId = generateId();
            const pos = randomPosition();
            c.state.food[newId] = {
              id: newId,
              x: pos.x,
              y: pos.y,
              color: randomColor(),
            };
          }
        }
      }

      // Check player-player collisions (bigger eats smaller)
      const activePlayers = Object.values(c.state.players).filter(
        (p) => p.disconnectedAt === null && !eatenPlayers.includes(p.id)
      );

      for (let i = 0; i < activePlayers.length; i++) {
        for (let j = i + 1; j < activePlayers.length; j++) {
          const p1 = activePlayers[i];
          const p2 = activePlayers[j];

          if (eatenPlayers.includes(p1.id) || eatenPlayers.includes(p2.id)) {
            continue;
          }

          const dist = distance(p1, p2);

          // Check if one can eat the other
          if (p1.radius > p2.radius * EAT_RATIO && dist < p1.radius) {
            // p1 eats p2
            p1.radius = Math.min(PLAYER_MAX_RADIUS, p1.radius + p2.radius * 0.5);
            p1.score = radiusToScore(p1.radius);
            eatenPlayers.push(p2.id);
            c.broadcast("playerDied", { playerId: p2.id, killerName: p1.name });
          } else if (p2.radius > p1.radius * EAT_RATIO && dist < p2.radius) {
            // p2 eats p1
            p2.radius = Math.min(PLAYER_MAX_RADIUS, p2.radius + p1.radius * 0.5);
            p2.score = radiusToScore(p2.radius);
            eatenPlayers.push(p1.id);
            c.broadcast("playerDied", { playerId: p1.id, killerName: p2.name });
          }
        }
      }

      // Remove eaten and disconnected players
      for (const id of [...playersToRemove, ...eatenPlayers]) {
        delete c.state.players[id];
      }

      // Broadcast snapshot to all connected clients
      c.broadcast("snapshot", buildSnapshot(c.state));

      // Wait for next tick
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(resolve, TICK_MS);
        c.abortSignal.addEventListener("abort", () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
      });
    }
  },

  actions: {
    setInput: (c, inputX: number, inputY: number) => {
      const player = c.state.players[c.conn?.state.playerId ?? ""];
      if (player) {
        // Normalize input to -1 to 1
        player.inputX = Math.max(-1, Math.min(1, inputX));
        player.inputY = Math.max(-1, Math.min(1, inputY));
      }
    },

    getSnapshot: (c): GameSnapshot => {
      return buildSnapshot(c.state);
    },
  },
});

function buildSnapshot(state: State): GameSnapshot {
  const activePlayers = Object.values(state.players)
    .filter((p) => p.disconnectedAt === null)
    .map((p) => ({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      radius: p.radius,
      color: p.color,
      score: p.score,
    }));

  const leaderboard: LeaderboardEntry[] = activePlayers
    .sort((a, b) => b.score - a.score)
    .slice(0, LEADERBOARD_SIZE)
    .map((p) => ({ id: p.id, name: p.name, score: p.score }));

  return {
    tick: state.tick,
    players: activePlayers,
    food: Object.values(state.food),
    leaderboard,
    worldSize: WORLD_SIZE,
  };
}
