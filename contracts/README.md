# Contracts

Foundry workspace for Glidepath's Uniswap v4 hook and launch contracts on Robinhood Chain (chain ID 4663).

`src/GlidepathHook.sol` is deliberately abstract and non-deployable. It marks the intended boundary only; it does not implement v4 callbacks, the monotonic tax path, anti-snipe, fee distribution, launch creation, or liquidity locking. The next implementation step is to pin and install the Uniswap v4 core/periphery dependencies, confirm the target PoolManager address, and implement the hook permissions and invariants from the product overview.

Copy `.env.example` to `.env`, set `RHC_RPC_URL`, then use `forge build` and `forge test` after the contract dependencies and tests are added.
