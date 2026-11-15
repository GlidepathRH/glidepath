// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Glidepath's stage-one fee rates and documented revenue splits.
/// @dev Rates use Uniswap fee pips: 1_000_000 pips = 100%.
library GlidepathFeeMath {
    uint24 internal constant PIPS_DENOMINATOR = 1_000_000;
    uint24 internal constant BASE_FEE_PIPS = 3_000; // 0.3%
    uint24 internal constant PLATFORM_TAX_FIXED_PIPS = 1_000; // 0.1%
    uint24 internal constant MAX_STANDARD_TAX_PIPS = 50_000; // 5%
    uint24 internal constant MAX_SNIPE_TAX_PIPS = 990_000; // 99%
    uint24 internal constant MAX_TOTAL_BUY_FEE_PIPS = 993_000; // 99% snipe + 0.3% base

    error StandardTaxTooHigh(uint24 taxPips);
    error SnipeTaxTooHigh(uint24 taxPips);
    error TotalFeeTooHigh(uint24 feePips);

    struct Split {
        uint24 platformPips;
        uint24 creatorPips;
    }

    struct AmountSplit {
        uint128 platformAmount;
        uint128 creatorAmount;
    }

    /// @notice Split a normal creator tax: 0.1% + 10% of tax, capped at half.
    function normalTaxSplit(uint24 taxPips) internal pure returns (Split memory split) {
        if (taxPips > MAX_STANDARD_TAX_PIPS) revert StandardTaxTooHigh(taxPips);
        if (taxPips == 0) return split;

        uint256 platformShare = PLATFORM_TAX_FIXED_PIPS + (uint256(taxPips) / 10);
        uint256 halfTax = uint256(taxPips) / 2;
        if (platformShare > halfTax) platformShare = halfTax;

        split.platformPips = uint24(platformShare);
        split.creatorPips = taxPips - split.platformPips;
    }

    /// @notice Split an active snipe tax 10% to Glidepath and 90% to creator.
    function snipeTaxSplit(uint24 snipeTaxPips) internal pure returns (Split memory split) {
        if (snipeTaxPips > MAX_SNIPE_TAX_PIPS) revert SnipeTaxTooHigh(snipeTaxPips);
        split.platformPips = snipeTaxPips / 10;
        split.creatorPips = snipeTaxPips - split.platformPips;
    }

    /// @notice Calculate total pool-hook fee, with the snipe rate replacing normal tax.
    function totalBuyFeePips(uint24 normalTaxPips, uint24 snipeTaxPips) internal pure returns (uint24) {
        uint24 taxPips = snipeTaxPips > normalTaxPips ? snipeTaxPips : normalTaxPips;
        if (taxPips > MAX_SNIPE_TAX_PIPS) revert SnipeTaxTooHigh(taxPips);
        uint24 total = BASE_FEE_PIPS + taxPips;
        if (total > MAX_TOTAL_BUY_FEE_PIPS) revert TotalFeeTooHigh(total);
        return total;
    }

    /// @notice Calculate the sell hook fee; snipe tax never applies to sells.
    function totalSellFeePips(uint24 normalTaxPips) internal pure returns (uint24) {
        if (normalTaxPips > MAX_STANDARD_TAX_PIPS) revert StandardTaxTooHigh(normalTaxPips);
        uint24 total = BASE_FEE_PIPS + normalTaxPips;
        if (total > BASE_FEE_PIPS + MAX_STANDARD_TAX_PIPS) revert TotalFeeTooHigh(total);
        return total;
    }

    /// @notice Split an already calculated base fee plus tax into platform and creator amounts.
    /// @dev `snipeTax` selects the separate 10/90 split for the tax component.
    function splitCollectedFee(uint128 totalFee, uint24 taxPips, bool snipeTax)
        internal
        pure
        returns (AmountSplit memory amounts)
    {
        uint24 totalPips = BASE_FEE_PIPS + taxPips;
        if (totalPips > MAX_TOTAL_BUY_FEE_PIPS) revert TotalFeeTooHigh(totalPips);
        if (taxPips == 0) {
            amounts.platformAmount = totalFee;
            return amounts;
        }

        Split memory rateSplit = snipeTax ? snipeTaxSplit(taxPips) : normalTaxSplit(taxPips);
        uint256 platformPips = BASE_FEE_PIPS + rateSplit.platformPips;
        amounts.platformAmount = uint128((uint256(totalFee) * platformPips) / totalPips);
        amounts.creatorAmount = totalFee - amounts.platformAmount;
    }

    /// @notice Fee amount for a Uniswap v4 delta-sized trade amount.
    /// @dev A v4 BalanceDelta amount is int128, so the multiplication fits uint256.
    function amountForRate(uint128 amount, uint24 ratePips) internal pure returns (uint128) {
        return uint128((uint256(amount) * ratePips) / PIPS_DENOMINATOR);
    }

    /// @notice Fee needed to deduct `ratePips` from a gross quote output while
    ///         leaving `netAmount` for an exact-output trader.
    function amountForRateOnNet(uint128 netAmount, uint24 ratePips) internal pure returns (uint128) {
        if (ratePips == 0 || netAmount == 0) return 0;
        uint256 denominator = PIPS_DENOMINATOR - ratePips;
        uint256 numerator = uint256(netAmount) * ratePips;
        return uint128((numerator + denominator - 1) / denominator);
    }
}
