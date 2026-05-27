# Deployment Issues & Learnings

This document catalogs all issues encountered during deployment to Rivet Cloud, intended to improve RivetKit skills and fix Rivet platform issues.

## Summary

- **Project**: Agar.io clone using RivetKit actors
- **Deployment Target**: Rivet Cloud via GitHub Actions
- **Total Deployment Attempts**: 5+ (ongoing)
- **Current Status**: Build passes, Docker push fails due to registry issues

---

## Issue 1: TypeScript Declaration File Errors

### Symptom
```
src/actors/match.ts(72,14): error TS2742: The inferred type of 'match' cannot be named without a reference to '../../node_modules/rivetkit/dist/tsup/config-CxjGYf4K.js'. This is likely not portable.
src/actors/match.ts(72,14): error TS4023: Exported variable 'match' has or is using name 'EventTypeToken' from external module...
```

### Root Cause
TypeScript couldn't generate declaration files for exported actors because the inferred types referenced internal RivetKit types that weren't exported.

### Solution
Set `"declaration": false` in `tsconfig.json` since this is an application, not a library.

### Suggestion for RivetKit
- Export all necessary types from the main `rivetkit` package so that consuming projects can generate declaration files if needed
- Or document that `declaration: false` should be set in tsconfig.json

---

## Issue 2: import.meta.env TypeScript Errors

### Symptom
```
src/client/App.tsx: Property 'env' does not exist on type 'ImportMeta'
```

### Root Cause
Missing Vite client type definitions.

### Solution
Create `src/vite-env.d.ts` with:
```typescript
/// <reference types="vite/client" />
```

### Suggestion for Skill Files
- The skill template should include `src/vite-env.d.ts` automatically when Vite is used
- Or include this in the setup instructions

---

## Issue 3: useEvent Callback Type Mismatch

### Symptom
```
error TS2769: No overload matches this call.
  Overload 1 of 2, '(eventName: "snapshot", callback: (args_0: unknown) => void): () => void', gave the following error.
    Argument of type '(data: GameSnapshot) => void' is not assignable to parameter of type '(args_0: unknown) => void'.
```

### Root Cause
The `useEvent` hook from `@rivetkit/react` types the callback parameter as `unknown`, making it incompatible with typed callback parameters.

### Solution
Accept `unknown` and cast inside the callback:
```typescript
// Instead of:
actor.useEvent("snapshot", (data: GameSnapshot) => { ... });

// Use:
actor.useEvent("snapshot", (data) => {
  setSnapshot(data as GameSnapshot);
});
```

### Suggestion for RivetKit
- The `useEvent` hook should properly infer the event data type from the actor definition
- Since events are defined with `event<T>()`, the callback should receive `T`, not `unknown`
- This would provide better type safety and developer experience

---

## Issue 4: Missing @types/node

### Symptom
```
src/server.ts: Cannot find name 'process'
```

### Root Cause
`@types/node` was not installed as a dev dependency.

### Solution
```bash
npm install --save-dev @types/node
```

### Suggestion for Skill Files
- Include `@types/node` in the default dependencies for Node.js/server projects
- Or mention this requirement in the setup documentation

---

## Issue 5: Rivet Registry 503 Service Unavailable

### Symptom
```
d19cce31d7f2: Retrying in 5 seconds
d19cce31d7f2: Retrying in 4 seconds
...
received unexpected HTTP status: 503 Service Unavailable
```

### Root Cause
The Rivet Docker registry (`registry.rivet.dev`) is returning 503 errors during image push.

### Impact
- Build completes successfully
- Docker image builds successfully
- Push fails after multiple retries
- Deployment cannot complete

### Status
**ONGOING** - This is an infrastructure issue on Rivet's end.

### Suggestion for Rivet Platform
- Investigate registry availability/scaling
- Add better error messages when registry is unavailable
- Consider retry logic with exponential backoff at the action level
- Provide status page or health endpoint for registry

---

## Issue 6: Exported Actor Types (Confusing)

### Context
When exporting actors, internal interfaces used in the actor definition weren't automatically exported, causing TypeScript errors.

### Example
```typescript
// This causes issues because State and ConnState aren't exported:
interface State { ... }
interface ConnState { ... }

export const match = actor({
  state: { ... } satisfies State,
  createConnState: (_c, params): ConnState => { ... },
  ...
});
```

### What I Did
Exported the internal types:
```typescript
export interface MatchState { ... }
export interface MatchConnState { ... }
```

### Confusion
- It's unclear whether these types need to be exported or if there's a better pattern
- The actor function doesn't seem to capture/export these types automatically
- Documentation on the recommended pattern for organizing actor types would help

---

## Issue 7: Actor Event Type Inference (Confusing)

