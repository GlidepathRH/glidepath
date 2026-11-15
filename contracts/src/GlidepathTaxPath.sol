// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice Validates and evaluates Glidepath's immutable time-based tax path.
/// @dev Rates use Uniswap fee pips: 1_000_000 pips = 100%.
library GlidepathTaxPath {
    uint24 internal constant PIPS_DENOMINATOR = 1_000_000;
    uint24 internal constant MAX_START_PIPS = 50_000; // 5%
    uint32 internal constant MAX_HOLD_SECONDS = 30 days;
    uint32 internal constant MIN_STEP_INTERVAL_SECONDS = 1 days;
    uint32 internal constant MAX_STEP_INTERVAL_SECONDS = 30 days;
    uint32 internal constant MAX_TIME_TO_FLOOR_SECONDS = 365 days;

    error StartRateTooHigh(uint24 ratePips);
    error FloorAboveStart(uint24 floorPips, uint24 startPips);
    error FlatPathHasSchedule();
    error GlidePathNeedsLowerFloor();
    error HoldTooLong(uint32 holdSeconds);
    error InvalidStepInterval(uint32 intervalSeconds);
    error FloorTakesTooLong(uint256 durationSeconds);
    error CreatorCutMustNotIncrease(uint24 currentCeilingPips, uint24 newCeilingPips);

    struct Path {
        uint24 startPips;
        uint24 floorPips;
        uint24 stepPips;
        uint32 holdSeconds;
        uint32 stepIntervalSeconds;
    }

    /// @notice Enforce the stage-one flat/glide path constraints.
    function validate(Path memory path) internal pure {
        if (path.startPips > MAX_START_PIPS) revert StartRateTooHigh(path.startPips);
        if (path.floorPips > path.startPips) {
            revert FloorAboveStart(path.floorPips, path.startPips);
        }

        if (path.stepPips == 0) {
            if (
                path.holdSeconds != 0 || path.stepIntervalSeconds != 0
                    || path.floorPips != path.startPips
            ) revert FlatPathHasSchedule();
            return;
        }

        if (path.floorPips == path.startPips) revert GlidePathNeedsLowerFloor();
        if (path.holdSeconds > MAX_HOLD_SECONDS) revert HoldTooLong(path.holdSeconds);
        if (
            path.stepIntervalSeconds < MIN_STEP_INTERVAL_SECONDS
                || path.stepIntervalSeconds > MAX_STEP_INTERVAL_SECONDS
        ) revert InvalidStepInterval(path.stepIntervalSeconds);

        uint256 rateDrop = uint256(path.startPips) - path.floorPips;
        uint256 numberOfSteps = (rateDrop + path.stepPips - 1) / path.stepPips;
        // The first reduction occurs as soon as the hold ends. Later reductions
        // occur at each interval, so the final step is (steps - 1) intervals later.
        uint256 durationToFloor = uint256(path.holdSeconds)
            + ((numberOfSteps - 1) * path.stepIntervalSeconds);
        if (durationToFloor > MAX_TIME_TO_FLOOR_SECONDS) {
            revert FloorTakesTooLong(durationToFloor);
        }
    }

    /// @notice Return the scheduled rate at `timestamp`, before a creator cut.
    function rateAt(Path memory path, uint64 launchTime, uint64 timestamp)
        internal
        pure
        returns (uint24)
    {
        if (path.stepPips == 0 || timestamp < launchTime) return path.startPips;

        uint256 elapsed = uint256(timestamp) - launchTime;
        if (elapsed < path.holdSeconds) return path.startPips;

        uint256 steps = 1 + (elapsed - path.holdSeconds) / path.stepIntervalSeconds;
        uint256 reduction = steps * path.stepPips;
        if (reduction >= path.startPips - path.floorPips) return path.floorPips;
        return uint24(uint256(path.startPips) - reduction);
    }

    /// @notice Apply the creator's current ceiling to the immutable schedule.
    function effectiveRate(Path memory path, uint64 launchTime, uint64 timestamp, uint24 creatorCeilingPips)
        internal
        pure
        returns (uint24)
    {
        uint24 scheduled = rateAt(path, launchTime, timestamp);
        return creatorCeilingPips < scheduled ? creatorCeilingPips : scheduled;
    }

    /// @notice A creator ceiling can only move downward.
    function validateCreatorCut(uint24 currentCeilingPips, uint24 newCeilingPips)
        internal
        pure
    {
        if (newCeilingPips > currentCeilingPips) {
            revert CreatorCutMustNotIncrease(currentCeilingPips, newCeilingPips);
        }
    }
}
