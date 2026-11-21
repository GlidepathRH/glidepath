import React, { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Check, Copy, Plus } from "lucide-react";
import { formatEther, getAddress, isAddress, parseEventLogs, parseEther } from "viem";
import { useAccount, useBalance, usePublicClient, useReadContract, useWalletClient } from "wagmi";
import factoryAbi from "./chain/factoryAbi.json";
import { robinhoodChain } from "./GlidyWallet";

const CHAIN_ID = robinhoodChain.id;
const FACTORY = "0x69531E368B9236c2ed7c6da054e8705506c7fA8d";
const EXPLORER = "https://robinhoodchain.blockscout.com";
const zeroAddress = "0x0000000000000000000000000000000000000000";
const initialTax = { start: "3", floor: "1", step: "0.2", hold: "2", interval: "7" };

function integerSqrt(value) {
  if (value < 0n) throw new Error("Cannot calculate a square root of a negative value.");
  if (value < 2n) return value;
  let x = value;
  let y = (x + 1n) >> 1n;
  while (y < x) { x = y; y = (x + value / x) >> 1n; }
  return x;
}

function Field({ label, hint, children }) {
  return <div className="field"><div className="field-heading"><label>{label}</label>{hint && <span>{hint}</span>}</div>{children}</div>;
}
function AmountField({ label, hint, value, onChange, suffix = "", min = "0" }) {
  return <Field label={label} hint={hint}><div className="launch-amount-input"><input inputMode="decimal" type="number" min={min} step="any" value={value} onChange={(event) => onChange(event.target.value)} /><span>{suffix}</span></div></Field>;
}

