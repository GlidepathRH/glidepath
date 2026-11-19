import React from "react";
import {
  Check,
  ArrowLeftRight,
  TrendingDown,
  Minus,
  ShieldOff,
  Zap,
  Timer,
} from "lucide-react";
import { FieldHeading } from "./LaunchGuide";
import { QUOTE_ASSETS, quoteAsset } from "./quote-assets.mjs";

export function QuoteLogo({ symbol, decorative = false }) {
  const asset = quoteAsset(symbol);
  if (!asset) return null;
  return (
    <span className={"quote-logo quote-logo-" + symbol.toLowerCase()}>
      <img
        src={asset.image}
        alt={decorative ? "" : asset.name + " (" + symbol + ") logo"}
        width="36"
        height="36"
      />
    </span>
  );
}

export function QuoteAssetPicker({ value, onChange, guideData }) {
  return (
    <div className="field quote-asset-field">
      <FieldHeading
        label="Quote asset"
        field="quote"
        data={guideData}
        htmlFor="quote-ETH"
      />
      <p className="field-caption" id="quote-explained">
        What people trade your token against.
      </p>
      <div
        className="quote-choices"
        role="radiogroup"
        aria-label="Quote asset"
        aria-describedby="quote-explained"
      >
        {QUOTE_ASSETS.map((asset) => (
          <label className="quote-choice" key={asset.symbol}>
            <input
              className="choice-input"
              type="radio"
              name="launch-quote"
              id={"quote-" + asset.symbol}
              value={asset.symbol}
              checked={value === asset.symbol}
              onChange={() => onChange(asset.symbol)}
            />
            <span className="quote-choice-face">
              <QuoteLogo symbol={asset.symbol} decorative />
              <span className="quote-choice-name">
                <strong>{asset.symbol}</strong>
                <span>{asset.name}</span>
              </span>
              <small>{asset.kind}</small>
              <span className="choice-selected">
                <Check size={11} />
                Selected
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

const styleOptions = [
  {
    value: "Glide",
    Icon: TrendingDown,
    label: "Glide",
    copy: "Tax falls on your schedule.",
  },
  { value: "Flat", Icon: Minus, label: "Flat", copy: "No automatic cuts." },
];
const protectionOptions = [
  {
    value: "Off",
    Icon: ShieldOff,
    label: "Off",
    copy: "Normal tax from the start.",
  },
  {
    value: "Quick",
    Icon: Zap,
    label: "Quick",
    copy: "99% opening buy tax · 3s",
  },
  { value: "Long", Icon: Timer, label: "Custom", copy: "25–99% · 30–300s" },
];
export function DesignerChoices({ kind, value, onChange, guideData }) {
  const options = kind === "style" ? styleOptions : protectionOptions;
  const label = kind === "style" ? "Tax path" : "Opening protection";
  return (
    <div className="field designer-choice-field">
      <FieldHeading
        label={label}
        field={kind === "style" ? "style" : "snipe"}
        data={guideData}
        htmlFor={kind + "-" + options[0].value}
      />
      <div
        className={"designer-choices " + kind}
        role="radiogroup"
        aria-label={label}
      >
        {options.map(({ value: id, label, copy, Icon }) => (
          <label className="designer-choice" key={id}>
            <input
              className="choice-input"
              type="radio"
              name={"launch-" + kind}
              id={kind + "-" + id}
              value={id}
              checked={value === id}
              onChange={() => onChange(id)}
            />
            <span className="designer-choice-face">
              <Icon size={20} />
              <strong>{label}</strong>
              <small>{copy}</small>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function LaunchIdentity({ name, symbol, logo, quote, review = false }) {
  return (
    <div className={"designer-identity " + (review ? "review" : "")}>
      <div className="designer-identity-top">
        <span>{review ? "YOUR CONFIGURATION" : "YOUR LAUNCH"}</span>
        <b>Preview</b>
      </div>
      <div className="designer-identity-main">
        <div className="designer-token-art">
          {logo ? (
            <img
              src={logo.dataUrl}
              alt={(name || "Your token") + " uploaded logo"}
            />
          ) : (
            <span>{symbol?.slice(0, 2) || "✳"}</span>
          )}
        </div>
        <div>
          <strong>{name || "Your token name"}</strong>
          <span>{symbol ? "$" + symbol : "TICKER"}</span>
        </div>
      </div>
      <div className="designer-pair">
        <span className="pair-caption">Trading pair</span>
        <b>{symbol || "TOKEN"}</b>
        <ArrowLeftRight size={13} />
        <QuoteLogo symbol={quote} decorative />
        <b>{quote}</b>
      </div>
      <div className="designer-identity-foot">
        <i />
        Robinhood Chain<span>Local draft</span>
      </div>
    </div>
  );
}
