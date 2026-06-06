// Age of War - Matchmaker Actor
// Handles player assignment to matches for PvP and PvE modes

import { actor } from "rivetkit";
import { GameMode, Side, JoinResult } from "./types.js";

export interface WaitingMatch {
  matchId: string;
  leftPlayerId: string;
  createdAt: number;
}

export interface MatchmakerState {
  // For PvP: matches waiting for a second player
  waitingMatches: Record<string, WaitingMatch>;
  // Active match count for stats
  activeMatches: number;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const matchmaker = actor({
  state: {
    waitingMatches: {} as Record<string, WaitingMatch>,
    activeMatches: 0,
  } satisfies MatchmakerState,

  actions: {
    findMatch: (c, gameMode: GameMode): JoinResult => {
      if (gameMode === GameMode.PVE) {
        // PvE: Create new match immediately with AI opponent
        const matchId = generateId();
        const playerId = generateId();
        c.state.activeMatches++;

        return {
          matchId,
          playerId,
          side: Side.LEFT,
          gameMode: GameMode.PVE,
        };
      }

      // PvP: Look for waiting match or create new one
      const waitingMatchIds = Object.keys(c.state.waitingMatches);

      if (waitingMatchIds.length > 0) {
        // Join existing waiting match as right player
        const matchId = waitingMatchIds[0];
        const playerId = generateId();

        // Remove from waiting
        delete c.state.waitingMatches[matchId];

        return {
          matchId,
          playerId,
          side: Side.RIGHT,
          gameMode: GameMode.PVP,
        };
      }

      // Create new waiting match as left player
      const matchId = generateId();
      const playerId = generateId();

      c.state.waitingMatches[matchId] = {
        matchId,
        leftPlayerId: playerId,
        createdAt: Date.now(),
      };

      c.state.activeMatches++;

      return {
        matchId,
        playerId,
        side: Side.LEFT,
        gameMode: GameMode.PVP,
      };
    },

    cancelWaiting: (c, matchId: string) => {
      if (c.state.waitingMatches[matchId]) {
        delete c.state.waitingMatches[matchId];
        c.state.activeMatches = Math.max(0, c.state.activeMatches - 1);
      }
    },

    matchEnded: (c) => {
      c.state.activeMatches = Math.max(0, c.state.activeMatches - 1);
    },

    getStats: (c) => {
      return {
        waitingCount: Object.keys(c.state.waitingMatches).length,
        activeMatches: c.state.activeMatches,
      };
    },
  },
});
