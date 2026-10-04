# Builds the server and the controller it serves, then runs the server alone.
#
# The runtime stage copies the ENTIRE build-stage /repo (including
# node_modules and devDependencies) rather than re-running a fresh
# `pnpm install --prod` in a new context. An earlier version did a prod-only
# reinstall here and it failed at runtime with
# `Cannot find package '@bump-run/shared-types'` -- pnpm's workspace
# symlinks from that second, separate install didn't resolve correctly.
# Copying the already-working node_modules from the build stage sidesteps
# that whole class of problem; the image is a bit larger, which doesn't
# matter for this deployment.
FROM node:20-slim AS build
WORKDIR /repo

RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm run build:controller && pnpm run build:server

FROM node:20-slim AS runtime
WORKDIR /repo
ENV NODE_ENV=production

COPY --from=build /repo /repo

EXPOSE 3000
CMD ["node", "apps/server/dist/index.js"]
