// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {GlidepathHook} from "../src/GlidepathHook.sol";
import {GlidepathLaunchFactory} from "../src/GlidepathLaunchFactory.sol";
import {GlidepathSnipe} from "../src/GlidepathSnipe.sol";
import {GlidepathTaxPath} from "../src/GlidepathTaxPath.sol";
import {GlidepathToken} from "../src/GlidepathToken.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {TestERC20} from "v4-core/test/TestERC20.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {IERC20Minimal} from "v4-core/interfaces/external/IERC20Minimal.sol";

contract TestCreate2Deployer {
    function deployCreate2(bytes memory initCode, bytes32 salt) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        require(deployed != address(0), "CREATE2 failed");
    }

    function deploy(bytes memory initCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), "CREATE failed");
    }
}

contract HookSwapRouter is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using TransientStateLibrary for IPoolManager;

    IPoolManager public immutable manager;

    struct SwapRequest {
        address trader;
        PoolKey key;
        IPoolManager.SwapParams params;
    }

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function swap(PoolKey calldata key, IPoolManager.SwapParams calldata params) external returns (BalanceDelta delta) {
        delta = abi.decode(manager.unlock(abi.encode(SwapRequest(msg.sender, key, params))), (BalanceDelta));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "only manager");
        SwapRequest memory request = abi.decode(data, (SwapRequest));
        BalanceDelta delta = manager.swap(request.key, request.params, "");
        _settleOrTake(request.key.currency0, request.trader);
        _settleOrTake(request.key.currency1, request.trader);
        return abi.encode(delta);
    }

    function _settleOrTake(Currency currency, address trader) private {
        int256 delta = manager.currencyDelta(address(this), currency);
        if (delta < 0) {
            require(!currency.isAddressZero(), "native input unsupported in test router");
            manager.sync(currency);
            bool ok = IERC20Minimal(Currency.unwrap(currency)).transferFrom(trader, address(manager), uint256(-delta));
            require(ok, "input transfer failed");
            manager.settle();
        } else if (delta > 0) {
            manager.take(currency, trader, uint256(delta));
        }
    }
}

contract LiquidityRemovalAttempt is IUnlockCallback {
    IPoolManager public immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    function attempt(PoolKey calldata key) external {
        manager.unlock(abi.encode(key));
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "only manager");
        PoolKey memory key = abi.decode(data, (PoolKey));
        manager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: -887_220, tickUpper: 887_220, liquidityDelta: -1, salt: bytes32(0)
            }),
            ""
        );
        return "";
    }
}

