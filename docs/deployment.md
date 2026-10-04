# Deployment

## Server + controller

The server (`apps/server`) serves the built controller (`apps/controller/dist`)
from the same origin, so "deploying the app" means running one Node process.

### Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket listen port |
| `HOST` | `0.0.0.0` | Listen address |
| `PUBLIC_BASE_URL` | `http://localhost:<PORT>` | Base URL encoded into QR join links -- **must** be the address phones and the TV can actually reach. Never leave this as `localhost` in production. |
| `CORS_ORIGIN` | `*` | Restrict in production if you control the controller's origin |
| `NODE_ENV` | `development` | `production` enables quieter logging |

See `.env.example` for a template (never commit a real `.env`).

### Docker

```bash
docker build -t bump-run-server .
docker run -p 3000:3000 -e PUBLIC_BASE_URL=https://bumprun.example.com bump-run-server
```

Or with Compose (also starts nothing else -- there's intentionally no database):

```bash
docker compose up --build
```

### Any Node host

This is a plain Fastify + Socket.IO app -- it runs on Railway, Render, Fly.io,
a VPS, etc. Build steps:

```bash
pnpm install --frozen-lockfile
pnpm run build:controller
pnpm run build:server
PUBLIC_BASE_URL=https://your-real-url pnpm --filter ./apps/server run start
```

Make sure the platform's WebSocket support is enabled (Socket.IO falls back to
polling if not, which still works but with higher latency).

## Android release signing

Debug builds use Android's default debug signing automatically -- nothing to
configure. **Release** builds require a real keystore that is never committed:

1. Generate one (if you don't have one yet):
   ```powershell
   keytool -genkeypair -v -keystore release.jks -alias bumprun -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Either:
   - **Local build**: create `apps/tv/keystore.properties` (gitignored) with:
     ```
     storeFile=C:\\path\\to\\release.jks
     storePassword=...
     keyAlias=bumprun
     keyPassword=...
     ```
   - **CI (GitHub Actions)**: add these repository secrets, consumed by
     `.github/workflows/release.yml`:
     - `ANDROID_KEYSTORE_BASE64` (the `.jks` file, base64-encoded)
     - `ANDROID_KEYSTORE_PASSWORD`
     - `ANDROID_KEY_ALIAS`
     - `ANDROID_KEY_PASSWORD`

Without either of these, `assembleRelease` still succeeds (useful for CI build
smoke-testing) but produces an unsigned APK not suitable for distribution.

Also set the production server URL at build time for a release build:

```bash
cd apps/tv
./gradlew assembleRelease -PprodServerUrl=https://bumprun.example.com
```

Never commit `*.jks`, `*.keystore`, or `keystore.properties` -- all three are
gitignored already.

## What's required before going fully public

1. A real, stable `PUBLIC_BASE_URL` (HTTPS strongly recommended -- some mobile
   browsers restrict `navigator.vibrate` and other APIs on plain HTTP).
2. A signed release APK (above), hosted wherever you plan to distribute it
   (sideload link, Amazon Appstore submission, etc.).
3. Trademark clearance for the final product name, if "BUMP RUN" stops being a
   working title -- see the note at the top of `README.md`.
