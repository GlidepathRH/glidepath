# GLIDY

![CI](https://github.com/GlidepathRH/glidepath/actions/workflows/backend.yml/badge.svg)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Bun](https://img.shields.io/badge/Bun-1.x-000000?logo=bun&logoColor=white)
![TanStack Start](https://img.shields.io/badge/TanStack_Start-1.x-FF4154?logo=tanstack&logoColor=white)
![Robinhood Chain](https://img.shields.io/badge/Robinhood_Chain-4663-00C805)

**Launch with a tax. Lock how it falls.**

GLIDY is a token launchpad on Robinhood Chain (4663). A creator commits a pool tax path before trading begins; time steps and creator cuts can lower the tax, while the pool hook prevents it from rising. The token remains a plain ERC-20, and tax applies in its GLIDY pool.

## Product shape

| Area | Initial scope |
| --- | --- |
| Launchpad | Configure a token, tax schedule, fee routing, and launch protections |
| Pool hook | Enforce lower-only pool fees and expose the current tax path |
| API | Publish a queryable view of launches and their onchain tax paths |
| Chain | Robinhood Chain, chain ID 4663; Uniswap v4 |

The first contract release, **Hydrogen (H)**, is deployed on Robinhood Chain. Deployment addresses, transactions, and the version naming convention are recorded under `/contracts/deployments` and in the contracts README. The backend provides a read-only launch and tax-path API.

## Repository layout

| Path | Purpose |
| --- | --- |
| `/src` | Vite + TanStack Start frontend |
| `/src/glidy` | Integrated GLIDY React experience and its mock-data modules |
| `/public` | GLIDY brand, market, quote and media assets |
| `/src/routes/api/glidy` | Same-origin server proxy for protected backend reads |
| `/backend` | Bun + Express + TypeScript API and PostgreSQL migration runner |
| `/contracts` | Foundry workspace for the Uniswap v4 hook and launch contracts |
| `/.github/workflows` | Frontend, backend, and contract checks; optional Render hook |

## Getting started

Prerequisites: Node.js 22.12+ and pnpm; PostgreSQL and Foundry for backend/contract work.

```sh
# Frontend, from the repository root
pnpm install
cp .env.example .env
# Set MASTER_API_KEY (request it from Skipp) and GLIDY_API_BASE_URL in this
# server environment. MASTER_API_KEY must never be exposed as a VITE_ variable.
pnpm dev

# Backend, in another terminal
cd backend
bun install
cp .env.example .env
# Set DATABASE_URL, RHC_RPC_URL, MASTER_API_KEY, and FRONTEND_URL, then:
bun run dev

# Contracts
cd ../contracts
cp .env.example .env
forge build
```

The frontend preserves the supplied GLIDY experience and adds a GLIDY onchain launch section backed by the read-only API. It calls a same-origin TanStack server route, which forwards allowlisted read requests using the server-only `MASTER_API_KEY`; that key must never use a `VITE_` prefix or be shipped to browser code. Set `GLIDY_API_BASE_URL` and `MASTER_API_KEY` in the frontend host's server environment. The API lists launches and reads current taxes/events; token creation and swaps are not yet wired to wallet transactions.

## Deployment

- **Frontend:** Vercel at `glidy.fun`; set `GLIDY_API_BASE_URL` and `MASTER_API_KEY` as server environment variables.
- **Backend:** Render, rooted at `/backend`; set `DATABASE_URL`, `RHC_RPC_URL`, `MASTER_API_KEY`, `FRONTEND_URL`, and the platform `PORT`. The optional workflow deploy hook uses `RENDER_DEPLOY_HOOK_URL`.
- **Contracts:** deployed on Robinhood Chain; see `contracts/deployments/robinhood-mainnet.json` for the contract and treasury addresses.

## Stack

TypeScript · React · Vite · TanStack Start · Bun · Express · PostgreSQL · Solidity · Foundry · Uniswap v4 · Robinhood Chain
