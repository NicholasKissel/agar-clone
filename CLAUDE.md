# AI Agent Instructions

## RivetKit Reference

For working with RivetKit and Rivet Actors in this project, reference:
- **LLM-optimized docs**: https://rivet.dev/llms.txt
- **Full documentation**: https://rivet.dev/docs/actors
- **Troubleshooting**: https://rivet.dev/docs/actors/troubleshooting

## Project Overview

This is an Agar.io-style multiplayer game built with RivetKit actors.

### Features
- Real-time multiplayer gameplay (up to 32 players)
- Food collection and player growth mechanics
- Player-eating mechanics (bigger eats smaller)
- Leaderboard showing top 10 players
- Minimap for world navigation
- Reconnection grace period (5 seconds)

## Project Structure

```
src/
  actors/
    config.ts      # Game constants (world size, speeds, etc.)
    types.ts       # Shared TypeScript interfaces
    match.ts       # Match actor - game state and tick loop
    matchmaker.ts  # Matchmaker actor - player assignment
    registry.ts    # Actor registry setup
  server.ts        # Hono HTTP server with RivetKit handler
  client/
    main.tsx       # React entry point
    App.tsx        # Main app component with game states
    Game.tsx       # Canvas rendering, input, leaderboard, minimap
```

## Development

```bash
npm run dev      # Start both server and client
npm run dev:server  # Start only the backend (port 3000)
npm run dev:client  # Start only Vite frontend (port 5173)
```

## Key Actors

### match
- Manages game state (players, food, tick count)
- Runs game loop at 20 ticks/second
- Handles player connections/disconnections
- Broadcasts game snapshots to all clients
- Actions: `setInput`, `getSnapshot`
- Events: `snapshot`, `playerDied`

### matchmaker
- Finds available matches or creates new ones
- Assigns players to matches
- Tracks player counts per match
- Actions: `findMatch`, `updatePlayerCount`, `getMatches`

## Game Mechanics

- **World**: 2000x2000 pixels
- **Players**: Start at radius 20, max 200
- **Speed**: Larger players move slower (8 -> 2 units)
- **Eating**: Must be 20% larger to eat another player
- **Food**: 200 pieces, respawn when eaten, +2 radius each
