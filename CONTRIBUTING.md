# Contributing

Glidepath is at the scaffold stage. Contributions that define the hook and launch invariants, API data model, and wallet-connected launch flow are useful. Do not present the current contract scaffold as a working launchpad.

## Setup

Install Bun and PostgreSQL for app work. Install Foundry for contract work. Follow the root README to install each workspace and configure local environment files. Keep secrets out of source control and do not add `.env` files.

## Workflow

Work on a focused branch and open a pull request against the private repository. Keep each pull request to one concern, describe user-visible behavior and security assumptions, and include the relevant check output. Contract changes should explain which invariants they enforce and include tests before they are considered deployable.

Ask for an issue first for changes to tax arithmetic, fee recipients, launch protections, or public API guarantees. Avoid committing generated build output, deployment secrets, or internal product planning to the public mirror.

Use imperative, plain-English commit subjects. Report bugs with the setup or action, expected result, actual result, and reproduction steps. Report vulnerabilities privately using [SECURITY.md](SECURITY.md), not a public issue.
