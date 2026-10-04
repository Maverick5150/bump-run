import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { RoomStatePayload } from "@bump-run/shared-types";
import { emitAck, startHarness, waitForConnect, waitForEvent, type Harness } from "./testHarness.js";

let harness: Harness;

beforeEach(async () => {
  harness = await startHarness();
});

afterEach(async () => {
  await harness.close();
});

interface StartedGame {
  host: ReturnType<Harness["connect"]>;
  players: { socket: ReturnType<Harness["connect"]>; playerId: string; reconnectToken: string; seat: string }[];
  roomCode: string;
}

async function setupStartedGame(): Promise<StartedGame> {
  const host = harness.connect();
  await waitForConnect(host);
  const created = await emitAck<{ roomCode: string; roomId: string }>(host, "room:create", {});
  const roomCode = created.data!.roomCode;

  const seats = ["red", "blue"] as const;
  const players: StartedGame["players"] = [];
  for (const seat of seats) {
    const socket = harness.connect();
    await waitForConnect(socket);
    const joined = await emitAck<{ playerId: string; reconnectToken: string }>(socket, "room:join", {
      roomCode,
      nickname: `Player-${seat}`,
    });
    socket.emit("player:selectColor", { seat });
    socket.emit("player:ready", { ready: true });
    players.push({ socket, playerId: joined.data!.playerId, reconnectToken: joined.data!.reconnectToken, seat });
  }

  // give the server a tick to process the fire-and-forget lobby events
  await new Promise((r) => setTimeout(r, 50));

  const startedPromise = waitForEvent(host, "game:started");
  host.emit("game:start", {});
  await startedPromise;

  return { host, players, roomCode };
}

describe("room lifecycle", () => {
  it("creates a room and returns a usable room code", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    const res = await emitAck<{ roomCode: string; roomId: string }>(host, "room:create", {});
    expect(res.ok).toBe(true);
    expect(res.data!.roomCode).toMatch(/^[A-Z2-9]{4}$/);
  });

  it("rejects joining a room that does not exist", async () => {
    const socket = harness.connect();
    await waitForConnect(socket);
    const res = await emitAck(socket, "room:join", { roomCode: "ZZZZ", nickname: "Nobody" });
    expect(res.ok).toBe(false);
  });

  it("lets two players join and shows them in room:state", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    const created = await emitAck<{ roomCode: string }>(host, "room:create", {});
    const roomCode = created.data!.roomCode;

    const statePromise = waitForEvent<RoomStatePayload>(host, "room:state");
    const p1 = harness.connect();
    await waitForConnect(p1);
    await emitAck(p1, "room:join", { roomCode, nickname: "Ricky" });
    const state = await statePromise;
    expect(state.players.some((p) => p.nickname === "Ricky")).toBe(true);
  });
});

describe("turn-based play and server authority", () => {
  it("only sends legal moves privately to the player whose turn it is", async () => {
    const { players } = await setupStartedGame();
    const [a, b] = players;

    const aPrivate = waitForEvent(a!.socket, "game:privateState");
    let bGotPrivate = false;
    b!.socket.once("game:privateState", () => {
      bGotPrivate = true;
    });

    // whichever seat is actually "current" draws; figure out which socket that is
    // by racing a draw from both -- only the current player's draw should succeed.
    a!.socket.emit("turn:draw", {});
    b!.socket.emit("turn:draw", {});

    await Promise.race([aPrivate, new Promise((r) => setTimeout(r, 300))]);
    await new Promise((r) => setTimeout(r, 100));
    expect(bGotPrivate).toBe(false);
  });

  it("rejects a draw request from the player who is not currently active", async () => {
    const { players } = await setupStartedGame();
    // red always goes first (createGame seat order), so blue (players[1]) is not active
    const notActive = players[1]!.socket;
    const errorPromise = waitForEvent<{ code: string }>(notActive, "room:error");
    notActive.emit("turn:draw", {});
    const err = await errorPromise;
    expect(err.code).toBe("NOT_YOUR_TURN");
  });

  it("rejects a second draw before the first card is resolved", async () => {
    const { players } = await setupStartedGame();
    const active = players[0]!.socket; // red
    active.emit("turn:draw", {});
    await waitForEvent(active, "game:privateState");
    const errorPromise = waitForEvent<{ code: string }>(active, "room:error");
    active.emit("turn:draw", {});
    const err = await errorPromise;
    expect(err.code).toBe("CARD_ALREADY_ACTIVE");
  });

  it("rejects a move that is not in the legal move set", async () => {
    const { players } = await setupStartedGame();
    const active = players[0]!.socket;
    active.emit("turn:draw", {});
    await waitForEvent(active, "game:privateState");
    const errorPromise = waitForEvent<{ code: string }>(active, "room:error");
    active.emit("turn:chooseMove", { move: { kind: "forward", pawnId: "red-0", distance: 999 } });
    const err = await errorPromise;
    expect(err.code).toBe("ILLEGAL_MOVE");
  });
});

