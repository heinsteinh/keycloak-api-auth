# Weather Frontend

React + Vite + TypeScript SPA that authenticates against **Keycloak** (Authorization Code + PKCE) and calls the [`weather-keycloak-api`](../weather-keycloak-api) protected endpoints.

> The full system design lives in [`../docs/architecture.md`](../docs/architecture.md).

## Stack

- **React 19** + **Vite** + **TypeScript**
- **Tailwind CSS** v3 for styling
- **`keycloak-js`** for OIDC (Authorization Code Flow + PKCE S256)
- **Axios** for API calls

## Project layout

```
src/
  main.tsx                 # App bootstrap, wraps <AuthProvider>
  App.tsx                  # Top-level UI + logout
  index.css                # Tailwind directives
  auth/
    keycloak.ts            # keycloak-js adapter instance
    AuthProvider.tsx       # Login-required init, token refresh loop
  api/
    client.ts              # Axios instance (baseURL = http://localhost:3000)
  components/
    Weather.tsx            # Fetches /api/weather with bearer
```

## Prerequisites

- Node.js 20+ and `pnpm`
- Keycloak running locally on `:8080` with the `weather` realm imported (see the backend README — `keycloak/realm-export.json` provisions the `weather-frontend` client this app expects).
- Backend API running on `:3000`.

## Setup

From the monorepo root:

```bash
pnpm install
pnpm dev:web      # http://localhost:5173
```

The app forces login on load: you'll be redirected to Keycloak, log in as `alice` / `Password123!`, and land back on the dashboard.

## Configuration

Keycloak settings are hard-coded in `src/auth/keycloak.ts` (URL, realm, clientId) and the API base URL in `src/api/client.ts`. For multi-environment setups, lift these into `import.meta.env.VITE_*` variables.

## Scripts

| Command        | Action                          |
| -------------- | ------------------------------- |
| `pnpm dev`     | Vite dev server with HMR        |
| `pnpm build`   | Type-check + production build   |
| `pnpm preview` | Serve the production build      |
| `pnpm lint`    | ESLint                          |

## Notes

- **`onLoad: 'login-required'`** — unauthenticated users are redirected to Keycloak immediately. Switch to `'check-sso'` for a soft check.
- **Token refresh** — `AuthProvider` calls `keycloak.updateToken(30)` every 10 s; tokens within 30 s of expiry are silently refreshed.
- **CORS** — the API whitelists `http://localhost:5173`. Change the dev port and you'll need to update `weather-keycloak-api/src/main.ts` and the client's `webOrigins` in Keycloak.
- **`azp` mismatch** — tokens issued to `weather-frontend` carry `azp: weather-frontend`, but the backend currently checks for `azp === 'weather-api'`. Either widen the check, accept both, or add an audience mapper in Keycloak. See `architecture.md` for details.
