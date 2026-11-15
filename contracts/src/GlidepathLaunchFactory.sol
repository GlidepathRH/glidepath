// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {GlidepathHook} from "./GlidepathHook.sol";
import {GlidepathSnipe} from "./GlidepathSnipe.sol";
import {GlidepathTaxPath} from "./GlidepathTaxPath.sol";
import {GlidepathToken} from "./GlidepathToken.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {Currency, CurrencyLibrary} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @notice Creates fixed-supply tokens and seeds one permanently locked v4 position.
/// @dev Uses a full-range, 60-tick-spacing position. Initial price is sqrt(currency1/currency0).
contract GlidepathLaunchFactory is IUnlockCallback {
    using CurrencyLibrary for Currency;
    using PoolIdLibrary for PoolKey;

    int24 public constant TICK_SPACING = 60;
    int24 public constant MIN_TICK = -887_220;
    int24 public constant MAX_TICK = 887_220;
    uint256 private constant Q96 = 1 << 96;

    error InvalidAddress();
    error InvalidLaunchParameters();
    error InvalidNativeValue(uint256 expected, uint256 received);
    error NotPoolManager();
    error NotInLaunch();
    error LiquidityTooSmall();
    error LiquidityTooLarge(uint256 liquidity);
    error LiquidityBudgetExceeded(address currency, uint256 owed, uint256 budget);
    error UnexpectedPositiveDelta(address currency, int128 delta);
    error TokenTransferFailed(address token);
    error NativeRefundFailed();
    error LaunchFeeTransferFailed();
    error ReentrantLaunch();
    error InvalidCreatorFirstBuy();

    event LaunchCreated(
        address indexed token,
        PoolId indexed poolId,
        address indexed creator,
        address quoteCurrency,
        uint256 totalSupply,
        uint256 liquidityTokenAmount,
        uint256 liquidityQuoteAmount,
        uint256 creatorFirstBuyTokenAmount,
        uint256 creatorFirstBuyQuoteAmount,
        uint160 sqrtPriceX96
    );
    event CreatorFirstBuy(address indexed token, address indexed creator, uint256 tokenAmount, uint256 quoteAmount);

    struct CreateParams {
        string name;
        string symbol;
        uint256 totalSupply;
        uint256 liquidityTokenAmount;
        uint256 creatorFirstBuyTokenAmount;
        uint256 creatorFirstBuyQuoteBudget;
        address quoteCurrency;
        uint256 quoteAmount;
        uint160 sqrtPriceX96;
        uint64 tradingOpensAt;
        GlidepathTaxPath.Path buyPath;
        GlidepathTaxPath.Path sellPath;
        GlidepathSnipe.Config snipe;
        address[3] payoutRecipients;
        uint16[3] payoutWeightsBps;
    }

    struct ActiveLaunch {
        address creator;
        address token;
        Currency currency0;
        Currency currency1;
        uint256 tokenBudget;
        uint256 quoteBudget;
        uint256 firstBuyTokenAmount;
        uint256 firstBuyQuoteBudget;
        bool tokenIsCurrency0;
    }

    IPoolManager public immutable poolManager;
    GlidepathHook public immutable hook;
    address public immutable platformTreasury;
    uint256 public immutable launchFee;

    mapping(address token => PoolId poolId) public poolForToken;
    mapping(PoolId poolId => address token) public tokenForPool;

    uint256 private _launchLock = 1;
    ActiveLaunch private _activeLaunch;

    constructor(IPoolManager poolManager_, GlidepathHook hook_, address platformTreasury_, uint256 launchFee_) {
        if (
            address(poolManager_) == address(0) || address(poolManager_).code.length == 0
                || address(hook_) == address(0) || platformTreasury_ == address(0)
        ) revert InvalidAddress();
        if (
            address(hook_.poolManager()) != address(poolManager_) || hook_.launchFactory() != address(this)
                || hook_.platformTreasury() != platformTreasury_
        ) {
            revert InvalidAddress();
        }
        poolManager = poolManager_;
        hook = hook_;
        platformTreasury = platformTreasury_;
        launchFee = launchFee_;
    }

    /// @notice Create a plain fixed-supply token, initialize its pool, and seed locked liquidity.
    /// @dev `liquidityTokenAmount` and `quoteAmount` are maxima; unused amounts return to the creator.
    ///      The creator receives all supply not actually deposited into the pool.
    function createLaunch(CreateParams calldata params) external payable returns (address token, PoolId poolId) {
        if (_launchLock != 1) revert ReentrantLaunch();
        _launchLock = 2;
        if (
            params.totalSupply == 0 || params.liquidityTokenAmount == 0
                || params.liquidityTokenAmount >= params.totalSupply || params.quoteAmount == 0
                || params.sqrtPriceX96 <= TickMath.MIN_SQRT_PRICE || params.sqrtPriceX96 >= TickMath.MAX_SQRT_PRICE
                || bytes(params.name).length == 0 || bytes(params.symbol).length == 0
        ) revert InvalidLaunchParameters();
        if (
            (params.creatorFirstBuyTokenAmount == 0) != (params.creatorFirstBuyQuoteBudget == 0)
                || params.creatorFirstBuyTokenAmount > params.totalSupply / 20
                || params.creatorFirstBuyTokenAmount > uint256(type(int256).max)
                || (params.creatorFirstBuyTokenAmount != 0 && params.tradingOpensAt > block.timestamp)
        ) revert InvalidCreatorFirstBuy();

        uint256 totalQuoteBudget = params.quoteAmount + params.creatorFirstBuyQuoteBudget;
        if (totalQuoteBudget < params.quoteAmount) revert InvalidLaunchParameters();

        token = address(new GlidepathToken(params.name, params.symbol, params.totalSupply, address(this)));
        Currency tokenCurrency = Currency.wrap(token);
        Currency quoteCurrency = Currency.wrap(params.quoteCurrency);
        if (tokenCurrency == quoteCurrency) revert InvalidLaunchParameters();

        if (quoteCurrency.isAddressZero()) {
            if (totalQuoteBudget > type(uint256).max - launchFee) revert InvalidLaunchParameters();
            uint256 expectedValue = totalQuoteBudget + launchFee;
            if (msg.value != expectedValue) revert InvalidNativeValue(expectedValue, msg.value);
        } else {
            if (msg.value != launchFee || params.quoteCurrency.code.length == 0) {
                revert InvalidNativeValue(launchFee, msg.value);
            }
            _safeTransferFrom(params.quoteCurrency, msg.sender, address(this), totalQuoteBudget);
        }
        if (launchFee != 0) {
            (bool feePaid,) = platformTreasury.call{value: launchFee}("");
            if (!feePaid) revert LaunchFeeTransferFailed();
        }

        bool tokenIsCurrency0 = token < params.quoteCurrency;
        Currency currency0 = tokenIsCurrency0 ? tokenCurrency : quoteCurrency;
        Currency currency1 = tokenIsCurrency0 ? quoteCurrency : tokenCurrency;
        PoolKey memory key =
            PoolKey({currency0: currency0, currency1: currency1, fee: 0, tickSpacing: TICK_SPACING, hooks: hook});

        hook.registerPool(
            key,
            tokenCurrency,
            quoteCurrency,
            msg.sender,
            params.tradingOpensAt,
            params.buyPath,
            params.sellPath,
            params.snipe,
            params.payoutRecipients,
            params.payoutWeightsBps
        );
        poolId = key.toId();
        if (PoolId.unwrap(poolForToken[token]) != bytes32(0)) revert InvalidLaunchParameters();
        poolForToken[token] = poolId;
        tokenForPool[poolId] = token;

        poolManager.initialize(key, params.sqrtPriceX96);
        _activeLaunch = ActiveLaunch({
            creator: msg.sender,
            token: token,
            currency0: currency0,
            currency1: currency1,
            tokenBudget: params.liquidityTokenAmount,
            quoteBudget: params.quoteAmount,
            firstBuyTokenAmount: params.creatorFirstBuyTokenAmount,
            firstBuyQuoteBudget: params.creatorFirstBuyQuoteBudget,
            tokenIsCurrency0: tokenIsCurrency0
        });
        bytes memory result = poolManager.unlock(abi.encode(key, params.sqrtPriceX96));
        (uint256 usedToken, uint256 usedQuote, uint256 firstBuyQuoteSpent) =
            abi.decode(result, (uint256, uint256, uint256));
        if (usedToken == 0 || usedQuote == 0) revert InvalidLaunchParameters();
        delete _activeLaunch;

        uint256 creatorTokenAmount = params.totalSupply - usedToken;
        _safeTransfer(token, msg.sender, creatorTokenAmount);
        if (quoteCurrency.isAddressZero()) {
            uint256 refund = totalQuoteBudget - usedQuote - firstBuyQuoteSpent;
            if (refund != 0) {
                (bool refunded,) = msg.sender.call{value: refund}("");
                if (!refunded) revert NativeRefundFailed();
            }
        } else {
            uint256 refund = totalQuoteBudget - usedQuote - firstBuyQuoteSpent;
            if (refund != 0) _safeTransfer(params.quoteCurrency, msg.sender, refund);
        }

        _launchLock = 1;
        emit LaunchCreated(
            token,
            poolId,
            msg.sender,
            params.quoteCurrency,
            params.totalSupply,
            usedToken,
            usedQuote,
            params.creatorFirstBuyTokenAmount,
            firstBuyQuoteSpent,
            params.sqrtPriceX96
        );
        if (params.creatorFirstBuyTokenAmount != 0) {
            emit CreatorFirstBuy(token, msg.sender, params.creatorFirstBuyTokenAmount, firstBuyQuoteSpent);
        }
    }

    /// @inheritdoc IUnlockCallback
    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        ActiveLaunch memory launch = _activeLaunch;
        if (launch.creator == address(0)) revert NotInLaunch();
        (PoolKey memory key, uint160 sqrtPriceX96) = abi.decode(data, (PoolKey, uint160));
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(hookPoolId(launch.token))) {
            revert InvalidLaunchParameters();
        }

        uint128 liquidity = _liquidityForAmounts(
            sqrtPriceX96,
            TickMath.getSqrtPriceAtTick(MIN_TICK),
            TickMath.getSqrtPriceAtTick(MAX_TICK),
            launch.tokenIsCurrency0 ? launch.tokenBudget : launch.quoteBudget,
            launch.tokenIsCurrency0 ? launch.quoteBudget : launch.tokenBudget
        );
        if (liquidity == 0) revert LiquidityTooSmall();

        (BalanceDelta delta,) = poolManager.modifyLiquidity(
            key,
            IPoolManager.ModifyLiquidityParams({
                tickLower: MIN_TICK, tickUpper: MAX_TICK, liquidityDelta: int256(uint256(liquidity)), salt: bytes32(0)
            }),
            ""
        );

        uint256 used0 = _settleDelta(key.currency0, delta.amount0(), _budgetFor(launch, key.currency0));
        uint256 used1 = _settleDelta(key.currency1, delta.amount1(), _budgetFor(launch, key.currency1));
        uint256 usedToken = launch.tokenIsCurrency0 ? used0 : used1;
        uint256 usedQuote = launch.tokenIsCurrency0 ? used1 : used0;

        uint256 firstBuyQuoteSpent;
        if (launch.firstBuyTokenAmount != 0) {
            (uint256 tokenOutput, uint256 quoteInput) = _executeCreatorFirstBuy(key, launch);
            if (tokenOutput != launch.firstBuyTokenAmount) revert InvalidCreatorFirstBuy();
            if (quoteInput > launch.firstBuyQuoteBudget) {
                revert LiquidityBudgetExceeded(
                    Currency.unwrap(launch.currency1), quoteInput, launch.firstBuyQuoteBudget
                );
            }
            firstBuyQuoteSpent = quoteInput;
        }
        return abi.encode(usedToken, usedQuote, firstBuyQuoteSpent);
    }

    function _executeCreatorFirstBuy(PoolKey memory key, ActiveLaunch memory launch)
        private
        returns (uint256 tokenOutput, uint256 quoteInput)
    {
        bool zeroForOne = !launch.tokenIsCurrency0;
        BalanceDelta delta = poolManager.swap(
            key,
            IPoolManager.SwapParams({
                zeroForOne: zeroForOne,
                amountSpecified: int256(launch.firstBuyTokenAmount),
                sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
            }),
            ""
        );

        int128 tokenDelta = _currencyDelta(delta, key, Currency.wrap(launch.token));
        int128 quoteDelta = _currencyDelta(delta, key, launch.tokenIsCurrency0 ? key.currency1 : key.currency0);
        if (tokenDelta <= 0 || quoteDelta >= 0) revert InvalidCreatorFirstBuy();
        tokenOutput = uint256(uint128(tokenDelta));
        quoteInput = uint256(-int256(quoteDelta));
        if (quoteInput > launch.firstBuyQuoteBudget) {
            revert LiquidityBudgetExceeded(
                Currency.unwrap(launch.tokenIsCurrency0 ? key.currency1 : key.currency0),
                quoteInput,
                launch.firstBuyQuoteBudget
            );
        }

        _settleDelta(launch.tokenIsCurrency0 ? key.currency1 : key.currency0, quoteDelta, launch.firstBuyQuoteBudget);
        poolManager.take(Currency.wrap(launch.token), launch.creator, tokenOutput);
    }

    function _currencyDelta(BalanceDelta delta, PoolKey memory key, Currency currency) private pure returns (int128) {
        return Currency.unwrap(currency) == Currency.unwrap(key.currency0) ? delta.amount0() : delta.amount1();
    }

    function _settleDelta(Currency currency, int128 delta, uint256 budget) private returns (uint256 amount) {
        if (delta > 0) revert UnexpectedPositiveDelta(Currency.unwrap(currency), delta);
        if (delta == 0) return 0;
        amount = uint256(-int256(delta));
        if (amount > budget) revert LiquidityBudgetExceeded(Currency.unwrap(currency), amount, budget);
        if (currency.isAddressZero()) {
            poolManager.settle{value: amount}();
        } else {
            poolManager.sync(currency);
            _safeTransfer(Currency.unwrap(currency), address(poolManager), amount);
            poolManager.settle();
        }
    }

    function _budgetFor(ActiveLaunch memory launch, Currency currency) private pure returns (uint256) {
        if (Currency.unwrap(currency) == launch.token) return launch.tokenBudget;
        return launch.quoteBudget;
    }

    function _liquidityForAmounts(
        uint160 sqrtPriceX96,
        uint160 sqrtLowerX96,
        uint160 sqrtUpperX96,
        uint256 amount0,
        uint256 amount1
    ) private pure returns (uint128 liquidity) {
        uint256 liquidity0 = FullMath.mulDiv(
            amount0, FullMath.mulDiv(sqrtLowerX96, sqrtUpperX96, Q96), sqrtUpperX96 - sqrtLowerX96
        );
        uint256 liquidity1 = FullMath.mulDiv(amount1, Q96, sqrtUpperX96 - sqrtLowerX96);
        uint256 result;
        if (sqrtPriceX96 <= sqrtLowerX96) {
            result = liquidity0;
        } else if (sqrtPriceX96 >= sqrtUpperX96) {
            result = liquidity1;
        } else {
            uint256 liquidity0AtPrice =
                FullMath.mulDiv(amount0, FullMath.mulDiv(sqrtPriceX96, sqrtUpperX96, Q96), sqrtUpperX96 - sqrtPriceX96);
            uint256 liquidity1AtPrice = FullMath.mulDiv(amount1, Q96, sqrtPriceX96 - sqrtLowerX96);
            result = liquidity0AtPrice < liquidity1AtPrice ? liquidity0AtPrice : liquidity1AtPrice;
        }
        if (result > type(uint128).max) revert LiquidityTooLarge(result);
        liquidity = uint128(result);
    }

    function _safeTransfer(address token, address to, uint256 amount) private {
        (bool success, bytes memory returned) = token.call(abi.encodeWithSelector(0xa9059cbb, to, amount));
        if (!success || (returned.length != 0 && (returned.length < 32 || !abi.decode(returned, (bool))))) {
            revert TokenTransferFailed(token);
        }
    }

    function _safeTransferFrom(address token, address from, address to, uint256 amount) private {
        (bool success, bytes memory returned) = token.call(abi.encodeWithSelector(0x23b872dd, from, to, amount));
        if (!success || (returned.length != 0 && (returned.length < 32 || !abi.decode(returned, (bool))))) {
            revert TokenTransferFailed(token);
        }
    }

    function hookPoolId(address token) private view returns (PoolId) {
        return poolForToken[token];
    }
}
