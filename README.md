# Weather + Keycloak Auth

A reference implementation of an end-to-end **OIDC + PKCE** authentication flow:

- **Keycloak** as the identity provider (realm `weather`, two clients, two realm roles, two seed users)
- **`weather-keycloak-api`** — Fastify + TypeScript API that verifies access tokens via JWKS and authorizes by realm role
- **`weather-frontend`** — React 19 + Vite SPA that logs users in via Authorization Code + PKCE and calls the API with a bearer token

> The full system design, auth flow, and trust boundaries are documented in [`docs/architecture.md`](./docs/architecture.md).

## Repository layout

```
.
├── docker-compose.yml          # Keycloak + Postgres
├── .env.example                # Single source of env config (root)
├── package.json                # pnpm workspace orchestration scripts
├── pnpm-workspace.yaml         # Workspace package globs
├── docs/
│   └── architecture.md         # End-to-end design + auth flow
├── weather-keycloak-api/       # Fastify backend (see its README)
│   ├── src/
│   ├── keycloak/
│   │   └── realm-export.json   # Auto-imported on first Keycloak start
│   └── README.md
└── weather-frontend/           # React SPA (see its README)
    ├── src/
    └── README.md
```

## Stack at a glance

| Layer    | Tech                                                                |
| -------- | ------------------------------------------------------------------- |
| IdP      | Keycloak 26 (Postgres-backed)                                       |
| Backend  | Node 20+, Fastify 5, TypeScript, `jose` for JWT verification, `zod` |
| Frontend | React 19, Vite, TypeScript, Tailwind v3, `keycloak-js`              |
| Tooling  | pnpm 10 workspaces, Docker Compose, `tsx`                           |

## Prerequisites

- Docker + Docker Compose
- Node.js 20+
- pnpm 10+ (`corepack enable` if needed)

## Quickstart

```bash
# 1. Configure environment
cp .env.example .env
# (optional) edit secrets in .env

# 2. Install all workspace dependencies
pnpm install

# 3. Start Keycloak + Postgres (realm auto-imported on first run)
pnpm up

# 4. Start the API and the SPA in parallel
pnpm dev
```

Then open <http://localhost:5173> and log in as `alice` / `Password123!` (read-only) or `admin-user` / `Password123!` (read + admin).

## Service ports

| Service             | URL                       | Started by                           |
| ------------------- | ------------------------- | ------------------------------------ |
| Frontend (Vite)     | <http://localhost:5173>   | `pnpm dev:web`                       |
| Backend (Fastify)   | <http://localhost:3000>   | `pnpm dev:api`                       |
| Keycloak            | <http://localhost:8080>   | `pnpm up`                            |
| Postgres (Keycloak) | not exposed               | `pnpm up` (internal `weather-net`)   |

## Root scripts

| Command            | Action                                                         |
| ------------------ | -------------------------------------------------------------- |
| `pnpm install`     | Install dependencies for all workspace packages                |
| `pnpm dev`         | Run API and frontend in parallel                               |
| `pnpm dev:api`     | Run only `weather-keycloak-api`                                |
| `pnpm dev:web`     | Run only `weather-frontend`                                    |
| `pnpm build`       | Build all workspace packages                                   |
| `pnpm lint`        | Run lint across all packages                                   |
| `pnpm test`        | Run tests across all packages                                  |
| `pnpm up`          | `docker compose up -d` (Keycloak + Postgres)                   |
| `pnpm down`        | Stop containers (preserves DB volume)                          |
| `pnpm down:clean`  | Stop containers **and** wipe DB volume — re-runs realm import  |
| `pnpm logs`        | Tail container logs                                            |

## Seed identities

Provisioned by [`weather-keycloak-api/keycloak/realm-export.json`](./weather-keycloak-api/keycloak/realm-export.json):

| User         | Password        | Realm roles                       |
| ------------ | --------------- | --------------------------------- |
| `alice`      | `Password123!`  | `weather:read`                    |
| `admin-user` | `Password123!`  | `weather:read`, `weather:admin`   |

Clients:

- `weather-api` — public, **Direct access grants ON** (used for backend curl/integration tests)
- `weather-frontend` — public, **Standard flow + PKCE S256**, redirect `http://localhost:5173/*`

## How it fits together

```
┌────────────────────┐        ┌─────────────────────────┐        ┌──────────────────────┐
│  weather-frontend  │  ───▶  │       Keycloak          │        │  weather-keycloak-api│
│  (React + Vite)    │  ◀──   │  (realm "weather")      │        │  (Fastify + TS)      │
│  :5173             │        │  :8080                  │        │  :3000               │
└────────┬───────────┘        └────────────┬────────────┘        └──────────┬───────────┘
         │                                  │                                │
         │  1. Auth Code + PKCE redirect    │                                │
         │  2. Receives access_token        │                                │
         │  3. GET /api/weather                                              │
         │     Authorization: Bearer <access_token>                          │
         └────────────────────────────────────────────────────────────────▶  │
                                            4. Fetch JWKS                    │
                                            5. Verify signature + iss + azp  │
                                            6. Authorize by realm role       │
                                            7. Return JSON                   │
```

See [`docs/architecture.md`](./docs/architecture.md) for the full breakdown.

## Per-package documentation

- Backend: [`weather-keycloak-api/README.md`](./weather-keycloak-api/README.md) — endpoints, token verification, troubleshooting
- Frontend: [`weather-frontend/README.md`](./weather-frontend/README.md) — auth provider, token refresh, configuration notes

## Common gotchas

- **`invalid_grant: Account is not fully set up`** — the Keycloak user is missing email/first/last or has a pending required action. Fix in the admin console at <http://localhost:8080>.
- **`401 Invalid token`** — token expired (default 5 min) or `azp` mismatch. The frontend issues tokens with `azp: weather-frontend` while the API checks `azp === weather-api`. See `docs/architecture.md` for the three resolution options (widen check, audience mapper, or accept both).
- **Realm import did not run** — the import only runs against an empty DB. Use `pnpm down:clean` to wipe the volume and re-import.
- **CORS preflight fails** — the API whitelists `http://localhost:5173`. Changing the SPA dev port requires updating both `weather-keycloak-api/src/main.ts` and the `weather-frontend` client's `webOrigins` in Keycloak.

## License

ISC
