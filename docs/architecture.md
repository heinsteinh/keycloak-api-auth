# Architecture

## Overview

Three components, each in its own deployable unit:

```
┌────────────────────┐        ┌─────────────────────────┐        ┌──────────────────────┐
│  weather-frontend  │  ───▶  │       Keycloak          │        │  weather-keycloak-api│
│  (React + Vite)    │  ◀──   │  (realm "weather")      │        │  (Fastify + TS)      │
│  :5173             │        │  :8080                  │        │  :3000               │
└────────┬───────────┘        └────────────┬────────────┘        └──────────┬───────────┘
         │                                  │                                │
         │  1. Auth Code + PKCE redirect    │                                │
         │  2. Receives access_token        │                                │
         │                                                                    │
         │  3. GET /api/weather                                              │
         │     Authorization: Bearer <access_token>                          │
         └────────────────────────────────────────────────────────────────▶  │
                                                                              │
                                            4. Fetches JWKS from Keycloak    │
                                            5. Verifies signature + iss + azp │
                                            6. Authorizes by realm role       │
                                            7. Returns JSON                   │
```

## Components

### Keycloak (`:8080`)
- Identity provider, realm `weather`.
- Provisioned from `keycloak/realm-export.json` (auto-imported on first start).
- Issues short-lived access tokens (300 s) signed with RS256; rotates keys are exposed via JWKS at `/realms/weather/protocol/openid-connect/certs`.
- Two clients:
  - `weather-api` — public, **Direct access grants ON**. Used for backend curl/integration tests via password grant.
  - `weather-frontend` — public, **Standard flow + PKCE S256**, **Direct access grants OFF**. Used by the SPA.
- Two realm roles: `weather:read`, `weather:admin`.
- Two seed users: `alice` (read), `admin-user` (read + admin).

### `weather-keycloak-api` (`:3000`)
- Fastify 5 + TypeScript, run with `tsx watch` in dev.
- Plugins: `@fastify/helmet`, `@fastify/cors` (allowed origins: `http://localhost:3000`, `http://localhost:5173`), `@fastify/rate-limit`.
- **Token verification** (`src/auth/keycload.ts`):
  - JWKS resolved once via `jose.createRemoteJWKSet`, cached in-process.
  - On each request, `jwtVerify` checks signature + `iss === KEYCLOAK_ISSUER`.
  - `azp` is checked against `KEYCLOAK_CLIENT_ID` (`weather-api`) — note: tokens issued to the `weather-frontend` client carry `azp: weather-frontend`, so calling the API from the SPA requires either (a) widening this check, (b) configuring an audience mapper in Keycloak so the frontend token also targets `weather-api`, or (c) accepting both clients explicitly.
  - Roles are flattened from `realm_access.roles` ∪ `resource_access[client].roles`.
- **Authorization** (`src/auth/require-auth.ts`):
  - `requireAuth` — preHandler that strips `Bearer `, verifies, attaches `request.user`.
  - `requireRole(role)` — preHandler factory that 401s if not authenticated, 403s if the role is missing.
- **Routes** (`src/routes/`):
  - `GET /health` — unauth, liveness probe.
  - `GET /api/weather`, `GET /api/weather/:location` — `weather:read`.
  - `GET /api/weather/admin` — `weather:admin`.
- Config validated by `zod` from `.env` at boot — fails fast on missing/invalid values.

### `weather-frontend` (`:5173`)
- React 19 + Vite + TypeScript + Tailwind v3.
- **Auth** (`src/auth/`):
  - `keycloak.ts` — `keycloak-js` adapter pointed at the `weather-frontend` client.
  - `AuthProvider.tsx` — initializes Keycloak with `onLoad: 'login-required'` + `pkceMethod: 'S256'`. Tokens are kept in React state (and in the adapter's in-memory store), refreshed every 10 s with a 30 s leeway via `keycloak.updateToken(30)`.
- **API** (`src/api/client.ts`) — Axios instance pointed at `http://localhost:3000`.
- **UI** (`src/components/Weather.tsx`, `src/App.tsx`) — fetches `/api/weather` with the current bearer, renders a card; logout button calls `keycloak.logout()`.

## Auth flow (end-to-end)

1. User opens <http://localhost:5173>. `AuthProvider` calls `keycloak.init({ onLoad: 'login-required' })`.
2. `keycloak-js` generates a PKCE verifier/challenge, redirects to Keycloak's `/auth` endpoint with `code_challenge` + `redirect_uri=http://localhost:5173/*`.
3. User logs in. Keycloak redirects back with `?code=...&state=...`.
4. Adapter exchanges the code (POST `/token` with the PKCE verifier) for `access_token` + `refresh_token`.
5. React stores the access token in component state. `Weather` calls `GET /api/weather` with `Authorization: Bearer <token>`.
6. The API's `requireAuth` preHandler verifies the JWT against the cached JWKS, populates `request.user`.
7. `requireRole('weather:read')` preHandler checks `weather:read` is present.
8. Handler returns JSON; React renders it.
9. Every 10 s the SPA calls `keycloak.updateToken(30)`. If the token will expire within 30 s, it's silently refreshed via the refresh token (no redirect).

## Boundaries & invariants

- **Tokens never live in `localStorage`** — `keycloak-js` keeps them in JS memory; refresh uses an iframe-less silent flow disabled here (`checkLoginIframe: false`) so refresh relies on the refresh token in the response.
- **CORS is the perimeter for the SPA** — only `http://localhost:5173` is whitelisted on the API, so other origins can't ride a leaked token. (Bearer auth itself does not depend on CORS, but browser-originated requests do.)
- **Issuer + signature are the trust root** — anyone can produce a JWT, but only Keycloak's private key signs valid ones. Changing `KEYCLOAK_ISSUER` invalidates all existing tokens immediately.
- **Roles are claims, not DB lookups** — the API does no role storage. Granting/revoking access happens entirely in Keycloak; tokens reflect the new state on the next refresh.

## Local ports

| Service             | Port | Notes                                           |
| ------------------- | ---- | ----------------------------------------------- |
| Frontend (Vite)     | 5173 | `pnpm dev` in `weather-frontend`                |
| Backend (Fastify)   | 3000 | `pnpm dev` in `weather-keycloak-api`            |
| Keycloak            | 8080 | `docker compose up -d`                          |
| Postgres (Keycloak) | —    | not exposed; reachable only inside `weather-net`|

## Failure modes

- **Frontend token has wrong `azp`** — backend will 401 with "Invalid authorized party". Fix by updating the `azp` check or by mapping audience `weather-api` onto frontend tokens in Keycloak.
- **Token expired mid-session** — handled by the 10 s refresh loop. If both access *and* refresh tokens are dead (idle > `ssoSessionIdleTimeout`), `updateToken` rejects and the user must re-login.
- **Keycloak restarted with `down -v`** — the realm import re-runs and DB state is wiped. Existing refresh tokens become invalid.
- **CORS preflight fails** — usually the API origin allowlist needs an update; bearer header triggers a preflight.
