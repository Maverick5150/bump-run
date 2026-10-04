# Builds the server and the controller it serves, then runs the server alone.
FROM node:20-slim AS build
WORKDIR /repo

RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY apps/server/package.json apps/server/package.json
COPY apps/controller/package.json apps/controller/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build:controller && pnpm run build:server

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/shared-types/package.json packages/shared-types/package.json
COPY packages/game-engine/package.json packages/game-engine/package.json
COPY apps/server/package.json apps/server/package.json
RUN pnpm install --frozen-lockfile --prod --filter ./apps/server...

COPY --from=build /repo/packages/shared-types/dist packages/shared-types/dist
COPY --from=build /repo/packages/game-engine/dist packages/game-engine/dist
COPY --from=build /repo/apps/server/dist apps/server/dist
COPY --from=build /repo/apps/controller/dist apps/controller/dist

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
