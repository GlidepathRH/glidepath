# Glidepath API

The backend serves a read-only view of Glidepath launches on Robinhood Chain. It indexes factory and hook events into PostgreSQL and reads the current buy/sell tax directly from the hook when a launch is requested. Launch transactions are submitted by the client; this service does not sign or broadcast transactions.

## Configuration

Copy `.env.example` to `.env`. Set `DATABASE_URL`, `RHC_RPC_URL`, and `FRONTEND_URL`. The current chain ID, factory, hook and deployment block are prefilled for the Hydrogen deployment. The current read-only API does not access or use the treasury private key configured in the local environment.

The indexer waits for `INDEXER_CONFIRMATIONS` blocks, scans up to `INDEXER_BLOCK_RANGE` blocks per poll, and resumes from its PostgreSQL cursor after restart. A PostgreSQL advisory lock prevents multiple backend instances from indexing the same range concurrently.

## API

- `GET /health/` — process health.
- `GET /ready/` — database and Robinhood RPC readiness.
- `GET /api/v1/indexer` — indexer status and indexed block cursor.
- `GET /api/v1/launches?limit=50` — latest indexed launches, up to 100.
- `GET /api/v1/launches/:tokenAddress` — launch details plus current buy/sell tax in Uniswap pips.
- `GET /api/v1/launches/:tokenAddress/events` — indexed launch and pool events.

Large token amounts are returned as decimal strings. Tax rates are integers where 1,000,000 pips equals 100%.

## Development

```sh
bun install
bun run dev
```

The server applies SQL files in `db/migrations/` at startup. The launch tables are created by `001_launch_indexer.sql`.
