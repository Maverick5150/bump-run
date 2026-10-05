import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { emitAck, startHarness, waitForConnect, waitForEvent, type Harness } from "./testHarness.js";

let harness: Harness;

beforeEach(async () => {
  harness = await startHarness();
});

afterEach(async () => {
  await harness.close();
});

interface StartedState {
  state: { players: { seat: string; isBot: boolean; nickname: string }[] };
}

describe("AI bot players", () => {
  it("lets a solo human start a game by filling the other seats with bots", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    const created = await emitAck<{ roomCode: string }>(host, "room:create", {});
    const roomCode = created.data!.roomCode;

    const player = harness.connect();
    await waitForConnect(player);
    await emitAck(player, "room:join", { roomCode, nickname: "Solo" });
    player.emit("player:selectColor", { seat: "red" });
    player.emit("player:ready", { ready: true });
    await new Promise((r) => setTimeout(r, 50));

    const startedPromise = waitForEvent<StartedState>(host, "game:started");
    host.emit("game:start", { botSeats: ["blue", "green", "yellow"] });
    const started = await startedPromise;

    expect(started.state.players).toHaveLength(4);
    const bySeat = Object.fromEntries(started.state.players.map((p) => [p.seat, p.isBot]));
    expect(bySeat.red).toBe(false);
    expect(bySeat.blue).toBe(true);
    expect(bySeat.green).toBe(true);
    expect(bySeat.yellow).toBe(true);
  });

  it("rejects starting with bots alone and no ready human", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    await emitAck(host, "room:create", {});
    const errorPromise = waitForEvent<{ code: string }>(host, "room:error");
    host.emit("game:start", { botSeats: ["red", "blue", "green", "yellow"] });
    const err = await errorPromise;
    expect(err.code).toBe("NOT_ENOUGH_PLAYERS");
  });

  it("never lets a bot claim a seat a ready human already holds", async () => {
    const host = harness.connect();
    await waitForConnect(host);
    const created = await emitAck<{ roomCode: string }>(host, "room:create", {});
    const roomCode = created.data!.roomCode;
    const player = harness.connect();
    await waitForConnect(player);
    await emitAck(player, "room:join", { roomCode, nickname: "Taken" });
    player.emit("player:selectColor", { seat: "red" });
    player.emit("player:ready", { ready: true });
    await new Promise((r) => setTimeout(r, 50));

    const startedPromise = waitForEvent<StartedState>(host, "game:started");
    // Host's request mistakenly/maliciously includes "red" as a bot seat too.
    host.emit("game:start", { botSeats: ["red", "blue"] });
    const started = await startedPromise;
    const red = started.state.players.find((p) => p.seat === "red")!;
    expect(red.isBot).toBe(false);
    expect(red.nickname).toBe("Taken");
  });

  it(
    "automatically plays consecutive bot turns through to the human's turn",
    async () => {
      const host = harness.connect();
      await waitForConnect(host);
      const created = await emitAck<{ roomCode: string }>(host, "room:create", {});
      const roomCode = created.data!.roomCode;
      const player = harness.connect();
      await waitForConnect(player);
      await emitAck(player, "room:join", { roomCode, nickname: "Last" });
      // Yellow is last in seat order, so red/blue/green bots must all take
      // (and fully resolve) their turns before this human ever sees one.
      player.emit("player:selectColor", { seat: "yellow" });
      player.emit("player:ready", { ready: true });
      await new Promise((r) => setTimeout(r, 50));

      host.emit("game:start", { botSeats: ["red", "blue", "green"] });

      const sawYellowTurn = await new Promise<boolean>((resolve) => {
        const handler = (p: { seat: string }) => {
          if (p.seat === "yellow") {
            player.off("turn:started", handler);
            resolve(true);
          }
        };
        player.on("turn:started", handler);
        setTimeout(() => resolve(false), 15000);
      });

      expect(sawYellowTurn).toBe(true);
    },
    20000,
  );
});