contract GlidepathLaunchTest is Test {
    using PoolIdLibrary for PoolKey;

    uint256 private constant TOKEN_SUPPLY = 100_000 ether;
    uint256 private constant LIQUIDITY_BUDGET = 10_000 ether;
    uint256 private constant SWAP_AMOUNT = 1 ether;
    uint160 private constant INITIAL_SQRT_PRICE_X96 = uint160(1 << 96);
    address private constant CREATOR_PAYOUT = address(0xBEEF);

    PoolManager private manager;
    TestCreate2Deployer private create2Deployer;
    GlidepathHook private hook;
    GlidepathLaunchFactory private factory;
    TestERC20 private quote;
    HookSwapRouter private router;
    PoolKey private key;
    PoolId private poolId;
    GlidepathToken private token;

    function setUp() public {
        vm.warp(1_700_000_000);
        manager = PoolManager(
            _deployArtifact(vm.getCode("lib/v4-core/src/PoolManager.sol:PoolManager"), abi.encode(address(this)))
        );
        quote = new TestERC20(1_000_000_000 ether);
        router = new HookSwapRouter(manager);
        create2Deployer = new TestCreate2Deployer();

        uint64 helperNonce = vm.getNonce(address(create2Deployer));
        address predictedFactory = vm.computeCreateAddress(address(create2Deployer), uint256(helperNonce) + 1);
        bytes memory hookInitCode = abi.encodePacked(
            vm.getCode("src/GlidepathHook.sol:GlidepathHook"),
            abi.encode(IPoolManager(address(manager)), predictedFactory, address(this))
        );
        bytes32 salt = _findHookSalt(hookInitCode);
        hook = GlidepathHook(payable(create2Deployer.deployCreate2(hookInitCode, salt)));

        bytes memory factoryInitCode = abi.encodePacked(
            vm.getCode("src/GlidepathLaunchFactory.sol:GlidepathLaunchFactory"),
            abi.encode(IPoolManager(address(manager)), address(hook), address(this), 0)
        );
        factory = GlidepathLaunchFactory(create2Deployer.deploy(factoryInitCode));
        assertEq(address(factory), predictedFactory);

        (address tokenAddress, PoolId createdPoolId) = _createLaunch(_offSnipe());
        token = GlidepathToken(tokenAddress);
        poolId = createdPoolId;
        key = _poolKey(tokenAddress);
    }

    receive() external payable {}

    function testLaunchMintsFixedSupplyAndSeedsPool() public view {
        assertEq(token.totalSupply(), TOKEN_SUPPLY);
        assertGt(token.balanceOf(address(this)), 0);
        assertEq(token.balanceOf(address(factory)), 0);
        assertEq(PoolId.unwrap(factory.poolForToken(address(token))), PoolId.unwrap(poolId));
        assertEq(factory.tokenForPool(poolId), address(token));
        assertEq(address(hook.poolManager()), address(manager));
    }

    function testNativeQuoteCurrencyCanSeedLaunchPool() public {
        vm.deal(address(this), LIQUIDITY_BUDGET);
        uint256 balanceBefore = address(this).balance;
        GlidepathLaunchFactory.CreateParams memory params = _createParams(_offSnipe(), address(0));
        (address nativeToken, PoolId nativePoolId) = factory.createLaunch{value: LIQUIDITY_BUDGET}(params);
        assertEq(factory.tokenForPool(nativePoolId), nativeToken);
        assertGt(GlidepathToken(nativeToken).balanceOf(address(this)), 0);
        assertLt(address(this).balance, balanceBefore);
    }

    function testInitialPriceCannotCreateOneSidedLaunchLiquidity() public {
        GlidepathLaunchFactory.CreateParams memory params = _createParams(_offSnipe(), address(quote));
        params.name = "Out of Range";
        params.symbol = "OOR";
        params.sqrtPriceX96 = TickMath.MIN_SQRT_PRICE + 10;
        quote.approve(address(factory), params.quoteAmount);
        vm.expectRevert(GlidepathLaunchFactory.InvalidLaunchParameters.selector);
        factory.createLaunch(params);
    }

    function testBuySwapAccruesWeightedFeesAndRecipientsCanClaim() public {
        quote.approve(address(router), SWAP_AMOUNT);
        uint256 quoteBefore = quote.balanceOf(address(this));
        uint256 tokenBefore = token.balanceOf(address(this));

        router.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: Currency.unwrap(key.currency0) == address(quote),
                amountSpecified: -int256(SWAP_AMOUNT),
                sqrtPriceLimitX96: _priceLimit(Currency.unwrap(key.currency0) == address(quote))
            })
        );

        uint256 baseAndTaxFee = SWAP_AMOUNT * 13_000 / 1_000_000;
        uint256 platformAccrued = hook.claimable(address(quote), address(this));
        uint256 creatorAccrued = hook.claimable(address(quote), CREATOR_PAYOUT);
        assertEq(platformAccrued, baseAndTaxFee * 5_000 / 13_000);
        assertEq(platformAccrued + creatorAccrued, baseAndTaxFee);
        assertEq(quote.balanceOf(address(this)), quoteBefore - SWAP_AMOUNT);
        assertGt(token.balanceOf(address(this)), tokenBefore);

        hook.claimFees(address(quote));
        assertEq(quote.balanceOf(address(this)), quoteBefore - SWAP_AMOUNT + platformAccrued);
        assertEq(hook.claimable(address(quote), address(this)), 0);

        vm.prank(CREATOR_PAYOUT);
        hook.claimFees(address(quote));
        assertEq(hook.claimable(address(quote), CREATOR_PAYOUT), 0);
    }

    function testSellSwapAccruesFeesOnQuoteOutput() public {
        uint256 quoteBefore = quote.balanceOf(address(this));
        uint256 tokenBefore = token.balanceOf(address(this));
        token.approve(address(router), SWAP_AMOUNT);

        router.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: Currency.unwrap(key.currency0) == address(token),
                amountSpecified: -int256(SWAP_AMOUNT),
                sqrtPriceLimitX96: _priceLimit(Currency.unwrap(key.currency0) == address(token))
            })
        );

        uint256 accrued = hook.claimable(address(quote), address(this)) + hook.claimable(address(quote), CREATOR_PAYOUT);
        assertGt(accrued, 0);
        assertEq(token.balanceOf(address(this)), tokenBefore - SWAP_AMOUNT);
        assertGt(quote.balanceOf(address(this)), quoteBefore);
    }

    function testQuoteSpecifiedPartialFillRevertsWithoutAccruingFees() public {
        bool zeroForOne = Currency.unwrap(key.currency0) == address(quote);
        quote.approve(address(router), 100 ether);
        uint256 quoteBefore = quote.balanceOf(address(this));

        vm.expectRevert();
        router.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: -int256(100 ether),
                sqrtPriceLimitX96: zeroForOne ? INITIAL_SQRT_PRICE_X96 - 1 : INITIAL_SQRT_PRICE_X96 + 1
            })
        );

        assertEq(quote.balanceOf(address(this)), quoteBefore);
        assertEq(hook.claimable(address(quote), address(this)), 0);
        assertEq(hook.claimable(address(quote), CREATOR_PAYOUT), 0);
    }

    function testExactOutputSellLeavesRequestedQuoteAmountAfterFee() public {
        uint256 requestedQuote = 1 ether;
        uint256 quoteBefore = quote.balanceOf(address(this));
        token.approve(address(router), type(uint256).max);

        router.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: Currency.unwrap(key.currency0) == address(token),
                amountSpecified: int256(requestedQuote),
                sqrtPriceLimitX96: _priceLimit(Currency.unwrap(key.currency0) == address(token))
            })
        );

        assertEq(quote.balanceOf(address(this)) - quoteBefore, requestedQuote);
        assertGt(hook.claimable(address(quote), address(this)) + hook.claimable(address(quote), CREATOR_PAYOUT), 0);
    }

    function testLiquidityRemovalAlwaysReverts() public {
        LiquidityRemovalAttempt remover = new LiquidityRemovalAttempt(manager);
        vm.expectRevert();
        remover.attempt(key);
    }

    function testCreatorCanEndSnipeAndCannotRaiseTaxCeiling() public {
        (, PoolId snipePoolId) = _createLaunch(
            GlidepathSnipe.Config({mode: GlidepathSnipe.Mode.Quick, startPips: 990_000, durationSeconds: 3})
        );
        assertEq(hook.buyTaxNow(snipePoolId), 990_000);

        hook.endSnipeEarly(snipePoolId);
        assertEq(hook.buyTaxNow(snipePoolId), 10_000);
        hook.lowerCreatorTaxCeiling(snipePoolId, true, 0);
        assertEq(hook.buyTaxNow(snipePoolId), 0);

        vm.expectRevert(
            abi.encodeWithSelector(GlidepathTaxPath.CreatorCutMustNotIncrease.selector, uint24(0), uint24(1))
        );
        hook.lowerCreatorTaxCeiling(snipePoolId, true, 1);
    }

    function testTokenHasNoMintEntrypoint() public {
        (bool success,) = address(token).call(abi.encodeWithSignature("mint(address,uint256)", address(this), 1));
        assertFalse(success);
    }

    function _createLaunch(GlidepathSnipe.Config memory snipe)
        private
        returns (address tokenAddress, PoolId createdPoolId)
    {
        GlidepathLaunchFactory.CreateParams memory params = _createParams(snipe, address(quote));
        quote.approve(address(factory), params.quoteAmount);
        return factory.createLaunch(params);
    }

    function _createParams(GlidepathSnipe.Config memory snipe, address quoteCurrency)
        private
        view
        returns (GlidepathLaunchFactory.CreateParams memory params)
    {
        GlidepathTaxPath.Path memory path = GlidepathTaxPath.Path({
            startPips: 10_000, floorPips: 10_000, stepPips: 0, holdSeconds: 0, stepIntervalSeconds: 0
        });
        params.name = "Glidepath Test";
        params.symbol = "GLIDE-T";
        params.totalSupply = TOKEN_SUPPLY;
        params.liquidityTokenAmount = LIQUIDITY_BUDGET;
        params.quoteCurrency = quoteCurrency;
        params.quoteAmount = LIQUIDITY_BUDGET;
        params.sqrtPriceX96 = INITIAL_SQRT_PRICE_X96;
        params.tradingOpensAt = uint64(block.timestamp);
        params.buyPath = path;
        params.sellPath = path;
        params.snipe = snipe;
        params.payoutRecipients[0] = CREATOR_PAYOUT;
        params.payoutWeightsBps[0] = 10_000;
    }

    function _offSnipe() private pure returns (GlidepathSnipe.Config memory) {
        return GlidepathSnipe.Config({mode: GlidepathSnipe.Mode.Off, startPips: 0, durationSeconds: 0});
    }

    function _poolKey(address tokenAddress) private view returns (PoolKey memory) {
        Currency tokenCurrency = Currency.wrap(tokenAddress);
        Currency quoteCurrency = Currency.wrap(address(quote));
        bool tokenIsCurrency0 = tokenAddress < address(quote);
        return PoolKey({
            currency0: tokenIsCurrency0 ? tokenCurrency : quoteCurrency,
            currency1: tokenIsCurrency0 ? quoteCurrency : tokenCurrency,
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function _priceLimit(bool zeroForOne) private pure returns (uint160) {
        return zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1;
    }

    function _findHookSalt(bytes memory initCode) private view returns (bytes32 salt) {
        bytes32 initCodeHash = keccak256(initCode);
        uint160 mask = (1 << 14) - 1;
        for (uint256 i; i < 100_000; ++i) {
            bytes32 candidate = bytes32(i);
            address candidateAddress = address(
                uint160(
                    uint256(
                        keccak256(abi.encodePacked(bytes1(0xff), address(create2Deployer), candidate, initCodeHash))
                    )
                )
            );
            if (uint160(candidateAddress) & mask == 0x2acc) return candidate;
        }
        revert("hook address salt not found");
    }

    function _deployArtifact(bytes memory creationCode, bytes memory args) private returns (address deployed) {
        bytes memory initCode = abi.encodePacked(creationCode, args);
        assembly ("memory-safe") {
            deployed := create(0, add(initCode, 0x20), mload(initCode))
        }
        require(deployed != address(0), "artifact deploy failed");
    }
}
