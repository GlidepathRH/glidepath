<div align="center">

<h1>GLIDY</h1>

<p><strong>Launch with a tax. Lock how it falls.</strong></p>

<p>GLIDY is a token launch platform on Robinhood Chain. Creators configure a buy and sell tax path before launch. The Uniswap v4 pool hook applies those rules, and the committed rates can step down over time or be lowered by the creator. The token remains a standard fixed-supply ERC-20; GLIDY's pool rules apply to swaps through that pool.</p>

<p>GLIDY makes launch funding and pool fees understandable up front: it shows the configured tax path, reports current onchain rates, and makes launch activity inspectable.</p>

<p>
  <a href="https://github.com/GlidepathRH/glidepath/actions/workflows/backend.yml"><img alt="Backend CI" src="https://github.com/GlidepathRH/glidepath/actions/workflows/backend.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white">
  <img alt="Bun" src="https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white">
  <img alt="TanStack Start" src="https://img.shields.io/badge/TanStack_Start-1.x-FF4154?logo=tanstack&logoColor=white">
</p>

</div>

## Links

| | |
| --- | --- |
| Website | [glidy.fun](https://www.glidy.fun) |
| Main app | [Explore launches](https://www.glidy.fun/#/explore) |
| Create a launch | [Open the wallet launch flow](https://www.glidy.fun/#/launch) |
| X | [@glidepathrh](https://x.com/glidepathrh) |
| GitHub | [GlidepathRH/glidepath](https://github.com/GlidepathRH/glidepath) |
| Roadmap | [Project roadmap](./ROADMAP.md) |
| Product docs | [How GLIDY works](https://www.glidy.fun/#/docs/overview) |
| API docs | [GLIDY API](https://www.glidy.fun/#/docs/api) |

## How it works

- A creator sets the token supply, quote asset, initial liquidity, buy and sell tax paths, and optional opening protection.
- The app's wallet launch flow connects to Robinhood Chain and submits the factory transaction. Native ETH is currently the supported quote asset; launch creation requires the creator to approve the funding and gas in their wallet.
- The factory creates a fixed-supply ERC-20 and initializes its Uniswap v4 pool on Robinhood Chain.
- The GLIDY hook applies the pool's configured base fee and current tax. The tax path and creator ceiling can only move down.
- Creator and platform fee shares accrue as claimable balances.
- The backend indexes factory and hook events in PostgreSQL. The website reads launches, current hook tax, launch settings, events, and indexer progress through a server-side API proxy.

The first contract release is **Hydrogen (H)**. Deployment addresses and transaction records are in [`contracts/deployments/robinhood-mainnet.json`](contracts/deployments/robinhood-mainnet.json). See the [contract documentation](contracts/README.md) for current behavior and limitations.

## Run locally

### Requirements

- Node.js 24 and pnpm
- Bun
- PostgreSQL for the backend
- Foundry and Git submodules for contract development

### Frontend

From the repository root:

```sh
pnpm install
cp .env.example .env
```

Set `GLIDY_API_BASE_URL` to a running backend. `MASTER_API_KEY` is a server-only secret required by the API proxy; obtain a development key from the project maintainer or run the backend locally with the same key. Never expose it in a `VITE_*` variable. Set `VITE_WALLETCONNECT_PROJECT_ID` to a WalletConnect Cloud project ID to enable WalletConnect QR and mobile wallet connections; injected browser wallets can be used without it.

```sh
pnpm dev
```

The site runs at `http://127.0.0.1:5184`. Open `/` for the GLIDY website, `/#/explore` for the launch browser, or `/#/launch` to create a launch with an EVM wallet on Robinhood Chain.

### Backend

In another terminal:

```sh
cd backend
bun install
cp .env.example .env
```

Set `DATABASE_URL`, `RHC_RPC_URL`, `MASTER_API_KEY`, and `FRONTEND_URL` in `backend/.env`. The example file includes the deployed Hydrogen contract addresses and starting block. Apply migrations and run the service:

```sh
bun run dev
```

The API listens on port `3001` by default. `/health/` is public; other API routes require a bearer key. See [`backend/README.md`](backend/README.md) and [`backend/openapi.yaml`](backend/openapi.yaml) for configuration and endpoint details.

### Contracts

From the repository root:

```sh
git submodule update --init --recursive
cd contracts
cp .env.example .env
forge build
forge test
```

Deployment requires a funded deployer, a treasury address, and a production RPC. Keep private keys in the ignored `contracts/.env`; never commit them. See [`contracts/README.md`](contracts/README.md) before deploying.

## Tests and checks

```sh
# Frontend API client, launch data and proxy policy
pnpm test
pnpm typecheck
pnpm build

# Backend auth, routes, rate limits and indexer
cd backend
bun run test
bun run check

# Contracts
cd ../contracts
forge test
```

## Repository layout

- `src/` — TanStack Start website, launch browser, API client and server proxy
- `public/` — GLIDY brand assets and fonts
- `backend/` — Bun/Express API, PostgreSQL migrations and chain indexer
- `contracts/` — Solidity hook, factory, tests and deployment records
- `.github/workflows/` — frontend, backend and contract CI

## License

See [`LICENSE`](LICENSE).
