// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {GlidepathFeeMath} from "../src/GlidepathFeeMath.sol";
import {GlidepathSnipe} from "../src/GlidepathSnipe.sol";
import {GlidepathTaxPath} from "../src/GlidepathTaxPath.sol";

contract GlidepathSchedulesTest is Test {
    uint64 private constant LAUNCH_TIME = 1_700_000_000;

    function testGlideDropsAtHoldEndAndOnIntervalsUntilFloor() public pure {
        GlidepathTaxPath.Path memory path = GlidepathTaxPath.Path({
            startPips: 30_000, floorPips: 10_000, stepPips: 5_000, holdSeconds: 2 days, stepIntervalSeconds: 7 days
        });

        GlidepathTaxPath.validate(path);
        assertEq(GlidepathTaxPath.rateAt(path, LAUNCH_TIME, LAUNCH_TIME + 2 days - 1), 30_000);
        assertEq(GlidepathTaxPath.rateAt(path, LAUNCH_TIME, LAUNCH_TIME + 2 days), 25_000);
        assertEq(GlidepathTaxPath.rateAt(path, LAUNCH_TIME, LAUNCH_TIME + 9 days), 20_000);
        assertEq(GlidepathTaxPath.rateAt(path, LAUNCH_TIME, LAUNCH_TIME + 23 days), 10_000);
    }

    function testCreatorCeilingCanOnlyLowerScheduledRate() public pure {
        GlidepathTaxPath.Path memory path = GlidepathTaxPath.Path({
            startPips: 30_000, floorPips: 10_000, stepPips: 5_000, holdSeconds: 2 days, stepIntervalSeconds: 7 days
        });

        assertEq(GlidepathTaxPath.effectiveRate(path, LAUNCH_TIME, LAUNCH_TIME, 20_000), 20_000);
        assertEq(GlidepathTaxPath.effectiveRate(path, LAUNCH_TIME, LAUNCH_TIME + 9 days, 25_000), 20_000);
    }

    function testFlatPathCannotCarryGlideParameters() public {
        GlidepathTaxPath.Path memory path = GlidepathTaxPath.Path({
            startPips: 10_000, floorPips: 10_000, stepPips: 1, holdSeconds: 0, stepIntervalSeconds: 1 days
        });
        vm.expectRevert(GlidepathTaxPath.GlidePathNeedsLowerFloor.selector);
        this.validatePath(path);
    }

    function validatePath(GlidepathTaxPath.Path calldata path) external pure {
        GlidepathTaxPath.validate(path);
    }

    function testQuickSnipeFallsToNormalTaxAtThreeSeconds() public pure {
        GlidepathSnipe.Config memory config =
            GlidepathSnipe.Config({mode: GlidepathSnipe.Mode.Quick, startPips: 990_000, durationSeconds: 3});
        GlidepathSnipe.validate(config);
        assertEq(GlidepathSnipe.effectiveBuyTax(config, LAUNCH_TIME, LAUNCH_TIME, 10_000), 990_000);
        assertEq(GlidepathSnipe.effectiveBuyTax(config, LAUNCH_TIME, LAUNCH_TIME + 1, 10_000), 660_000);
        assertEq(GlidepathSnipe.effectiveBuyTax(config, LAUNCH_TIME, LAUNCH_TIME + 3, 10_000), 10_000);
    }

    function testLongSnipeInterpolatesTowardNormalTax() public pure {
        GlidepathSnipe.Config memory config =
            GlidepathSnipe.Config({mode: GlidepathSnipe.Mode.Long, startPips: 990_000, durationSeconds: 60});
        GlidepathSnipe.validate(config);
        assertEq(GlidepathSnipe.effectiveBuyTax(config, LAUNCH_TIME, LAUNCH_TIME + 30, 10_000), 500_000);
        assertEq(GlidepathSnipe.effectiveBuyTax(config, LAUNCH_TIME, LAUNCH_TIME + 60, 10_000), 10_000);
    }

    function testNormalAndSnipeSplitsMatchProductShares() public pure {
        GlidepathFeeMath.Split memory normal = GlidepathFeeMath.normalTaxSplit(30_000);
        assertEq(normal.platformPips, 4_000);
        assertEq(normal.creatorPips, 26_000);

        GlidepathFeeMath.Split memory snipe = GlidepathFeeMath.snipeTaxSplit(990_000);
        assertEq(snipe.platformPips, 99_000);
        assertEq(snipe.creatorPips, 891_000);
    }
}
