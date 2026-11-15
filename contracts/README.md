# Contracts

Foundry workspace for Glidepath's Uniswap v4 hook and launch contracts on Robinhood Chain (chain ID 4663).

The stage-one tax path, anti-snipe schedule, and fee split rules are in `src/GlidepathTaxPath.sol`, `src/GlidepathSnipe.sol`, and `src/GlidepathFeeMath.sol`. `src/GlidepathHook.sol` applies those rules to PoolManager swaps and blocks swaps until the configured open time. Stage-one contract scope excludes market-cap milestones, hidden launch, opening batches, holder rewards, and the $GLIDE utility token.

`src/GlidepathToken.sol` is a plain fixed-supply ERC-20: the factory mints its full supply once, deposits the creator-selected amount into the launch position, and transfers the remainder to the creator. `src/GlidepathLaunchFactory.sol` initializes the pool, seeds one full-range position, returns unused token and quote budgets, and charges an immutable native-currency launch fee to the treasury. The factory owns the position and the hook blocks every removal.

At creation, `quoteCurrency = address(0)` selects native currency; ERC-20 quote assets require prior approval for `quoteAmount`. `liquidityTokenAmount` and `quoteAmount` are maximum budgets, and unused amounts are refunded. `sqrtPriceX96` encodes currency1 per currency0 after the factory sorts the two token addresses; the factory uses a full-range position at 60-tick spacing.

Uniswap v4 core is pinned to the official `v4.0.0` release. The hook uses v4 custom return-delta accounting for protocol/creator fees; it does not treat Glidepath fees as LP fees. Exact-input/output swaps that specify the quote asset are charged in `beforeSwap` and must fill fully; a price-limited partial fill reverts so the hook never charges for an untraded amount. When quote is the output asset of an exact-output trade, the fee is grossed up to leave the requested net output. Fees accrue by quote currency and are withdrawn by each recipient through `claimFees`. Uniswap core files carry per-file licenses; the source imports are restricted to MIT-licensed interfaces, types, and helper libraries.

The `lib/v4-core` submodule and `foundry.lock` pin the dependency. From the repository root, copy `.env.example` to `contracts/.env` and set `RHC_RPC_URL`, `DEPLOYER_PRIVATE_KEY`, `POOL_MANAGER_ADDRESS`, `PLATFORM_TREASURY`, and `LAUNCH_FEE_WEI`. Then run these commands from `contracts/`:

```sh
git submodule update --init --recursive
forge build
forge script script/Deploy.s.sol:DeployGlidepath --rpc-url robinhood --broadcast
```

The deployment script mines a CREATE2 hook address with the required permission bits, predicts the matching factory CREATE address, and deploys both through a small helper.

This is an initial implementation, not audited. Add launch-flow and accounting tests and complete a security review before deploying with real funds.
