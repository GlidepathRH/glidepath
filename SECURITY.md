# Security Policy

## Scope

The in-scope project is Glidepath source code and any deployment explicitly operated by Glidepath. Third-party tokens, unrelated pools, wallets, and infrastructure are out of scope.

## Reporting

Email **glidepath@atomicmail.io** with the affected component, impact, reproduction steps, and any suggested fix. Do not publish a vulnerability or exploit details before a fix is available. We aim to acknowledge reports within 48 hours and prioritize critical fixes within 7 days.

Good-faith research is welcome; we will not pursue legal action for responsible testing that avoids harm to users or services. We will credit reporters who want attribution.

## Likely attack surfaces

- Tax schedule arithmetic, rounding, and attempts to increase a rate through time or milestone transitions.
- Hook callback and PoolManager integration, including reentrancy and incorrect fee accounting.
- Creator fee destinations, launch configuration, and payout accounting.
- Market-cap milestone manipulation and time-weighted price observations.
- Wallet signing, transaction construction, and API-to-chain data mismatches.

## Contract status

The contract scaffold is abstract and non-deployable. There are no production contract addresses yet. No security audit has been completed.
