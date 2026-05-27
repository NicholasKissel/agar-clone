import { actor } from "rivetkit";
import { CAPACITY } from "./config.js";
import type { JoinResult } from "./types.js";

export interface MatchInfo {
  matchId: string;
  playerCount: number;
  createdAt: number;
}

export interface MatchmakerState {
  matches: Record<string, MatchInfo>;
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export const matchmaker = actor({
  state: {
    matches: {} as Record<string, MatchInfo>,
  } satisfies MatchmakerState,

  actions: {
    findMatch: (c, name: string): JoinResult => {
      // Find an available match with space
      let targetMatch: MatchInfo | null = null;

      for (const match of Object.values(c.state.matches)) {
        if (match.playerCount < CAPACITY) {
          if (!targetMatch || match.playerCount > targetMatch.playerCount) {
            // Prefer matches with more players (more fun!)
            targetMatch = match;
          }
        }
      }

      // Create new match if none available
      if (!targetMatch) {
        const matchId = generateId();
        targetMatch = {
          matchId,
          playerCount: 0,
          createdAt: Date.now(),
        };
        c.state.matches[matchId] = targetMatch;
      }

      // Assign player to match
      const playerId = generateId();
      targetMatch.playerCount++;

      return {
        matchId: targetMatch.matchId,
        playerId,
      };
    },

    updatePlayerCount: (c, matchId: string, delta: number) => {
      const match = c.state.matches[matchId];
      if (match) {
        match.playerCount = Math.max(0, match.playerCount + delta);

        // Remove empty matches after a delay
        if (match.playerCount === 0) {
          delete c.state.matches[matchId];
        }
      }
    },

    getMatches: (c): MatchInfo[] => {
      return Object.values(c.state.matches);
    },
  },
});
