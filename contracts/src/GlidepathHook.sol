// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Non-deployable scaffold for Glidepath's Uniswap v4 pool hook.
/// @dev Hook permissions, PoolManager integration, fee accounting, and tax-path
///      enforcement are intentionally not implemented in this scaffold.
abstract contract GlidepathHook {
    address public immutable poolManager;

    constructor(address poolManager_) {
        require(poolManager_ != address(0), "zero pool manager");
        poolManager = poolManager_;
    }
}