describe("reconnect", () => {
  it("restores the same player identity after a disconnect using the reconnect token", async () => {
    const { roomCode, players } = await setupStartedGame();
    const player = players[0]!;
    player.socket.close();
    await new Promise((r) => setTimeout(r, 50));

    const fresh = harness.connect();
    await waitForConnect(fresh);
    const res = await emitAck<{ playerId: string }>(fresh, "room:reconnect", {
      roomCode,
      reconnectToken: player.reconnectToken,
    });
    expect(res.ok).toBe(true);
    expect(res.data!.playerId).toBe(player.playerId);
  });

  it("rejects reconnecting with an unknown token", async () => {
    const { roomCode } = await setupStartedGame();
    const fresh = harness.connect();
    await waitForConnect(fresh);
    const res = await emitAck(fresh, "room:reconnect", { roomCode, reconnectToken: "not-a-real-token-at-all" });
    expect(res.ok).toBe(false);
  });

  it("does not let a stale socket's disconnect clobber a newer reconnect's socketId", async () => {
    // Regression test: if socket A (player X) reconnects as socket B, and
    // THEN socket A's disconnect event fires (a late/delayed network event),
    // player X must stay marked connected -- the disconnect belongs to a
    // socket that is no longer "the" socket for that player.
    const { roomCode, players } = await setupStartedGame();
    const player = players[0]!;
    const staleSocket = player.socket;

    const freshSocket = harness.connect();
    await waitForConnect(freshSocket);
    const statePromise = waitForEvent<RoomStatePayload>(freshSocket, "room:state");
    await emitAck(freshSocket, "room:reconnect", { roomCode, reconnectToken: player.reconnectToken });
    await statePromise;

    const laterStatePromise = waitForEvent<RoomStatePayload>(freshSocket, "room:state");
    staleSocket.close(); // the OLD socket disconnects after the new one took over
    const stateAfterStaleDisconnect = await laterStatePromise;

    const serverPlayer = stateAfterStaleDisconnect.players.find((p) => p.playerId === player.playerId);
    expect(serverPlayer?.connected).toBe(true);
  });
});

describe("TV host reconnect", () => {
  it("lets the TV reattach to its own room using the hostToken instead of creating a new one", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    const created = await emitAck<{ roomCode: string; roomId: string; hostToken: string }>(host, "room:create", {});
    const { roomId, hostToken } = created.data!;
    host.close();
    await new Promise((r) => setTimeout(r, 30));

    const newHostSocket = harness.connect();
    await waitForConnect(newHostSocket);
    const rejoined = await emitAck<{ roomCode: string; roomId: string; hostToken: string }>(
      newHostSocket,
      "room:create",
      { rejoinRoomId: roomId, rejoinHostToken: hostToken },
    );
    expect(rejoined.ok).toBe(true);
    expect(rejoined.data!.roomId).toBe(roomId);
  });
});
