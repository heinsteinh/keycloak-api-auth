# Weather Keycloak API

A small Fastify + TypeScript API that demonstrates protecting HTTP endpoints with **Keycloak**-issued JWTs. Tokens are obtained from a local Keycloak realm via the OAuth2 password grant, verified against the realm's JWKS, and authorized by realm role.

> See [`../docs/architecture.md`](../docs/architecture.md) for the end-to-end design, auth flow, and trust boundaries.

## Stack

- **Runtime:** Node.js (ESM) + TypeScript, run with `tsx` in dev
- **HTTP:** Fastify 5 with `@fastify/helmet`, `@fastify/cors`, `@fastify/rate-limit`
- **Auth:** Keycloak 26 (Postgres-backed), JWT verification with `jose`
- **Weather data:** [Open-Meteo](https://open-meteo.com/) (free, no API key) — geocoding + current forecast
- **Config:** `dotenv` + `zod`-validated environment

## Project layout

```
src/
  main.ts                  # Fastify bootstrap
  config.ts                # Env validation (zod)
  auth/
    keycload.ts            # JWKS-based access-token verification
    require-auth.ts        # requireAuth + requireRole preHandlers
  routes/
    health.routes.ts       # GET /health
    weather.routes.ts      # GET /api/weather (role: weather:read)
  weather/
    openMeteo.ts           # Open-Meteo geocoding + current-forecast client
../docker-compose.yml      # Keycloak + Postgres (lives at the monorepo root)
../infra/keycloak/
  realm-export.json        # Pre-baked realm: clients, roles, seed users
request.http               # Ready-to-run requests (REST Client / JetBrains HTTP)
```

## Prerequisites

- Docker + Docker Compose
- Node.js 20+ and `pnpm`

## Setup

> Run all commands from the **monorepo root** unless noted. `docker-compose.yml` and `.env` now live at the root.

1. **Environment** — create a `.env` at the monorepo root (copy from `.env.example`):

   ```dotenv
   POSTGRES_DB=keycloak
   POSTGRES_USER=keycloak
   POSTGRES_PASSWORD=change_me_strong_password

   KEYCLOAK_ADMIN=admin
   KEYCLOAK_ADMIN_PASSWORD=change_me_admin_password
   KEYCLOAK_HOSTNAME=localhost
   KEYCLOAK_PORT=8080

   API_PORT=3000
   KEYCLOAK_REALM=weather
   KEYCLOAK_ISSUER=http://localhost:8080/realms/weather
   KEYCLOAK_CLIENT_ID=weather-api
   ```

2. **Start Keycloak + Postgres**:

   ```bash
   docker compose up -d
   ```

   Keycloak admin console: <http://localhost:8080> (login with `KEYCLOAK_ADMIN` / `KEYCLOAK_ADMIN_PASSWORD`).

3. **Configure the realm** — easiest path is to **import `infra/keycloak/realm-export.json`**, which pre-creates everything below.

   **Option A — auto-import on startup** (recommended). Mount the folder and pass `--import-realm` in `docker-compose.yml`:

   ```yaml
   services:
     keycloak:
       command:
         - start-dev
         - --import-realm
       volumes:
         - ./keycloak:/opt/keycloak/data/import:ro
   ```

   Then:

   ```bash
   docker compose down -v   # wipe the DB so the import runs
   docker compose up -d
   ```

   **Option B — manual import** via the admin console: *Realm settings → Action → Partial import* (or *Create realm → Resource file*) and select `infra/keycloak/realm-export.json`.

   The export provisions:
   - Realm `weather` (access token lifespan 300s).
   - Realm roles `weather:read` and `weather:admin`.
   - Client `weather-api` — *Public*, **Direct access grants ON**, redirect `http://localhost:3000/*`. Used by the API for password-grant testing.
   - Client `weather-frontend` — *Public*, **Standard flow + PKCE S256**, **Direct access grants OFF**, redirect `http://localhost:5173/*`, web origin `http://localhost:5173`. Used by the React app.
   - Users:
     - `alice` / `Password123!` — role `weather:read`.
     - `admin-user` / `Password123!` — roles `weather:read` + `weather:admin`.

   > If you'd rather configure manually in the admin console, create the same clients/roles/users by hand. Missing profile fields (email/first/last) or a temporary password will cause the password grant to return `invalid_grant: Account is not fully set up`.

4. **Install deps & run the API** (from the monorepo root):

   ```bash
   pnpm install
   pnpm dev:api
   ```

   API: <http://localhost:3000>

## Usage

### Get an access token

```bash
curl -s -X POST 'http://localhost:8080/realms/weather/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=weather-api' \
  -d 'grant_type=password' \
  -d 'username=alice' \
  -d 'password=Password123!' | jq -r .access_token
```

> In zsh, single-quote each `-d` value so `!` is not history-expanded.

### Call a protected endpoint

```bash
TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/weather/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=weather-api' -d 'grant_type=password' \
  -d 'username=alice' -d 'password=Password123!' | jq -r .access_token)

curl -s http://localhost:3000/api/weather -H "Authorization: Bearer $TOKEN"
```

### Call the admin-only endpoint

```bash
ADMIN_TOKEN=$(curl -s -X POST 'http://localhost:8080/realms/weather/protocol/openid-connect/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'client_id=weather-api' -d 'grant_type=password' \
  -d 'username=admin-user' -d 'password=Password123!' | jq -r .access_token)

curl -s http://localhost:3000/api/weather/admin -H "Authorization: Bearer $ADMIN_TOKEN"
```

> Returns `403 Forbidden` if the user does not have the `weather:admin` realm role.

Or open `request.http` in VS Code (REST Client extension) / JetBrains HTTP Client and click **Send Request**. Login responses are reused automatically by later requests (`alice` → `/api/weather`, `admin-user` → `/api/weather/admin`).

## Endpoints

| Method | Path                     | Auth                  | Description                                            |
| ------ | ------------------------ | --------------------- | ------------------------------------------------------ |
| GET    | `/health`                | none                  | Liveness probe                                         |
| GET    | `/api/weather`           | role `weather:read`   | Current weather for the default location (New York)    |
| GET    | `/api/weather/:location` | role `weather:read`   | Current weather for the given city (Open-Meteo lookup) |
| GET    | `/api/weather/admin`     | role `weather:admin`  | Admin-only sample endpoint                             |

### Weather response shape

`/api/weather` and `/api/weather/:location` return live data from Open-Meteo:

```json
{
  "location": "Paris, Île-de-France, France",
  "temperature": "14°C",
  "temperatureCelsius": 14.1,
  "condition": "Rain",
  "weatherCode": 61,
  "requestedBy": {
    "id": "...",
    "username": "alice",
    "email": "alice@example.com",
    "roles": ["weather:read"]
  }
}
```

- `location` — geocoded label (`name, admin1, country`)
- `temperature` — display string, rounded to whole degrees
- `temperatureCelsius` — raw float from the forecast endpoint
- `weatherCode` — WMO code; `condition` is its human-readable mapping (see [Open-Meteo docs](https://open-meteo.com/en/docs))

### Error responses

| Status | When                                                                  | Body                                                                |
| ------ | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `401`  | Missing/invalid bearer, signature/issuer/`azp` check failed           | `{ "error": "Invalid token", "message": "<jose error>" }`           |
| `403`  | Token valid but missing the required realm role                       | `{ "error": "Forbidden", "message": "User does not have ..." }`     |
| `404`  | Geocoding returns no result for the given city                        | `{ "error": "Not Found", "message": "City not found: <city>" }`     |
| `502`  | Open-Meteo is unreachable or returns a non-2xx response               | `{ "error": "Bad Gateway", "message": "Weather provider is unavailable" }` |

## Scripts

| Command       | Action                                |
| ------------- | ------------------------------------- |
| `pnpm dev`    | Run with `tsx watch` (hot reload)     |
| `pnpm build`  | Type-check and emit JS to `dist/`     |
| `pnpm start`  | Run the compiled build                |
| `pnpm test`   | Run Vitest                            |

## Troubleshooting

- **`invalid_grant: Account is not fully set up`** — the user is missing required attributes (email/first/last) or has a pending required action (e.g. `UPDATE_PASSWORD`, `VERIFY_PROFILE`). Fix the user in the admin console and retry.
- **`401 Invalid token`** — token expired (default lifetime 5 min) or `azp` doesn't match `KEYCLOAK_CLIENT_ID`. Re-run the token request.
- **Request hangs on `/api/weather`** — Fastify preHandler must be async or accept a `done` callback; a sync hook returning `undefined` will stall the lifecycle.
