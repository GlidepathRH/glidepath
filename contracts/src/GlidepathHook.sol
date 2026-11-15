// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {GlidepathFeeMath} from "./GlidepathFeeMath.sol";
import {GlidepathSnipe} from "./GlidepathSnipe.sol";
import {GlidepathTaxPath} from "./GlidepathTaxPath.sol";

/// @notice Enforces stage-one Glidepath tax paths and collects quote-asset fees.
/// @dev Deploy only to an address whose low bits match getHookPermissions().
///      A launch factory and initial liquidity flow must be connected before use.
contract GlidepathHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;

    uint16 public constant CREATOR_SHARE_DENOMINATOR = 10_000;

    error NotPoolManager();
    error NotLaunchFactory();
    error NotCreator();
    error PoolAlreadyRegistered(PoolId poolId);
    error UnknownPool(PoolId poolId);
    error InvalidPoolKey();
    error InvalidPayoutRecipients();
    error StartRatesDifferTooMuch(uint24 buyStartPips, uint24 sellStartPips);
    error TradingNotOpen(uint64 tradingOpensAt, uint64 currentTime);
    error LiquidityIsPermanentlyLocked();
    error QuoteSpecifiedSwapWasPartial(uint128 expected, uint128 actual);
    error SwapAmountTooLarge(uint256 amount);
    error FeeDeltaTooLarge(uint256 amount);
    error NothingToClaim();
    error ReentrantClaim();
    error UnexpectedNativeTransfer();
    error UnsupportedHookCallback();

    event PoolRegistered(PoolId indexed poolId, address indexed creator, address token, address quoteCurrency);
    event CreatorTaxCeilingLowered(PoolId indexed poolId, bool indexed isBuy, uint24 previousPips, uint24 newPips);
    event FeeAccrued(
        PoolId indexed poolId,
        address indexed quoteCurrency,
        uint128 totalAmount,
        uint128 platformAmount,
        uint128 creatorAmount,
        uint24 taxPips,
        bool snipeTax
    );
    event FeesClaimed(address indexed recipient, address indexed currency, uint256 amount);

    struct LaunchConfig {
        bool registered;
        address creator;
        Currency tokenCurrency;
        Currency quoteCurrency;
        uint64 tradingOpensAt;
        GlidepathTaxPath.Path buyPath;
        GlidepathTaxPath.Path sellPath;
        uint24 creatorBuyCeilingPips;
        uint24 creatorSellCeilingPips;
        GlidepathSnipe.Config snipe;
        address[3] payoutRecipients;
        uint16[3] payoutWeightsBps;
        uint8 lastPayoutRecipient;
    }

    struct PendingQuoteSwap {
        bool validateFullFill;
        uint128 expectedSpecifiedAmount;
    }

    IPoolManager public immutable poolManager;
    address public immutable launchFactory;
    address public immutable platformTreasury;

    mapping(PoolId poolId => LaunchConfig config) private _launches;
    mapping(PoolId poolId => PendingQuoteSwap pending) private _pendingQuoteSwaps;
    mapping(address currency => mapping(address recipient => uint256 amount)) public claimable;
    uint256 private _claimLock = 1;

    constructor(IPoolManager poolManager_, address launchFactory_, address platformTreasury_) {
        if (address(poolManager_) == address(0) || launchFactory_ == address(0) || platformTreasury_ == address(0)) {
            revert InvalidPoolKey();
        }
        poolManager = poolManager_;
        launchFactory = launchFactory_;
        platformTreasury = platformTreasury_;
        Hooks.validateHookPermissions(IHooks(address(this)), getHookPermissions());
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /// @notice Hook callbacks are encoded in the low permission bits of its address.
    function getHookPermissions() public pure returns (Hooks.Permissions memory permissions) {
        permissions.beforeInitialize = true;
        permissions.beforeAddLiquidity = true;
        permissions.beforeRemoveLiquidity = true;
        permissions.beforeSwap = true;
        permissions.afterSwap = true;
        permissions.beforeSwapReturnDelta = true;
        permissions.afterSwapReturnDelta = true;
    }

    /// @notice Register immutable launch terms before the factory initializes the pool.
    function registerPool(
        PoolKey calldata key,
        Currency tokenCurrency,
        Currency quoteCurrency,
        address creator,
        uint64 tradingOpensAt,
        GlidepathTaxPath.Path calldata buyPath,
        GlidepathTaxPath.Path calldata sellPath,
        GlidepathSnipe.Config calldata snipe,
        address[3] calldata payoutRecipients,
        uint16[3] calldata payoutWeightsBps
    ) external {
        if (msg.sender != launchFactory) revert NotLaunchFactory();
        PoolId poolId = key.toId();
        if (_launches[poolId].registered) revert PoolAlreadyRegistered(poolId);
        if (key.hooks != IHooks(address(this)) || key.fee != 0 || creator == address(0)) {
            revert InvalidPoolKey();
        }

        address currency0 = Currency.unwrap(key.currency0);
        address currency1 = Currency.unwrap(key.currency1);
        address tokenAddress = Currency.unwrap(tokenCurrency);
        address quoteAddress = Currency.unwrap(quoteCurrency);
        if (
            tokenAddress == quoteAddress
                || !(
                    (tokenAddress == currency0 && quoteAddress == currency1)
                        || (tokenAddress == currency1 && quoteAddress == currency0)
                )
        ) revert InvalidPoolKey();

        GlidepathTaxPath.Path memory buy = buyPath;
        GlidepathTaxPath.Path memory sell = sellPath;
        GlidepathSnipe.Config memory snipeConfig = snipe;
        GlidepathTaxPath.validate(buy);
        GlidepathTaxPath.validate(sell);
        GlidepathSnipe.validate(snipeConfig);

        uint24 rateGap = buy.startPips > sell.startPips
            ? buy.startPips - sell.startPips
            : sell.startPips - buy.startPips;
        if (rateGap > 20_000) revert StartRatesDifferTooMuch(buy.startPips, sell.startPips);

        uint256 weightTotal;
        uint8 lastRecipient;
        bool foundRecipient;
        for (uint256 i; i < payoutRecipients.length; ++i) {
            address recipient = payoutRecipients[i];
            uint16 weight = payoutWeightsBps[i];
            if ((recipient == address(0)) != (weight == 0)) revert InvalidPayoutRecipients();
            if (recipient != address(0)) {
                for (uint256 j; j < i; ++j) {
                    if (payoutRecipients[j] == recipient) revert InvalidPayoutRecipients();
                }
                weightTotal += weight;
                lastRecipient = uint8(i);
                foundRecipient = true;
            }
        }
        if (!foundRecipient || weightTotal != CREATOR_SHARE_DENOMINATOR) {
            revert InvalidPayoutRecipients();
        }

        LaunchConfig storage config = _launches[poolId];
        config.registered = true;
        config.creator = creator;
        config.tokenCurrency = tokenCurrency;
        config.quoteCurrency = quoteCurrency;
        config.tradingOpensAt = tradingOpensAt;
        config.buyPath = buy;
        config.sellPath = sell;
        config.creatorBuyCeilingPips = buy.startPips;
        config.creatorSellCeilingPips = sell.startPips;
        config.snipe = snipeConfig;
        config.payoutRecipients = payoutRecipients;
        config.payoutWeightsBps = payoutWeightsBps;
        config.lastPayoutRecipient = lastRecipient;

        emit PoolRegistered(poolId, creator, tokenAddress, quoteAddress);
    }

    /// @notice Creator may lower either current ceiling, never raise it.
    function lowerCreatorTaxCeiling(PoolId poolId, bool isBuy, uint24 newCeilingPips) external {
        LaunchConfig storage config = _launch(poolId);
        if (msg.sender != config.creator) revert NotCreator();

        uint24 current = isBuy ? config.creatorBuyCeilingPips : config.creatorSellCeilingPips;
        GlidepathTaxPath.validateCreatorCut(current, newCeilingPips);
        if (isBuy) config.creatorBuyCeilingPips = newCeilingPips;
        else config.creatorSellCeilingPips = newCeilingPips;
        emit CreatorTaxCeilingLowered(poolId, isBuy, current, newCeilingPips);
    }

    /// @notice Current buy tax, including an active snipe overlay.
    function buyTaxNow(PoolId poolId) external view returns (uint24) {
        LaunchConfig storage config = _launch(poolId);
        uint24 normal = _normalTax(config, true, uint64(block.timestamp));
        return GlidepathSnipe.effectiveBuyTax(
            config.snipe, config.tradingOpensAt, uint64(block.timestamp), normal
        );
    }

    /// @notice Current sell tax. Snipe protection is buy-only.
    function sellTaxNow(PoolId poolId) external view returns (uint24) {
        return _normalTax(_launch(poolId), false, uint64(block.timestamp));
    }

    function launchConfig(PoolId poolId) external view returns (LaunchConfig memory) {
        return _launch(poolId);
    }

    /// @notice Withdraw accrued platform or creator proceeds in their original quote currency.
    function claimFees(address currencyAddress) external {
        if (_claimLock != 1) revert ReentrantClaim();
        _claimLock = 2;

        uint256 amount = claimable[currencyAddress][msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[currencyAddress][msg.sender] = 0;
        Currency.wrap(currencyAddress).transfer(msg.sender, amount);

        _claimLock = 1;
        emit FeesClaimed(msg.sender, currencyAddress, amount);
    }

    receive() external payable {
        if (msg.sender != address(poolManager)) revert UnexpectedNativeTransfer();
    }

    function beforeInitialize(address sender, PoolKey calldata key, uint160)
        external
        onlyPoolManager
        returns (bytes4)
    {
        if (sender != launchFactory) revert NotLaunchFactory();
        _launch(key.toId());
        if (key.hooks != IHooks(address(this)) || key.fee != 0) revert InvalidPoolKey();
        return IHooks.beforeInitialize.selector;
    }

    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external onlyPoolManager returns (bytes4) {
        _launch(key.toId());
        if (sender != launchFactory) revert NotLaunchFactory();
        return IHooks.beforeAddLiquidity.selector;
    }

    function beforeRemoveLiquidity(
        address,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external onlyPoolManager returns (bytes4) {
        _launch(key.toId());
        revert LiquidityIsPermanentlyLocked();
    }

    function beforeSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24) {
        PoolId poolId = key.toId();
        LaunchConfig storage config = _launch(poolId);
        if (block.timestamp < config.tradingOpensAt) {
            revert TradingNotOpen(config.tradingOpensAt, uint64(block.timestamp));
        }
        bool isBuy = _isBuy(config, key, params.zeroForOne);
        uint64 timestamp = uint64(block.timestamp);
        uint24 normalTax = _normalTax(config, isBuy, timestamp);
        uint24 appliedTax = isBuy
            ? GlidepathSnipe.effectiveBuyTax(config.snipe, config.tradingOpensAt, timestamp, normalTax)
            : normalTax;
        bool snipeTax = isBuy && appliedTax > normalTax;
        uint24 totalFeePips = isBuy
            ? GlidepathFeeMath.totalBuyFeePips(normalTax, appliedTax)
            : GlidepathFeeMath.totalSellFeePips(normalTax);

        bool quoteIsSpecified = _specifiedCurrencyIsQuote(config, key, params.amountSpecified, params.zeroForOne);
        if (!quoteIsSpecified) {
            delete _pendingQuoteSwaps[poolId];
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        uint128 quoteAmount = _absAmount(params.amountSpecified);
        bool grossUpOutput = params.amountSpecified > 0;
        (uint128 totalAmount,,) = _collectAndCredit(
            poolId, config, quoteAmount, appliedTax, snipeTax, totalFeePips, grossUpOutput
        );
        if (totalAmount == 0) {
            delete _pendingQuoteSwaps[poolId];
            return (IHooks.beforeSwap.selector, toBeforeSwapDelta(0, 0), 0);
        }

        uint128 expectedSpecified = _netSpecifiedAmount(params.amountSpecified, totalAmount);
        _pendingQuoteSwaps[poolId] = PendingQuoteSwap({
            validateFullFill: true,
            expectedSpecifiedAmount: expectedSpecified
        });
        if (totalAmount > uint128(type(int128).max)) revert FeeDeltaTooLarge(totalAmount);
        return (IHooks.beforeSwap.selector, toBeforeSwapDelta(int128(totalAmount), 0), 0);
    }

    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        LaunchConfig storage config = _launch(poolId);
        PendingQuoteSwap memory pending = _pendingQuoteSwaps[poolId];
        delete _pendingQuoteSwaps[poolId];

        Currency specifiedCurrency = _specifiedCurrency(key, params.amountSpecified, params.zeroForOne);
        Currency unspecifiedCurrency = _unspecifiedCurrency(key, params.amountSpecified, params.zeroForOne);
        if (pending.validateFullFill) {
            int128 specifiedDelta = _currencyDelta(delta, key, specifiedCurrency);
            uint128 actualSpecified = _absAmount(int256(specifiedDelta));
            if (actualSpecified != pending.expectedSpecifiedAmount) {
                revert QuoteSpecifiedSwapWasPartial(pending.expectedSpecifiedAmount, actualSpecified);
            }
            // beforeSwap charged the requested amount. Reject a partial fill so
            // this cannot charge against quote value that did not trade.
            return (IHooks.afterSwap.selector, 0);
        }

        if (Currency.unwrap(unspecifiedCurrency) != Currency.unwrap(config.quoteCurrency)) {
            return (IHooks.afterSwap.selector, 0);
        }

        bool isBuy = _isBuy(config, key, params.zeroForOne);
        uint64 timestamp = uint64(block.timestamp);
        uint24 normalTax = _normalTax(config, isBuy, timestamp);
        uint24 appliedTax = isBuy
            ? GlidepathSnipe.effectiveBuyTax(config.snipe, config.tradingOpensAt, timestamp, normalTax)
            : normalTax;
        bool snipeTax = isBuy && appliedTax > normalTax;
        uint24 totalFeePips = isBuy
            ? GlidepathFeeMath.totalBuyFeePips(normalTax, appliedTax)
            : GlidepathFeeMath.totalSellFeePips(normalTax);

        int128 quoteDelta = _currencyDelta(delta, key, config.quoteCurrency);
        uint128 quoteAmount = _absAmount(int256(quoteDelta));
        (uint128 totalAmount,,) = _collectAndCredit(
            poolId, config, quoteAmount, appliedTax, snipeTax, totalFeePips, false
        );
        if (totalAmount > uint128(type(int128).max)) revert FeeDeltaTooLarge(totalAmount);
        return (IHooks.afterSwap.selector, int128(totalAmount));
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure returns (bytes4) {
        revert UnsupportedHookCallback();
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert UnsupportedHookCallback();
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure returns (bytes4, BalanceDelta) {
        revert UnsupportedHookCallback();
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert UnsupportedHookCallback();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert UnsupportedHookCallback();
    }

    function _collectAndCredit(
        PoolId poolId,
        LaunchConfig storage config,
        uint128 quoteAmount,
        uint24 taxPips,
        bool snipeTax,
        uint24 totalFeePips,
        bool grossUpOutput
    ) private returns (uint128 totalAmount, uint128 platformAmount, uint128 creatorAmount) {
        totalAmount = grossUpOutput
            ? GlidepathFeeMath.amountForRateOnNet(quoteAmount, totalFeePips)
            : GlidepathFeeMath.amountForRate(quoteAmount, totalFeePips);
        if (totalAmount == 0) return (0, 0, 0);

        GlidepathFeeMath.AmountSplit memory split =
            GlidepathFeeMath.splitCollectedFee(totalAmount, taxPips, snipeTax);
        platformAmount = split.platformAmount;
        creatorAmount = split.creatorAmount;
        if (uint256(platformAmount) + creatorAmount != totalAmount) revert InvalidPoolKey();

        Currency quoteCurrency = config.quoteCurrency;
        poolManager.take(quoteCurrency, address(this), totalAmount);
        address quoteAddress = Currency.unwrap(quoteCurrency);
        claimable[quoteAddress][platformTreasury] += platformAmount;
        _creditCreator(config, quoteAddress, creatorAmount);

        emit FeeAccrued(poolId, quoteAddress, totalAmount, platformAmount, creatorAmount, taxPips, snipeTax);
    }

    function _creditCreator(LaunchConfig storage config, address quoteAddress, uint128 amount) private {
        uint128 remaining = amount;
        for (uint256 i; i < config.payoutRecipients.length; ++i) {
            uint16 weight = config.payoutWeightsBps[i];
            if (weight == 0) continue;
            uint128 share = i == config.lastPayoutRecipient
                ? remaining
                : uint128((uint256(amount) * weight) / CREATOR_SHARE_DENOMINATOR);
            claimable[quoteAddress][config.payoutRecipients[i]] += share;
            remaining -= share;
        }
    }

    function _normalTax(LaunchConfig storage config, bool isBuy, uint64 timestamp)
        private
        view
        returns (uint24)
    {
        if (isBuy) {
            return GlidepathTaxPath.effectiveRate(
                config.buyPath, config.tradingOpensAt, timestamp, config.creatorBuyCeilingPips
            );
        }
        return GlidepathTaxPath.effectiveRate(
            config.sellPath, config.tradingOpensAt, timestamp, config.creatorSellCeilingPips
        );
    }

    function _isBuy(LaunchConfig storage config, PoolKey calldata key, bool zeroForOne)
        private
        view
        returns (bool)
    {
        Currency input = zeroForOne ? key.currency0 : key.currency1;
        return Currency.unwrap(input) == Currency.unwrap(config.quoteCurrency);
    }

    function _specifiedCurrencyIsQuote(
        LaunchConfig storage config,
        PoolKey calldata key,
        int256 amountSpecified,
        bool zeroForOne
    ) private view returns (bool) {
        return Currency.unwrap(_specifiedCurrency(key, amountSpecified, zeroForOne))
            == Currency.unwrap(config.quoteCurrency);
    }

    function _specifiedCurrency(PoolKey calldata key, int256 amountSpecified, bool zeroForOne)
        private
        pure
        returns (Currency)
    {
        bool specifiedIsCurrency0 = (amountSpecified < 0) == zeroForOne;
        return specifiedIsCurrency0 ? key.currency0 : key.currency1;
    }

    function _unspecifiedCurrency(PoolKey calldata key, int256 amountSpecified, bool zeroForOne)
        private
        pure
        returns (Currency)
    {
        bool specifiedIsCurrency0 = (amountSpecified < 0) == zeroForOne;
        return specifiedIsCurrency0 ? key.currency1 : key.currency0;
    }

    function _currencyDelta(BalanceDelta delta, PoolKey calldata key, Currency currency)
        private
        pure
        returns (int128)
    {
        return Currency.unwrap(currency) == Currency.unwrap(key.currency0) ? delta.amount0() : delta.amount1();
    }

    function _netSpecifiedAmount(int256 amountSpecified, uint128 feeAmount) private pure returns (uint128) {
        uint256 amount = _absAmount(amountSpecified);
        if (amountSpecified < 0) {
            if (feeAmount >= amount) revert FeeDeltaTooLarge(feeAmount);
            return uint128(amount - feeAmount);
        }
        if (amount > type(uint128).max - feeAmount) revert SwapAmountTooLarge(amount + feeAmount);
        return uint128(amount + feeAmount);
    }

    function _absAmount(int256 amount) private pure returns (uint128) {
        uint256 magnitude = amount < 0 ? uint256(-(amount + 1)) + 1 : uint256(amount);
        if (magnitude > type(uint128).max) revert SwapAmountTooLarge(magnitude);
        return uint128(magnitude);
    }

    function _launch(PoolId poolId) private view returns (LaunchConfig storage config) {
        config = _launches[poolId];
        if (!config.registered) revert UnknownPool(poolId);
    }
}
