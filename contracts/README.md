# Contracts

Foundry workspace for Glidepath's Uniswap v4 hook and launch contracts on Robinhood Chain (chain ID 4663).

The stage-one tax path, anti-snipe schedule, and fee split rules are in `src/GlidepathTaxPath.sol`, `src/GlidepathSnipe.sol`, and `src/GlidepathFeeMath.sol`. `src/GlidepathHook.sol` applies those rules to PoolManager swaps and blocks swaps until the configured open time. Stage-one contract scope excludes market-cap milestones, hidden launch, opening batches, holder rewards, and the $GLIDE utility token.

Uniswap v4 core is pinned to the official `v4.0.0` release. The hook uses v4 custom return-delta accounting for protocol/creator fees; it does not treat Glidepath fees as LP fees. Exact-input/output swaps that specify the quote asset are charged in `beforeSwap` and must fill fully; a price-limited partial fill reverts so the hook never charges for an untraded amount. When quote is the output asset of an exact-output trade, the fee is grossed up to leave the requested net output. Fees accrue by quote currency and are withdrawn by each recipient through `claimFees`. Uniswap core files carry per-file licenses; the source imports are restricted to MIT-licensed interfaces, types, and helper libraries.

The `lib/v4-core` submodule and `foundry.lock` pin the dependency. Check out submodules, copy `.env.example` to `.env`, set `RHC_RPC_URL`, then run `forge build`:

```sh
git submodule update --init --recursive
forge build
```

Do not deploy until the hook, launcher, liquidity lock, and payout flows are implemented and reviewed.
