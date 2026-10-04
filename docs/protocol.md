# Realtime protocol

Transport: Socket.IO over WebSocket (falls back to HTTP long-polling automatically).
Full TypeScript definitions: `packages/shared-types/src/socketProtocol.ts` and
`gameTypes.ts`. The Android TV app hand-mirrors the subset it needs in
`apps/tv/app/src/main/java/com/bumprun/tv/net/Protocol.kt` -- keep both in sync if
you change the wire shape.

Every client is either the **host** (the TV, exactly one per room, the only
socket allowed to call `game:start` / `game:playAgain`) or a **player** (a phone,
0-4 per room). A socket's role is established by whichever of `room:create` /
`room:join` / `room:reconnect` it calls first.

## Client -> Server events

| Event | Payload | Ack response | Who |
|---|---|---|---|
| `room:create` | `{ rejoinRoomId?, rejoinHostToken? }` | `{ ok, data: { roomCode, roomId, hostToken } }` | TV |
| `room:join` | `{ roomCode, nickname }` | `{ ok, data: { playerId, reconnectToken } }` \| `{ ok: false, error }` | phone |
| `room:reconnect` | `{ roomCode, reconnectToken }` | `{ ok, data: { playerId } }` \| `{ ok: false, error }` | phone |
| `player:setName` | `{ nickname }` | -- | phone |
| `player:selectColor` | `{ seat }` | -- | phone |
| `player:ready` | `{ ready }` | -- | phone |
| `game:start` | `{}` | -- | TV |
| `turn:draw` | `{}` | -- | active player's phone |
| `turn:chooseMove` | `{ move: MoveOption }` | -- | active player's phone |
| `game:playAgain` | `{}` | -- | TV |

`MoveOption` is a discriminated union (`kind: "forward" \| "backward" \|
"enterFromStart" \| "split" \| "swap" \| "bump" \| "pass"`, see `gameTypes.ts`) --
every split/swap/bump decision travels through the single `turn:chooseMove` event
as a fully-specified option taken from the `legalMoves` list the server already
sent; the phone UI just walks the player through picking one.

Events without an ack callback are fire-and-forget; the resulting state change
(if any) arrives via the broadcast events below. Illegal or malformed requests
produce a `room:error` instead of silently failing.

## Server -> Client events

| Event | Payload | Audience |
|---|---|---|
| `room:state` | `{ room: RoomSummary, players: [...] }` | everyone in the room |
| `room:error` | `{ code, message }` | the socket that caused it |
| `player:joined` / `player:left` / `player:reconnected` | `{ playerId, ... }` | everyone in the room |
| `game:started` | `{ state: PublicGameState }` | everyone in the room |
| `game:publicState` | `{ state: PublicGameState }` | everyone in the room |
| `game:privateState` | `{ legalMoves: MoveOption[] }` | **only** the current player's own socket |
| `turn:cardDrawn` | `{ seat, card }` | everyone in the room |
| `move:resolved` | `{ state: PublicGameState }` | everyone in the room |
| `player:bumped` | `{ seat, pawnId }` | everyone in the room |
| `boost:triggered` | `{ laneId, pawnId }` | everyone in the room |
| `game:won` | `{ seat }` | everyone in the room |

`PublicGameState` (see `gameTypes.ts`) is the full `GameState` minus the raw deck
array and RNG seed -- those are the only two fields that must never leave the
server, since either would let a client predict future draws.

## Error codes

`room:error.code` is one of: `ROOM_NOT_FOUND`, `ROOM_IN_PROGRESS`, `ROOM_FULL`,
`INVALID_NICKNAME`, `INVALID_TOKEN`, `COLOR_TAKEN`, `NO_COLOR`, `NOT_HOST`,
`NOT_ENOUGH_PLAYERS`, `NO_GAME`, `NOT_YOUR_TURN`, `CARD_ALREADY_ACTIVE`,
`ILLEGAL_MOVE`, `NOT_IN_ROOM`, `RATE_LIMITED`, `INTERNAL_ERROR`.

## Server authority

The server is the only source of truth for deck order, whose turn it is, pawn
positions, legal moves, and the winner. Every `turn:*` event is checked against
the room's actual current player (`RoomService.requireActiveTurnPlayer`) and
every submitted move is re-validated against a freshly computed legal-move set
(`validateMove`) before being applied -- a modified client can submit whatever it
wants and the worst case is a `room:error`.
