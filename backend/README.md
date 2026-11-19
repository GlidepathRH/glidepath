# Glidepath API

The backend serves a read-only view of Glidepath launches on Robinhood Chain. It indexes factory and hook events into PostgreSQL and reads the current buy/sell tax directly from the hook when a launch is requested. Launch transactions are submitted by the client; this service does not sign or broadcast transactions.

## Configuration

Copy `.env.example` to `.env`. Set `DATABASE_URL`, `RHC_RPC_URL`, `MASTER_API_KEY`, and `FRONTEND_URL`. Set `MASTER_API_KEY` to a random secret with at least 32 characters; configure the same value in the hosting provider's environment. All routes except `/health/` require `Authorization: Bearer <MASTER_API_KEY>`. If the key is missing, protected routes fail closed with `503`; the health route remains public. The current chain ID, factory, hook and deployment block are prefilled for the Hydrogen deployment. EVM addresses are validated as 20-byte hex and normalized to checksum casing at startup. The current read-only API does not access or use the treasury private key configured in the local environment.

The indexer waits for `INDEXER_CONFIRMATIONS` blocks, scans up to `INDEXER_BLOCK_RANGE` blocks per poll, and resumes from its PostgreSQL cursor after restart. A PostgreSQL advisory lock prevents multiple backend instances from indexing the same range concurrently.

## CI and publishing

On the public repository, CI typechecks the backend and builds its Docker image for pushes and pull requests. A push to public `main` also publishes `ghcr.io/glidepathrh/glidepath-backend:latest` and a commit-SHA tag, then triggers Render through `RENDER_DEPLOY_HOOK_URL` when that GitHub Actions secret is configured. The image is published with `GITHUB_TOKEN` from the public repository and carries an OCI source label linking it to Glidepath; GHCR inherits the linked repository's public visibility. The Render hook remains a separate deployment path and does not automatically switch Render to pull the GHCR image.

## API

- Full OpenAPI 3.1 contract: [`openapi.yaml`](./openapi.yaml).
- `GET /health/` — process health.
- `GET /ready/` — database and Robinhood RPC readiness.
- `GET /api/v1/indexer` — indexer status and indexed block cursor.
- `GET /api/v1/launches?limit=50` — latest indexed launches, up to 100.
- `GET /api/v1/launches/:tokenAddress` — launch details plus current buy/sell tax in Uniswap pips.
- `GET /api/v1/launches/:tokenAddress/events` — indexed launch and pool events.

All listed routes except `/health/` require the bearer token described above. CORS preflight requests are accepted without credentials; the actual API request must include the bearer token.

Failed or missing bearer credentials are limited to 10 attempts per client IP per 15-minute window. Authenticated API requests are limited to 120 per client IP per 15-minute window. Both limits return `429` with a `Retry-After` header when exceeded. Counters are stored atomically in PostgreSQL and shared across service instances. The GLIDY server proxy forwards Vercel’s validated client IP in `X-Glidy-Client-IP`; the backend honors it only after bearer authentication succeeds. Direct API calls use Render’s Cloudflare/client forwarding headers. Expired IP buckets are pruned periodically; client IPs are retained for up to an hour after their rate-limit window starts. The limiter fails closed with `503` if PostgreSQL is unavailable.

The health response includes `commit`, the full Git commit SHA baked into the image at build time. Local runs show `unknown` unless `APP_COMMIT_SHA` is set.

Large token amounts are returned as decimal strings. Tax rates are integers where 1,000,000 pips equals 100%.

## Development

```sh
bun install
bun run dev
```

The server applies SQL files in `db/migrations/` at startup. The launch tables are created by `001_launch_indexer.sql`; migrations `002_api_auth_rate_limits.sql` and `003_api_client_rate_limits.sql` create the PostgreSQL-backed failed-auth and authenticated-request limits.
