// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Stage-one buy-only anti-snipe schedule math.
/// @dev Rates use Uniswap fee pips: 1_000_000 pips = 100%.
library GlidepathSnipe {
    uint24 internal constant QUICK_START_PIPS = 990_000; // 99%
    uint24 internal constant MIN_LONG_START_PIPS = 250_000; // 25%
    uint32 internal constant QUICK_DURATION_SECONDS = 3;
    uint32 internal constant MIN_LONG_DURATION_SECONDS = 30;
    uint32 internal constant MAX_LONG_DURATION_SECONDS = 300;

    error InvalidOffConfiguration();
    error InvalidQuickConfiguration();
    error InvalidLongStartRate(uint24 startPips);
    error InvalidLongDuration(uint32 durationSeconds);

    enum Mode {
        Off,
        Quick,
        Long
    }

    struct Config {
        Mode mode;
        uint24 startPips;
        uint32 durationSeconds;
    }

    function validate(Config memory config) internal pure {
        if (config.mode == Mode.Off) {
            if (config.startPips != 0 || config.durationSeconds != 0) {
                revert InvalidOffConfiguration();
            }
        } else if (config.mode == Mode.Quick) {
            if (
                config.startPips != QUICK_START_PIPS
                    || config.durationSeconds != QUICK_DURATION_SECONDS
            ) revert InvalidQuickConfiguration();
        } else {
            if (config.startPips < MIN_LONG_START_PIPS || config.startPips > QUICK_START_PIPS) {
                revert InvalidLongStartRate(config.startPips);
            }
            if (
                config.durationSeconds < MIN_LONG_DURATION_SECONDS
                    || config.durationSeconds > MAX_LONG_DURATION_SECONDS
            ) revert InvalidLongDuration(config.durationSeconds);
        }
    }

    /// @notice Return the effective buy tax including the snipe overlay.
    /// @dev The snipe rate replaces the normal tax while it is higher; the two
    ///      taxes are never added. Sell paths must not call this function.
    function effectiveBuyTax(
        Config memory config,
        uint64 tradingOpensAt,
        uint64 timestamp,
        uint24 normalTaxPips
    ) internal pure returns (uint24) {
        if (config.mode == Mode.Off || timestamp >= tradingOpensAt + config.durationSeconds) {
            return normalTaxPips;
        }

        uint256 elapsed;
        if (timestamp > tradingOpensAt) elapsed = timestamp - tradingOpensAt;
        uint256 remaining = uint256(config.durationSeconds) - elapsed;

        uint256 snipePips;
        if (config.mode == Mode.Quick) {
            snipePips = (uint256(config.startPips) * remaining) / config.durationSeconds;
        } else {
            uint256 excess = config.startPips > normalTaxPips
                ? uint256(config.startPips) - normalTaxPips
                : 0;
            snipePips = uint256(normalTaxPips) + (excess * remaining) / config.durationSeconds;
        }

        return snipePips > normalTaxPips ? uint24(snipePips) : normalTaxPips;
    }
}
