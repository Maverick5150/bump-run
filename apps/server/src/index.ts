import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { Server } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "@bump-run/shared-types";
import { APP_NAME, APP_VERSION } from "@bump-run/shared-types";
import { SERVER_CONFIG, isProduction } from "./config.js";
import { logger } from "./logger.js";
import { InMemoryRoomStore } from "./rooms/RoomStore.js";
import { registerSocketHandlers } from "./socket/registerSocketHandlers.js";
import { roomJoinUrl } from "./socket/RoomService.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const controllerDist = path.resolve(__dirname, "../../controller/dist");

async function main() {
  const fastify = Fastify({ logger: false });

  await fastify.register(fastifyCors, { origin: SERVER_CONFIG.CORS_ORIGIN });

  fastify.get("/healthz", async () => ({ ok: true, app: APP_NAME, version: APP_VERSION }));

  // The TV polls this (or the QR encodes it directly) to know what URL to show/encode.
  fastify.get<{ Params: { code: string } }>("/api/join-url/:code", async (request) => {
    return { url: roomJoinUrl(request.params.code) };
  });

  // Serves the built controller SPA. /join/:code is handled client-side by the controller's router.
  // (wildcard defaults to true: every request is matched against disk on each request,
  // so rebuilding the controller never requires restarting this server.)
  await fastify.register(fastifyStatic, {
    root: controllerDist,
  });
  fastify.setNotFoundHandler(async (request, reply) => {
    if (request.raw.url?.startsWith("/socket.io")) {
      reply.code(404).send();
      return;
    }
    return reply.sendFile("index.html");
  });

  // Attach Socket.IO directly to Fastify's own underlying http.Server.
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(fastify.server, {
    cors: { origin: SERVER_CONFIG.CORS_ORIGIN },
  });

  const store = new InMemoryRoomStore();
  registerSocketHandlers(io, store);

  setInterval(() => {
    const pruned = store.pruneExpired();
    if (pruned.length > 0) {
      logger.info({ count: pruned.length }, "pruned expired rooms");
    }
  }, 60_000).unref();

  await fastify.listen({ port: SERVER_CONFIG.PORT, host: SERVER_CONFIG.HOST });
  logger.info(
    { port: SERVER_CONFIG.PORT, publicBaseUrl: SERVER_CONFIG.PUBLIC_BASE_URL, env: SERVER_CONFIG.NODE_ENV },
    `${APP_NAME} server listening`,
  );
  if (!isProduction) {
    logger.info(`Controller (same origin): ${SERVER_CONFIG.PUBLIC_BASE_URL}`);
  }
}

main().catch((err) => {
  logger.error({ err }, "fatal startup error");
  process.exit(1);
});
