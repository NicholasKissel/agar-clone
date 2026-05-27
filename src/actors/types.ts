// Shared types for actors and client

export interface Player {
  id: string;
  name: string;
  x: number;
  y: number;
  radius: number;
  color: string;
  score: number;
}

export interface Food {
  id: string;
  x: number;
  y: number;
  color: string;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
}

export interface GameSnapshot {
  tick: number;
  players: Player[];
  food: Food[];
  leaderboard: LeaderboardEntry[];
  worldSize: number;
}

export interface JoinResult {
  matchId: string;
  playerId: string;
}