### Context
Events are defined with typed schemas:
```typescript
events: {
  snapshot: event<GameSnapshot>(),
  playerDied: event<{ playerId: string; killerName: string }>(),
}
```

### Confusion
- Why doesn't `useEvent("snapshot", callback)` infer the callback parameter as `GameSnapshot`?
- The event definition includes the type, so the hook should be able to use it
- Currently forces developers to cast `unknown` which defeats the purpose of defining event types

---

## General Suggestions for Improvement

### Skill File Template Improvements
1. Include `src/vite-env.d.ts` for Vite projects
2. Set `"declaration": false` in default tsconfig.json
3. Include `@types/node` in server project dependencies
4. Add example of properly typed event handlers

### RivetKit Type Improvements
1. Export internal types needed for declaration file generation
2. Improve `useEvent` to infer callback types from actor event definitions
3. Better type inference for actors that use generic patterns

### Documentation Improvements
1. Document recommended tsconfig.json settings
2. Document how to type event handlers
3. Add troubleshooting section for common TypeScript issues
4. Document the expected actor type export pattern

### Rivet Platform Improvements
1. Investigate registry 503 errors
2. Add status/health endpoints
3. Better error messages in GitHub Action when registry is unavailable

---

## Timeline of Issues

| Time | Issue | Resolution |
|------|-------|------------|
| ~22:14 | Initial build fails - multiple TS errors | - |
| ~22:17 | Fixed vite-env.d.ts, exported types, disabled declarations | Build still fails |
| ~22:17 | Fixed event handler types (wrong approach) | Still fails - type mismatch |
| ~22:20 | Fixed with proper casting of unknown | Build passes |
| ~22:24 | Registry 503 during push | Rerun attempted |
| ~22:28 | Registry 503 again | Ongoing |
| ~22:33 | Registry 503 again | Ongoing |

---

## Build Command Output (When Successful)

```
> agar-clone@1.0.0 build
> tsc && vite build

vite v6.4.2 building for production...
transforming...
✓ 171 modules transformed.
rendering chunks...
computing gzip size...
dist/client/index.html                  0.66 kB │ gzip:   0.41 kB
dist/client/assets/index-YzJuM0Ek.js  575.21 kB │ gzip: 156.27 kB
✓ built in 908ms
```

---

## Earlier Local Development Issues (Pre-Deployment)

### Issue 8: Actor Lifecycle API Confusion

#### Symptom
Initial code used `onStart` and `runs` which are not recognized by RivetKit.

#### Root Cause
Confusion about the correct actor lifecycle hooks.

#### Solution
Use `onCreate` and `run` (async function with while loop):
```typescript
// Correct pattern:
onCreate: (c) => { ... },
run: async (c) => {
  while (!c.aborted) {
    // tick logic
    await sleep(...);
  }
}
```

### Issue 9: Registry Setup API Confusion

#### Symptom
```typescript
setup({ actors: { match, matchmaker } })  // Wrong
```

#### Root Cause
Incorrect setup API usage.

#### Solution
```typescript
setup({ use: { match, matchmaker } })  // Correct
```

### Issue 10: Client Endpoint Configuration

#### Symptom
Using relative path `/api/rivet` resulted in invalid URL errors.

#### Solution
Must use full URL:
```typescript
const endpoint = import.meta.env.DEV
  ? "http://localhost:6420"
  : window.location.origin + "/api/rivet";
```

### Issue 11: Local Engine Not Running

#### Symptom
Engine not available on port 6420 when using `registry.start()`.

#### Solution
Set environment variable:
```typescript
process.env.RIVET_RUN_ENGINE = "1";
```

### Issue 12: "No runner config" Error

#### Symptom
```
Error: no runner config with name 'default'
```

#### Root Cause
Local engine requires runner configuration before actors can be spawned.

#### Solution
Had to manually configure runner via API:
```bash
curl -X PUT "http://localhost:6420/runner-configs/default?namespace=default" \
  -H "Content-Type: application/json" \
  -d '{"datacenters":{"default":{"serverless":{"url":"http://localhost:3000/api/rivet","slots_per_runner":100,"max_runners":10,"request_lifespan":3600}}}}'
```

#### Suggestion for RivetKit
- Auto-configure the default runner in local dev mode
- Or document this step clearly in the getting started guide
- The local dev experience should be zero-config

### Issue 13: Actors Stuck with "no_envoys" Error

#### Symptom
Actors got stuck and couldn't be spawned, showing "no_envoys" errors.

#### Root Cause
Misconfigured runner or stale actor state.

#### Solution
- Delete the stuck actor
- Reconfigure the runner
- Restart the local server

---

*Generated during deployment troubleshooting on 2026-05-27*