export function LaunchCreator() {
  const { address, chainId, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient({ chainId: CHAIN_ID });
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { data: balanceData } = useBalance({ address, chainId: CHAIN_ID, query: { enabled: Boolean(address) } });
  const { data: launchFeeData } = useReadContract({ address: FACTORY, abi: factoryAbi, functionName: "launchFee", chainId: CHAIN_ID });
  const balance = balanceData?.value ?? null;
  const launchFee = launchFeeData ?? null;
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [supply, setSupply] = useState("1000000000");
  const [liquidityTokens, setLiquidityTokens] = useState("800000000");
  const [liquidityEth, setLiquidityEth] = useState("");
  const [firstBuyTokens, setFirstBuyTokens] = useState("");
  const [firstBuyBudget, setFirstBuyBudget] = useState("");
  const [tax, setTax] = useState(initialTax);
  const [snipe, setSnipe] = useState("Off");
  const [longTax, setLongTax] = useState("99");
  const [longSeconds, setLongSeconds] = useState("60");
  const [recipients, setRecipients] = useState([{ address: "", percent: "100" }]);
  const [payoutEdited, setPayoutEdited] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [transaction, setTransaction] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);
  const [tokenImage, setTokenImage] = useState(null);
  const [tokenImagePreview, setTokenImagePreview] = useState("");
  const [imageUploadState, setImageUploadState] = useState("idle");
  const [imageUploadError, setImageUploadError] = useState("");

  useEffect(() => {
    if (!tokenImage) { setTokenImagePreview(""); return; }
    const preview = URL.createObjectURL(tokenImage);
    setTokenImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [tokenImage]);

  useEffect(() => {
    if (address && !payoutEdited && recipients.length === 1) {
      setRecipients([{ address, percent: "100" }]);
    }
  }, [address, payoutEdited, recipients.length]);

  const totalWei = useMemo(() => {
    try { return parseEther(liquidityEth || "0") + parseEther(firstBuyBudget || "0") + (launchFee ?? 0n); }
    catch { return null; }
  }, [liquidityEth, firstBuyBudget, launchFee]);
  const payoutTotal = recipients.reduce((sum, item) => sum + (Number(item.percent) || 0), 0);

  async function uploadSelectedImage(tokenAddress, transactionHash) {
    if (!tokenImage || !walletClient || !address) return;
    setImageUploadState("uploading");
    setImageUploadError("");
    try {
      const bytes = await tokenImage.arrayBuffer();
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      const imageSha256 = Array.from(digest, (value) => value.toString(16).padStart(2, "0")).join("");
      const message = [
        "GLIDY token image upload",
        `Chain ID: ${CHAIN_ID}`,
        `Token: ${tokenAddress.toLowerCase()}`,
        `Launch transaction: ${transactionHash.toLowerCase()}`,
        `Image SHA-256: ${imageSha256}`,
      ].join("\n");
      const signature = await walletClient.signMessage({ account: address, message });
      const response = await fetch(`/api/glidy/api/v1/launches/${tokenAddress}/image`, {
        method: "POST",
        headers: {
          "Content-Type": tokenImage.type,
          "X-Glidy-Creator": address,
          "X-Glidy-Launch-Tx": transactionHash,
          "X-Glidy-Image-Signature": signature,
        },
        body: bytes,
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Token image could not be saved.");
      setCreated((current) => current ? { ...current, imageUrl: result.data.image_url } : current);
      setImageUploadState("saved");
    } catch (error) {
      setImageUploadError(error?.shortMessage || error?.message || "Token image upload failed.");
      setImageUploadState("error");
    }
  }

  function validate() {
    if (!isConnected || !address) return "Connect a wallet from the header to continue.";
    if (chainId !== CHAIN_ID || !walletClient || !publicClient) return "Switch your wallet to Robinhood Chain using the header button.";
    if (!name.trim() || name.trim().length > 64) return "Enter a token name (up to 64 characters).";
    if (!/^[A-Za-z0-9]{1,10}$/.test(symbol.trim())) return "Ticker must contain 1–10 letters or numbers.";
    let total, liquidity, eth, firstTokens, firstBudget;
    try {
      total = parseEther(supply); liquidity = parseEther(liquidityTokens); eth = parseEther(liquidityEth);
      firstTokens = parseEther(firstBuyTokens || "0"); firstBudget = parseEther(firstBuyBudget || "0");
    } catch { return "Check the token and ETH amounts."; }
    if (total <= 0n || liquidity <= 0n || liquidity >= total) return "Liquidity tokens must be greater than zero and less than total supply.";
    if (eth <= 0n) return "Initial liquidity must include a positive ETH amount.";
    if ((firstTokens === 0n) !== (firstBudget === 0n)) return "Enter both the creator first-buy token amount and ETH budget, or leave both empty.";
    if (firstTokens > total / 20n) return "Creator first buy cannot exceed 5% of total supply.";
    const taxNums = Object.fromEntries(Object.entries(tax).map(([key, value]) => [key, Number(value)]));
    const { start, floor, step, hold, interval } = taxNums;
    if (![start, floor, step].every((value) => Number.isInteger(value * 100)) || ![hold, interval].every(Number.isInteger)) return "Tax rates use 0.01% increments and time uses whole days.";
    if (start < 0 || start > 5 || floor < 0 || floor > start || step < 0 || step > 5 || hold < 0 || hold > 30) return "Tax values are outside the supported range.";
    if (!step && (floor !== start || hold !== 0 || interval !== 0)) return "A flat path needs matching start and floor rates, with zero hold and interval.";
    if (step && (floor >= start || interval < 1 || interval > 30 || hold + Math.max(0, Math.ceil((start - floor) / step) - 1) * interval > 365)) return "A Glide needs a lower floor, a 1–30 day interval and must reach its floor within 365 days.";
    if (snipe === "Long" && (!Number.isInteger(Number(longTax)) || Number(longTax) < 25 || Number(longTax) > 99 || !Number.isInteger(Number(longSeconds)) || Number(longSeconds) < 30 || Number(longSeconds) > 300)) return "Long opening protection requires 25–99% tax for 30–300 seconds.";
    if (recipients.length < 1 || recipients.length > 3) return "Choose one to three creator payout wallets.";
    const seen = new Set();
    for (const item of recipients) {
      if (!isAddress(item.address)) return "Enter a valid address for every creator payout wallet.";
      if (!Number.isInteger(Number(item.percent) * 100) || Number(item.percent) <= 0 || Number(item.percent) > 100) return "Each payout share must be greater than 0 and support 0.01% increments.";
      const key = item.address.toLowerCase();
      if (seen.has(key)) return "Creator payout wallets must be unique.";
      seen.add(key);
    }
    if (Math.round(payoutTotal * 100) !== 10000) return "Creator payout weights must add up to exactly 100%.";
    if (launchFee === null || balance === null) return "Could not read the factory fee or wallet ETH balance. Check your Robinhood Chain RPC connection.";
    if (balance < (totalWei ?? 0n)) return `Wallet balance is below the ${formatEther(totalWei ?? 0n)} ETH launch funding amount (gas is additional).`;
    return "";
  }

  async function createLaunch() {
    const error = validate();
    if (error) { setMessage(error); return; }
    setBusy(true); setMessage(""); setTransaction(null); setCreated(null);
    try {
      const totalSupply = parseEther(supply);
      const liquidityTokenAmount = parseEther(liquidityTokens);
      const quoteAmount = parseEther(liquidityEth);
      const creatorFirstBuyTokenAmount = parseEther(firstBuyTokens || "0");
      const creatorFirstBuyQuoteBudget = parseEther(firstBuyBudget || "0");
      const sqrtPriceX96 = integerSqrt((liquidityTokenAmount << 192n) / quoteAmount);
      const p = {
        startPips: BigInt(Math.round(Number(tax.start) * 10000)),
        floorPips: BigInt(Math.round(Number(tax.floor) * 10000)),
        stepPips: BigInt(Math.round(Number(tax.step) * 10000)),
        holdSeconds: BigInt(Number(tax.hold) * 86400),
        stepIntervalSeconds: BigInt(Number(tax.interval) * 86400),
      };
      const mode = snipe === "Quick" ? 1 : snipe === "Long" ? 2 : 0;
      const params = {
        name: name.trim(), symbol: symbol.trim().toUpperCase(), totalSupply, liquidityTokenAmount,
        creatorFirstBuyTokenAmount, creatorFirstBuyQuoteBudget,
        quoteCurrency: zeroAddress, quoteAmount, sqrtPriceX96,
        tradingOpensAt: BigInt(Math.floor(Date.now() / 1000)),
        buyPath: p, sellPath: p,
        snipe: { mode, startPips: mode === 1 ? 990000n : mode === 2 ? BigInt(Number(longTax) * 10000) : 0n, durationSeconds: mode === 1 ? 3 : mode === 2 ? Number(longSeconds) : 0 },
        payoutRecipients: [...recipients.map((item) => getAddress(item.address)), zeroAddress, zeroAddress].slice(0, 3),
        payoutWeightsBps: [...recipients.map((item) => BigInt(Math.round(Number(item.percent) * 100))), 0n, 0n].slice(0, 3),
      };
      const value = quoteAmount + creatorFirstBuyQuoteBudget + launchFee;
      const code = await publicClient.getCode({ address: FACTORY });
      if (!code || code === "0x") throw new Error("The GLIDY factory has no contract code on Robinhood Chain.");
      const simulation = await publicClient.simulateContract({ account: address, address: FACTORY, abi: factoryAbi, functionName: "createLaunch", args: [params], value });
      const hash = await walletClient.writeContract(simulation.request);
      setTransaction({ hash, status: "submitted" });
      const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      if (receipt.status !== "success") throw new Error(`Launch transaction reverted: ${EXPLORER}/tx/${hash}`);
      const events = parseEventLogs({ abi: factoryAbi, logs: receipt.logs, eventName: "LaunchCreated", strict: false });
      const event = events.find((log) => log.address.toLowerCase() === FACTORY.toLowerCase());
      if (!event?.args?.token) throw new Error(`Transaction succeeded, but the LaunchCreated event could not be read. View ${EXPLORER}/tx/${hash}`);
      setCreated({ token: event.args.token, poolId: event.args.poolId, hash });
      setTransaction({ hash, status: "confirmed" });
      if (tokenImage) await uploadSelectedImage(event.args.token, hash);
    } catch (error) {
      setMessage(error?.shortMessage || error?.message || "Launch transaction failed.");
      if (error?.transactionHash) setTransaction({ hash: error.transactionHash, status: "failed" });
    } finally { setBusy(false); }
  }

  const activeSteps = ["Token and funding", "Tax and shares", "Review and launch"];
  return <div className="launch-designer">
    <div className="app-heading"><div><p className="eyebrow"><i /> ROBINHOOD CHAIN <span>Factory launch</span></p><h1>Create your launch.</h1><p>Set the token, seed its pool and commit its tax path on-chain.</p></div></div>
    <div className="launch-steps">{activeSteps.map((label, index) => <button key={label} className={step === index ? "active" : ""} onClick={() => index < step && setStep(index)}><span>0{index + 1}</span><strong>{label}</strong></button>)}</div>
    <div className="launch-grid"><section className="launch-form">
      {step === 0 && <>
        <div className="designer-section-top"><span>01 / TOKEN AND FUNDING</span><span>Robinhood Chain · ETH</span></div><h2>Give your token its starting shape.</h2><p>The factory deploys a fixed-supply token and initializes its GLIDY pool using native ETH.</p>
        <div className="designer-names"><Field label="Token name"><input autoComplete="off" maxLength={64} placeholder="For example, Daylight" value={name} onChange={(event) => setName(event.target.value)} /></Field><Field label="Ticker" hint="1–10 letters or numbers"><input autoComplete="off" maxLength={10} placeholder="DAY" value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} /></Field></div>
        <Field label="Token image" hint="Optional · PNG, JPEG or WebP · up to 2 MB">
          <div className="launch-token-image-field">
            {tokenImagePreview ? <img src={tokenImagePreview} alt="Token image preview" /> : <span className="launch-token-image-placeholder">{(symbol || "GL").slice(0, 2).toUpperCase()}</span>}
            <div><input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Choose token image" onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
                setMessage("Choose a PNG, JPEG or WebP image up to 2 MB.");
                event.target.value = "";
                return;
              }
              setMessage(""); setImageUploadError(""); setImageUploadState("idle"); setTokenImage(file);
            }} />
              <small>{tokenImage ? tokenImage.name : "After launch confirmation, sign a wallet message to attach the image. No extra transaction or gas."}</small>
              {tokenImage && <button type="button" className="button" onClick={() => { setTokenImage(null); setImageUploadState("idle"); }}>Remove image</button>}
            </div>
          </div>
        </Field>
        <div className="form-two"><AmountField label="Total supply" hint="18 decimals" value={supply} onChange={setSupply} suffix={symbol || "TOKEN"} /><AmountField label="Initial pool tokens" hint="Must be below total supply" value={liquidityTokens} onChange={setLiquidityTokens} suffix={symbol || "TOKEN"} /></div>
        <AmountField label="Initial pool ETH" hint="Your wallet funds the initial liquidity" value={liquidityEth} onChange={setLiquidityEth} suffix="ETH" min="0.000000000000000001" />
        <div className="info-note"><p>Enter the ETH you want to commit to initial liquidity. Pool opening price is calculated from the token and ETH amounts; transaction gas is paid separately by your wallet.</p></div>
      </>}
      {step === 1 && <>
        <div className="designer-section-top"><span>02 / TAX AND SHARES</span><span>Buy and sell use the same path</span></div><h2>Set the tax path and payouts.</h2><p>The factory stores the selected buy and sell path when it creates the pool.</p>
        <div className="form-two">{[["Starting tax", "start", "%"], ["Tax floor", "floor", "%"], ["Step down", "step", "%"], ["Hold before first step", "hold", "days"], ["Time between steps", "interval", "days"]].map(([label, key, suffix]) => <AmountField key={key} label={label} value={tax[key]} onChange={(value) => setTax((current) => ({ ...current, [key]: value }))} suffix={suffix} />)}</div>
        <div className="designer-divider" />
        <Field label="Opening buy protection"><select value={snipe} onChange={(event) => setSnipe(event.target.value)}><option>Off</option><option>Quick</option><option>Long</option></select></Field>
        {snipe === "Long" && <div className="form-two"><AmountField label="Protection tax" value={longTax} onChange={setLongTax} suffix="%" /><AmountField label="Protection window" value={longSeconds} onChange={setLongSeconds} suffix="seconds" /></div>}
        {snipe === "Quick" && <div className="info-note"><p>Quick protection applies a 99% buy tax for the first three seconds.</p></div>}
        <div className="designer-divider" />
        <div className="designer-section-top"><span>CREATOR PAYOUT WALLETS</span><span>{payoutTotal.toFixed(2)}% assigned</span></div>
        {recipients.map((recipient, index) => <div className="form-two payout-row" key={index}><Field label={`Wallet ${index + 1}`}><input spellCheck="false" placeholder="0x…" value={recipient.address} onChange={(event) => { setPayoutEdited(true); setRecipients((current) => current.map((item, i) => i === index ? { ...item, address: event.target.value.trim() } : item)); }} /></Field><AmountField label="Share" value={recipient.percent} onChange={(value) => { setPayoutEdited(true); setRecipients((current) => current.map((item, i) => i === index ? { ...item, percent: value } : item)); }} suffix="%" /></div>)}
        {recipients.length < 3 && <button className="button" onClick={() => { setPayoutEdited(true); setRecipients((current) => current.length === 1 ? [{ ...current[0], percent: "50" }, { address: "", percent: "50" }] : [...current, { address: "", percent: "0" }]); }}><Plus size={14} />Add payout wallet</button>}
        {recipients.length > 1 && <button className="button" onClick={() => { setPayoutEdited(true); setRecipients((current) => current.slice(0, -1)); }}>Remove last wallet</button>}
        <div className="designer-divider" />
        <div className="designer-section-top"><span>OPTIONAL CREATOR FIRST BUY</span><span>Executes atomically with launch</span></div>
        <div className="form-two"><AmountField label="Tokens to buy" hint="Up to 5% of supply" value={firstBuyTokens} onChange={setFirstBuyTokens} suffix={symbol || "TOKEN"} /><AmountField label="Maximum ETH budget" hint="Unused ETH is refunded" value={firstBuyBudget} onChange={setFirstBuyBudget} suffix="ETH" /></div>
        <div className="info-note"><p>Your first buy runs at launch and requires both fields. Leave both empty to skip it.</p></div>
      </>}
      {step === 2 && <>
        <div className="designer-section-top"><span>03 / REVIEW</span><span>On-chain transaction</span></div><h2>Check it, then create the launch.</h2><p>Your wallet will show the exact transaction before you sign it.</p>
        <dl className="path-definition"><div><dt>Token</dt><dd>{name || "Unnamed token"} ({symbol || "—"})</dd></div><div><dt>Supply</dt><dd>{supply} {symbol}</dd></div><div><dt>Initial pool</dt><dd>{liquidityTokens} {symbol} + {liquidityEth || "0"} ETH</dd></div><div><dt>Opening price</dt><dd>{Number(liquidityEth) > 0 ? `${(Number(liquidityTokens) / Number(liquidityEth)).toLocaleString()} ${symbol} per ETH` : "Enter initial ETH funding to calculate"}</dd></div><div><dt>Tax path</dt><dd>{tax.start}% to {tax.floor}% · {tax.step}% every {tax.interval} days</dd></div><div><dt>Creator payouts</dt><dd>{recipients.map((item) => `${item.percent}% to ${item.address.slice(0, 8)}…${item.address.slice(-4)}`).join(" · ")}</dd></div><div><dt>First buy</dt><dd>{firstBuyTokens ? `${firstBuyTokens} ${symbol} · up to ${firstBuyBudget} ETH` : "Not included"}</dd></div><div><dt>Factory fee</dt><dd>{launchFee === null ? "Reading…" : `${formatEther(launchFee)} ETH`}</dd></div><div><dt>Wallet balance</dt><dd>{balance === null ? "Reading…" : `${Number(formatEther(balance)).toFixed(5)} ETH (gas additional)`}</dd></div><div><dt>Total launch funding</dt><dd>{totalWei === null ? "Check amounts" : `${formatEther(totalWei)} ETH + gas`}</dd></div></dl>
        <div className="info-note"><p>Signing deploys the token, initializes its pool and stores the launch settings atomically. Confirm the amounts and transaction in your wallet.</p></div>
      </>}
      {message && <p className="form-message" role="alert">{message}</p>}
      {transaction && <p className="form-message" role="status">Transaction {transaction.status}: <a href={`${EXPLORER}/tx/${transaction.hash}`} target="_blank" rel="noreferrer">{transaction.hash.slice(0, 12)}…{transaction.hash.slice(-8)} <ArrowUpRight size={13} /></a></p>}
      {created && <div className="launch-created"><Check size={18} /><div><strong>Launch confirmed on Robinhood Chain.</strong><p>Token <a href={`${EXPLORER}/address/${created.token}`} target="_blank" rel="noreferrer">{created.token}</a></p><p>Pool ID <code>{created.poolId}</code></p>{tokenImage && <p role="status">{imageUploadState === "uploading" ? "Saving token image…" : imageUploadState === "saved" ? "Token image saved." : imageUploadState === "error" ? imageUploadError : "Token image pending."}</p>}{imageUploadState === "error" && <button type="button" className="button" onClick={() => uploadSelectedImage(created.token, created.hash)}>Retry image upload</button>}<a href={`#/market/${created.token}`} className="inline-link">Open launch details <ArrowUpRight size={13} /></a></div><button className="button" onClick={async () => { await navigator.clipboard.writeText(created.token); setCopied(true); }}><Copy size={14} />{copied ? "Copied" : "Copy token"}</button></div>}
      <div className="form-actions">{step > 0 && <button className="button" disabled={busy} onClick={() => { setStep(step - 1); setMessage(""); }}>Back</button>}{step < 2 ? <button className="button dark" onClick={() => { if (step === 0) { if (!name.trim() || !/^[A-Z0-9]{1,10}$/.test(symbol.trim())) { setMessage("Enter a token name and a ticker of 1–10 letters or numbers."); return; } try { if (parseEther(liquidityEth) <= 0n || parseEther(liquidityTokens) >= parseEther(supply)) throw new Error(); } catch { setMessage("Enter a positive ETH amount and keep initial pool tokens below total supply."); return; } } setMessage(""); setStep(step + 1); }}>Continue</button> : <button className="button dark" disabled={busy || !address} onClick={createLaunch}>{busy ? "Waiting for confirmation…" : "Create launch"}<ArrowUpRight size={15} /></button>}</div>
    </section>
    <aside className="launch-preview"><div className="panel"><div className="panel-head"><span>LAUNCH CHECK</span><span className="terminal-dot" /></div><div className="launch-preview-title"><span>FACTORY</span><strong>GLIDY · Robinhood Chain</strong></div><div className="path-stats"><div><strong>{tax.start}%</strong><span>starting tax</span></div><div><strong>{tax.floor}%</strong><span>tax floor</span></div></div><div className="panel-foot"><span>Fixed supply</span><strong>{symbol || "TOKEN"}</strong></div><div className="panel-foot"><span>Quote asset</span><strong>Native ETH</strong></div><div className="panel-foot"><span>Creator share</span><strong>{payoutTotal.toFixed(2)}%</strong></div><div className="panel-foot"><span>Factory address</span><a href={`${EXPLORER}/address/${FACTORY}`} target="_blank" rel="noreferrer">{FACTORY.slice(0, 8)}…{FACTORY.slice(-6)} <ArrowUpRight size={12} /></a></div></div><p className="small-copy">GLIDY factory transaction · token and pool are created together.</p></aside></div>
  </div>;
}
