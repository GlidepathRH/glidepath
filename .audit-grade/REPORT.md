# Glidepath Contract Review — 2026-11-15

**Result: scoped pre-audit review; no numerical audit-grade score assigned.** The supplied audit-grade v2 workflow defaults to a full Pashov three-pass/x-ray run on a first audit. This runtime did not provide the Pashov 12-agent orchestration or the x-ray TodoWrite workflow. Two independent read-only contract reviews and the applicable repository, CI, backend and deployment checks were completed; this is not equivalent to the required full workflow.

Audited working tree was dirty relative to commit `05bf0253f0ce93779bdf7aa04e274e9596e0a10d`; the changes in the factory, tests, README and environment example were included. The findings below apply to this working tree, not that base commit.

## Contract findings

No confirmed exploitable vulnerability was reported by either independent Solidity review. Both traced the optional creator first buy through launch validation, PoolManager unlock, exact-output swap, standard hook taxation, quote-budget enforcement, token delivery and event emission.

The first-buy controls reviewed are: amount and budget must both be zero or nonzero; requested tokens are capped at 5% of supply; launch is rejected until trading is open; exact output must fill within the quote budget; any failure reverts the launch transaction; unused quote is refunded; creator receives the output; and actual quote spend is emitted. The first buy is subject to normal and snipe taxes. This conclusion is limited to manual review and local integration tests; it is not a formal proof or independent professional audit.

## Verification evidence

- Isolated Foundry run: 19 passed, 0 failed; `forge fmt --check` passed. Outputs: `runs/20261115-201712/forge-test.txt`, `forge-fmt.txt`.
- Isolated coverage: 89.4% line coverage over production source files (456/510 lines; excludes deployment script); total including script was 82.32%. Output: `runs/20261115-201712/forge-coverage.txt`.
- Robinhood public RPC returned chain ID `0x1237` (4663); configured PoolManager returned 24,009 bytes of runtime code. Responses: `rpc-chainid.json`, `rpc-poolmanager-code.json`. No Glidepath contracts are deployed, so only pre-deployment readiness was checked.
- Gitleaks scanned 10 commits and found no leaks. Output: `gitleaks.txt`.
- `actionlint` passed. `zizmor` and Semgrep flagged six mutable GitHub Action references across the workflows, missing explicit least-privilege workflow permissions, and checkout credential persistence. These are repository-hardening leads; no reachable deployment key was found in those jobs. See `zizmor.txt` and `semgrep.json`.
- `osv-scanner` returned “No package sources found”; this is not a clean dependency advisory result. Slither and Aderyn were unavailable. No stateful invariant or mutation campaign was run.
- Studio checks found no P1 exit-gating issue. P8 trust-boundary documentation is missing/outdated in the root README and `SECURITY.md`; the local cross-brand registry check was skipped because its registry file is absent.

## Remaining work before treating this as a complete audit

1. Run the supplied Pashov solidity-auditor workflow for three passes with memory, plus its x-ray and independent check stages.
2. Add stateful invariant tests for launch funding/refunds, PoolManager deltas, fee accrual/claims and fixed-supply conservation; add mutation testing.
3. Run Slither/Aderyn and a dependency scan that understands the Foundry dependency graph.
4. Pin every GitHub Action to a full commit SHA, set minimal workflow permissions, disable checkout credential persistence where appropriate, and add CI secret scanning.
5. Add a manifest-driven post-deployment assertion script and operations/monitoring runbook before deployment; update the root architecture and trust-boundary docs.

## Deployment readiness

The Robinhood public RPC configured for read-only use is `https://rpc.mainnet.chain.robinhood.com`. Robinhood documents that public endpoints are rate-limited and not recommended for production; use a provider endpoint for production deployment automation. The Uniswap v4 deployment directory lists PoolManager `0x8366a39cc670b4001a1121b8f6a443a643e40951` on Robinhood Chain. The factory also still requires the platform treasury address and chosen launch fee. No transaction was signed or broadcast.

---
AI audit review — a strong pre-audit signal, not a substitute for a human audit before large TVL.
