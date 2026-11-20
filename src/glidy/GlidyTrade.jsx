import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, Check, ChevronDown, LoaderCircle, Search } from "lucide-react";
import { encodeAbiParameters, formatUnits, parseAbi, parseUnits } from "viem";
import { useAccount, useChainId, usePublicClient, useSwitchChain, useWalletClient } from "wagmi";
import { useGlidyApi } from "./GlidyApi";
import { GlidyConnectButton, robinhoodChain } from "./GlidyWallet";
import { useGlidyToast } from "./GlidyToast";
import { formatTaxPips, shortAddress } from "./launch-data.mjs";

const CHAIN_ID = 4663;
const ZERO = "0x0000000000000000000000000000000000000000";
const ROUTER = "0x204FAca1764B154221e35c0d20aBb3c525710498";
const QUOTER = "0x8dc178efb8111bb0973dd9d722ebeff267c98f94";
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3";
const hookAddress = "0xd9C3FA83fdeDe47784a9FC62ECf11A4FBd24AaCc";
const routerAbi = parseAbi(["function execute(bytes commands, bytes[] inputs, uint256 deadline) payable"]);
const quoterAbi = [{
  type: "function", name: "quoteExactInputSingle", stateMutability: "nonpayable",
  inputs: [{ name: "params", type: "tuple", components: [
    { name: "poolKey", type: "tuple", components: [
      { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
      { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
    ] },
    { name: "zeroForOne", type: "bool" }, { name: "exactAmount", type: "uint128" }, { name: "hookData", type: "bytes" },
  ] }],
  outputs: [{ name: "amountOut", type: "uint256" }, { name: "gasEstimate", type: "uint256" }],
}];
const erc20Abi = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address owner) view returns (uint256)",
]);
const permit2Abi = parseAbi([
  "function allowance(address owner, address token, address spender) view returns (uint160 amount, uint48 expiration, uint48 nonce)",
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
]);

const poolKeyComponents = [
  { name: "currency0", type: "address" }, { name: "currency1", type: "address" },
  { name: "fee", type: "uint24" }, { name: "tickSpacing", type: "int24" }, { name: "hooks", type: "address" },
];
const exactInputComponents = [
  { name: "poolKey", type: "tuple", components: poolKeyComponents },
  { name: "zeroForOne", type: "bool" }, { name: "amountIn", type: "uint128" },
  { name: "amountOutMinimum", type: "uint128" }, { name: "minHopPriceX36", type: "uint256" },
  { name: "hookData", type: "bytes" },
];

function abbreviate(value) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : "";
}

