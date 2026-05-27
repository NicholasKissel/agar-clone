// Game configuration
export const CAPACITY = 32; // Max players per match
export const WORLD_SIZE = 2000; // World dimensions
export const TICK_MS = 50; // 20 ticks per second

// Player settings
export const PLAYER_START_RADIUS = 20;
export const PLAYER_MAX_RADIUS = 200;
export const PLAYER_MIN_SPEED = 2;
export const PLAYER_MAX_SPEED = 8;

// Food settings
export const FOOD_COUNT = 200;
export const FOOD_RADIUS = 5;
export const FOOD_VALUE = 2; // Radius increase when eaten

// Eating mechanics
export const EAT_RATIO = 1.2; // Must be 20% bigger to eat another player

// Grace period for reconnection
export const DISCONNECT_GRACE_MS = 5000;

// Leaderboard
export const LEADERBOARD_SIZE = 10;
