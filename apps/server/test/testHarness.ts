import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { Server } from "socket.io";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import type { ClientToServerEvents, ServerAck, ServerToClientEvents } from "@bump-run/shared-types";
import { InMemoryRoomStore } from "../src/rooms/RoomStore.js";
import { registerSocketHandlers } from "../src/socket/registerSocketHandlers.js";

export interface Harness {
  url: string;
  store: InMemoryRoomStore;
  close: () => Promise<void>;
  connect: () => ClientSocket<ServerToClientEvents, ClientToServerEvents>;
}

export async function startHarness(): Promise<Harness> {
  const httpServer = createServer();
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, { cors: { origin: "*" } });
  const store = new InMemoryRoomStore();
  registerSocketHandlers(io, store);

  await new Promise<void>((resolve) => httpServer.listen(0, resolve));
  const { port } = httpServer.address() as AddressInfo;
  const url = `http://localhost:${port}`;

  const clients: ClientSocket[] = [];

  return {
    url,
    store,
    connect: () => {
      const client = ioClient(url, { transports: ["websocket"], forceNew: true });
      clients.push(client);
      return client;
    },
    close: async () => {
      for (const c of clients) c.close();
      await new Promise<void>((resolve) => io.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    },
  };
}

export function waitForConnect(socket: ClientSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on("connect", () => resolve());
    socket.on("connect_error", reject);
  });
}

export function emitAck<T>(socket: ClientSocket, event: string, payload: unknown): Promise<ServerAck<T>> {
  return new Promise((resolve) => {
    socket.emit(event, payload, (res: ServerAck<T>) => resolve(res));
  });
}

export function waitForEvent<T = unknown>(socket: ClientSocket, event: string): Promise<T> {
  return new Promise((resolve) => {
    socket.once(event, (payload: T) => resolve(payload));
  });
}