function TradePanel({ initialLaunch }) {
  const { launches } = useGlidyApi();
  const toast = useGlidyToast();
  const account = useAccount();
  const chainId = useChainId();
  const { switchChain, isPending: switching } = useSwitchChain();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [token, setToken] = useState(initialLaunch ?? null);
  const [side, setSide] = useState("buy");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState({ kind: "idle", amountOut: null, gas: null });
  const [slippageBps, setSlippageBps] = useState(100);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [approval, setApproval] = useState({ kind: "checking", tokenAllowance: 0n, permitAllowance: 0n, permitExpiration: 0n });
  const [tokenBalance, setTokenBalance] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const availableLaunches = useMemo(() => launches.filter((launch) => launch.quote_currency?.toLowerCase() === ZERO), [launches]);
  useEffect(() => {
    if (!token && initialLaunch) setToken(initialLaunch);
  }, [initialLaunch, token]);
  useEffect(() => {
    if (!token && availableLaunches.length) setToken(availableLaunches[0]);
  }, [availableLaunches, token]);
  const address = token?.token_address;
  const decimals = Number(token?.token_decimals ?? 18);
  const poolKey = useMemo(() => address && ({ currency0: ZERO, currency1: address, fee: 0, tickSpacing: 60, hooks: hookAddress }), [address]);
  const filteredLaunches = availableLaunches.filter((launch) => `${launch.token_name} ${launch.token_symbol} ${launch.token_address}`.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    let disposed = false;
    let timer;
    if (!publicClient || !poolKey || !amount || Number(amount) <= 0) {
      setQuote({ kind: "idle", amountOut: null, gas: null });
      return () => { disposed = true; clearTimeout(timer); };
    }
    setQuote({ kind: "loading", amountOut: null, gas: null });
    timer = setTimeout(async () => {
      try {
        const exactAmount = parseUnits(amount, side === "buy" ? 18 : decimals);
        if (exactAmount <= 0n || exactAmount > (1n << 128n) - 1n) throw new Error("Enter a valid trade amount.");
        const simulation = await publicClient.simulateContract({
          address: QUOTER,
          abi: quoterAbi,
          functionName: "quoteExactInputSingle",
          args: [{ poolKey, zeroForOne: side === "buy", exactAmount, hookData: "0x" }],
        });
        if (!disposed) setQuote({ kind: "ready", amountOut: simulation.result[0], gas: simulation.result[1] });
      } catch (cause) {
        if (!disposed) setQuote({ kind: "error", amountOut: null, gas: null, error: cause.shortMessage || cause.message || "No quote available for this amount." });
      }
    }, 350);
    return () => { disposed = true; clearTimeout(timer); };
  }, [amount, side, decimals, poolKey, publicClient]);

  useEffect(() => {
    let disposed = false;
    async function loadAllowances() {
      if (!publicClient || !account.address || !address || side !== "sell") {
        setApproval({ kind: "ready", tokenAllowance: 0n, permitAllowance: 0n, permitExpiration: 0n });
        setTokenBalance(null);
        return;
      }
      setApproval((value) => ({ ...value, kind: "checking" }));
      try {
        const [erc20Allowance, permitAllowance, balance] = await Promise.all([
          publicClient.readContract({ address, abi: erc20Abi, functionName: "allowance", args: [account.address, PERMIT2] }),
          publicClient.readContract({ address: PERMIT2, abi: permit2Abi, functionName: "allowance", args: [account.address, address, ROUTER] }),
          publicClient.readContract({ address, abi: erc20Abi, functionName: "balanceOf", args: [account.address] }),
        ]);
        if (!disposed) {
          setApproval({ kind: "ready", tokenAllowance: erc20Allowance, permitAllowance: permitAllowance[0], permitExpiration: BigInt(permitAllowance[1]) });
          setTokenBalance(balance);
        }
      } catch {
        if (!disposed) setApproval({ kind: "error", tokenAllowance: 0n, permitAllowance: 0n, permitExpiration: 0n });
      }
    }
    void loadAllowances();
    return () => { disposed = true; };
  }, [publicClient, account.address, address, side, busy]);

  const inputDecimals = side === "buy" ? 18 : decimals;
  const outputDecimals = side === "buy" ? decimals : 18;
  const inputSymbol = side === "buy" ? "ETH" : token?.token_symbol || "TOKEN";
  const outputSymbol = side === "buy" ? token?.token_symbol || "TOKEN" : "ETH";
  const amountIn = (() => { try { return amount ? parseUnits(amount, inputDecimals) : 0n; } catch { return 0n; } })();
  const needsTokenApproval = side === "sell" && amountIn > 0n && approval.tokenAllowance < amountIn;
  const needsPermitApproval = side === "sell" && !needsTokenApproval && amountIn > 0n
    && (approval.permitAllowance < amountIn || approval.permitExpiration <= BigInt(Math.floor(Date.now() / 1000)));
  const minimumOut = quote.amountOut ? quote.amountOut * BigInt(10_000 - slippageBps) / 10_000n : 0n;

  async function waitFor(hash) {
    if (!publicClient) throw new Error("Robinhood Chain RPC is unavailable.");
    await publicClient.waitForTransactionReceipt({ hash });
  }

  async function approveToken() {
    if (!walletClient || !address || amountIn <= 0n) return;
    setBusy(true); setError("");
    try {
      const hash = await walletClient.writeContract({ address, abi: erc20Abi, functionName: "approve", args: [PERMIT2, amountIn] });
      await waitFor(hash);
      toast("Token approval confirmed");
    } catch (cause) { const message = cause.shortMessage || cause.message || "Token approval failed."; setError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  async function approvePermit2() {
    if (!walletClient || !address || amountIn <= 0n) return;
    setBusy(true); setError("");
    try {
      const expiration = BigInt(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60);
      const hash = await walletClient.writeContract({ address: PERMIT2, abi: permit2Abi, functionName: "approve", args: [address, ROUTER, amountIn, expiration] });
      await waitFor(hash);
      toast("Swap permission confirmed");
    } catch (cause) { const message = cause.shortMessage || cause.message || "Swap permission failed."; setError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  async function executeTrade() {
    if (!walletClient || !publicClient || !account.address || !poolKey || !quote.amountOut || amountIn <= 0n) return;
    setBusy(true); setError("");
    try {
      const params = encodeAbiParameters([{ type: "tuple", components: exactInputComponents }], [{
        poolKey, zeroForOne: side === "buy", amountIn, amountOutMinimum: minimumOut, minHopPriceX36: 0n, hookData: "0x",
      }]);
      const settle = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [side === "buy" ? ZERO : address, amountIn]);
      const take = encodeAbiParameters([{ type: "address" }, { type: "uint256" }], [side === "buy" ? address : ZERO, minimumOut]);
      const v4Input = encodeAbiParameters([{ type: "bytes" }, { type: "bytes[]" }], ["0x060c0f", [params, settle, take]]);
      const args = ["0x10", [v4Input], BigInt(Math.floor(Date.now() / 1000) + 300)];
      await publicClient.simulateContract({
        address: ROUTER, abi: routerAbi, functionName: "execute", args,
        ...(side === "buy" ? { value: amountIn } : {}), account: account.address,
      });
      const hash = await walletClient.writeContract({
        address: ROUTER, abi: routerAbi, functionName: "execute", args,
        ...(side === "buy" ? { value: amountIn } : {}),
      });
      toast("Swap submitted. Waiting for confirmation…");
      await waitFor(hash);
      setAmount("");
      setQuote({ kind: "idle", amountOut: null, gas: null });
      toast("Swap confirmed");
    } catch (cause) { const message = cause.shortMessage || cause.message || "Swap failed."; setError(message); toast(message, "error"); }
    finally { setBusy(false); }
  }

  let primaryLabel = "Enter an amount";
  let primaryAction = undefined;
  let disabled = true;
  if (!account.address) { primaryLabel = "Connect wallet"; }
  else if (chainId !== CHAIN_ID) { primaryLabel = switching ? "Switching network…" : "Switch to Robinhood Chain"; primaryAction = () => switchChain({ chainId: CHAIN_ID }); disabled = switching; }
  else if (!token) { primaryLabel = "Choose a token"; }
  else if (quote.kind === "loading") primaryLabel = "Getting quote…";
  else if (quote.kind === "error") primaryLabel = "No route for this amount";
  else if (side === "sell" && approval.kind === "checking") primaryLabel = "Checking approval…";
  else if (needsTokenApproval) { primaryLabel = `Approve ${inputSymbol}`; primaryAction = approveToken; disabled = busy || approval.kind !== "ready"; }
  else if (needsPermitApproval) { primaryLabel = "Allow swap"; primaryAction = approvePermit2; disabled = busy || approval.kind !== "ready"; }
  else if (quote.kind === "ready") { primaryLabel = busy ? "Processing…" : `${side === "buy" ? "Buy" : "Sell"} ${token.token_symbol}`; primaryAction = executeTrade; disabled = busy || approval.kind === "error"; }

  return <section className="glidy-trade-panel" aria-label="Trade this GLIDY launch">
    <div className="glidy-trade-title"><div><span>TRADE THIS POOL</span><small>Direct Uniswap v4 · Robinhood Chain</small></div><button type="button" className="glidy-pool-token-picker" onClick={() => { setSearch(""); setPickerOpen(true); }} aria-label="Choose launch pool"><span className="glidy-token-avatar">{token?.token_symbol?.slice(0, 3) || "?"}</span><span>{token ? `${token.token_name} · $${token.token_symbol}` : "Choose token"}</span><ChevronDown size={15} /></button></div>
    <div className="glidy-trade-tabs"><button type="button" className={side === "buy" ? "active" : ""} onClick={() => { setSide("buy"); setError(""); }}>Buy</button><button type="button" className={side === "sell" ? "active" : ""} onClick={() => { setSide("sell"); setError(""); }}>Sell</button></div>
    <div className="glidy-trade-amount"><label htmlFor="glidy-trade-amount">You {side === "buy" ? "pay" : "sell"}</label><div><input id="glidy-trade-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))} placeholder="0.0" /><span>{inputSymbol}</span></div>{side === "sell" && tokenBalance !== null && <small>Balance {formatUnits(tokenBalance, decimals)} {inputSymbol}</small>}</div>
    <div className="glidy-trade-switch" aria-hidden="true"><ArrowDownUp size={16} /></div>
    <div className="glidy-trade-amount glidy-trade-output"><label>You receive</label><div><strong>{quote.kind === "ready" ? Number(formatUnits(quote.amountOut, outputDecimals)).toLocaleString(undefined, { maximumSignificantDigits: 8 }) : quote.kind === "loading" ? "…" : "0.0"}</strong><span className="glidy-trade-currency"><span className="glidy-token-avatar">{side === "buy" ? (token?.token_symbol?.slice(0, 3) || "?") : "ETH"}</span>{outputSymbol}</span></div>{token && <small>{token.token_name} · {abbreviate(token.token_address)}</small>}</div>
    <div className="glidy-trade-summary"><span>Current {side} tax</span><strong>{formatTaxPips(side === "buy" ? token?.buy_tax_pips : token?.sell_tax_pips)}</strong><span>Pool fee</span><strong>0.3%</strong><span>Slippage tolerance</span><div>{[[100, "1%"], [300, "3%"], [500, "5%"]].map(([value, label]) => <button type="button" key={value} aria-pressed={slippageBps === value} onClick={() => setSlippageBps(value)}>{label}</button>)}</div></div>
    {quote.kind === "error" && amount && <p className="glidy-trade-error" role="status">{quote.error}</p>}
    {error && <p className="glidy-trade-error" role="alert">{error}</p>}
    {side === "sell" && approval.kind === "error" && <p className="glidy-trade-error" role="status">Could not read token approval. Refresh and try again.</p>}
    {!account.address ? <GlidyConnectButton className="glidy-trade-submit" /> : <button type="button" className="glidy-trade-submit" disabled={disabled} onClick={primaryAction}>{busy || quote.kind === "loading" ? <LoaderCircle size={16} className="glidy-spin" /> : null}{primaryLabel}</button>}
    {pickerOpen && <div className="glidy-token-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}>
      <section className="glidy-token-modal" role="dialog" aria-modal="true" aria-labelledby="glidy-token-modal-title">
        <header><h2 id="glidy-token-modal-title">Choose a launched token</h2><button type="button" onClick={() => setPickerOpen(false)} aria-label="Close token picker">×</button></header>
        <label className="glidy-token-search"><Search size={16} /><input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, ticker, or address" /></label>
        <div className="glidy-token-options">{filteredLaunches.map((launch) => <button key={launch.token_address} type="button" onClick={() => { setToken(launch); setPickerOpen(false); setAmount(""); }}>
          <span className="glidy-token-avatar">{launch.token_symbol?.slice(0, 3)}</span><span><strong>{launch.token_name}</strong><small>${launch.token_symbol} · {shortAddress(launch.token_address)}</small></span>
          {token?.token_address?.toLowerCase() === launch.token_address.toLowerCase() && <Check size={16} />}
        </button>)}{!filteredLaunches.length && <p>No launched tokens match that search.</p>}</div>
      </section>
    </div>}
  </section>;
}

export function GlidyTradePage() {
  return <div className="glidy-trade-page"><header><p>GLIDY / TRADE</p><h1>Trade launch tokens</h1><span>Buy and sell directly against each launch’s v4 pool.</span></header><TradePanel /></div>;
}

export { TradePanel };
