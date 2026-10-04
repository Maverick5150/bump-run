# Testing

```bash
pnpm test
```

runs both suites below. Total: **86 automated tests**, all passing.

## Game engine (`packages/game-engine`, 69 tests)

```bash
pnpm --filter ./packages/game-engine run test
```

Organized by rule area: `start`, `movement`, `cards` (2/7/10/11/12), `bump-card`,
`boost-lanes`, `protected-lane`, `turn-system`, `deck`, `validation`, and
`simulation`.

**`simulation.test.ts`** is the end-to-end check: for each of 10 seeds, it creates
a 4-player game, repeatedly draws a card and applies a (seeded-)random legal move
(always including `pass` as a fallback) up to a 20,000-turn safety limit, and after
every single move asserts:

- no two pawns belonging to the same player ever share a main-track or safety-lane
  square,
- no two pawns belonging to different players ever share a main-track square,
- a winner is reached before the turn limit (no deadlocks).

This simulation test is what caught three real bugs during development: boost
lanes not checking their own *landing* square for a collision, Home being treated
as a single stackable square (blocking the 4th pawn from ever finishing once
another pawn had already finished), and backward movement inside a safety lane
never checking for the player's own other pawn already occupying the target slot.
All three are now covered by dedicated regression tests in addition to the
simulation catching them generically.

Determinism: `createGame(players, seed)` accepts a string or numeric seed: the
same seed always produces the same shuffle and the same sequence of draws, which
is how `simulation.test.ts` and `deck.test.ts` get reproducible test runs.

## Server (`apps/server`, 17 tests)

```bash
pnpm --filter ./apps/server run test
```

These spin up a *real* `http.Server` + Socket.IO server on an ephemeral port and
connect real `socket.io-client` sockets to it (`test/testHarness.ts`) -- no
mocking of the network layer. Covered:

- room creation, joining, rejecting a join to a nonexistent room,
- the full lobby -> ready -> start -> draw -> move flow,
- **private-state isolation**: only the active player's socket ever receives
  `game:privateState`,
- rejecting a draw from whoever isn't the current player (`NOT_YOUR_TURN`),
- rejecting a second draw before the first card resolves (`CARD_ALREADY_ACTIVE`),
- rejecting a move outside the current legal-move set (`ILLEGAL_MOVE`),
- reconnect restoring the same `playerId` via a valid token, and rejecting an
  unknown token,
- a regression test for a disconnect race: an old socket's belated `disconnect`
  must not clobber a newer reconnect's `socketId`,
- TV host reattachment to its own room via `hostToken`.

Also: `sanitize-nickname.test.ts` covers markup stripping, control-character
stripping, whitespace collapsing, length clipping, and blank-input rejection.

## What's not automated yet

- The controller's React components have no dedicated unit/component tests
  (the logic they render is server-driven and thin; manual end-to-end testing
  through a real browser covered the join -> lobby -> draw -> move -> reconnect
  flow during development). See `ROADMAP.md`.
- The Android TV app has no instrumented/UI tests. It was verified by building
  and installing the actual debug APK.

## Manual multiplayer test harness

For development, you don't need 3+ physical devices: open multiple browser tabs
(or windows) to `http://<server>/join/<code>` -- each gets its own
`localStorage`-backed identity as long as they're genuinely separate browser
*profiles* (tabs in the *same* profile share `localStorage`, so they'll fight
over which player they are -- use separate browser windows/profiles, or a private
window, to simulate more than one "phone" from one machine). Run a second
lightweight script (or just the TV app itself) to act as the host and call
`game:start` once enough players are ready.
