import { PathBot } from "./PathBot";
import React, { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Lock, X } from "lucide-react";
import { floorDay, pct, usd } from "./tax.mjs";

export function guideCopy(
  field,
  { path, name, symbol, quote, style, snipe, longStart, windowSecs } = {},
) {
  const p = path || { start: 300, floor: 100, hold: 2, step: 20, interval: 7 };
  const clean = (v) => (Number.isFinite(v) ? v : "…"),
    rate = (v) => (Number.isFinite(v) ? pct(v) : "…");
  const content = {
    name: [
      "Token name",
      "The name people see when they open your launch. Use your project’s real name so it is easy to recognize.",
      `For example: ${name || "Orbit"}. This is separate from the short ticker.`,
      null,
    ],
    symbol: [
      "Ticker",
      "Your token’s short label. Use 1–10 letters or numbers. A ticker is a label, not proof that a token belongs to a particular project.",
      `People would see $${symbol || "ORBT"} beside your token. Other projects may use the same ticker.`,
      null,
    ],
    logo: [
      "Launch logo",
      "Use the exact artwork your project owns or has permission to use. The preview keeps the original shape and colors.",
      "PNG, JPG or WebP, up to 1 MB. This file stays in your browser draft until you export it.",
      "A logo is not a verification badge. Check the project and contract before trading.",
    ],
    quote: [
      "Quote asset",
      "This is the asset paired with your token in the trading pool. People use it to buy your token and receive it when selling.",
      `With ${quote || "ETH"}, the pool trades your token against ${quote || "ETH"}. This does not set or guarantee your token’s price.`,
      "The trading pair is part of the launch configuration.",
    ],
    style: [
      "Launch style",
      "Glide lowers the tax on a schedule. Flat keeps the same tax unless the creator chooses to cut it.",
      style === "Flat"
        ? "Flat has no automatic cuts. The starting tax and floor match."
        : "Glide lets you choose the first cut, how big each cut is and how often it happens.",
      "Once deployed, the schedule cannot be rewritten. Creator cuts can only lower the tax.",
    ],
    start: [
      "Starting tax",
      "The token tax on each buy or sell when normal trading begins. The separate 0.30% base fee is added to every trade.",
      `At ${rate(p.start)}, a $100 trade has ${Number.isFinite(p.start) ? usd(p.start / 100) : "…"} in token tax plus $0.30 base fee. Opening protection can make early buys cost more.`,
      "Maximum 5% per side. This designer uses the same buy and sell schedule.",
    ],
    floor: [
      "Scheduled floor",
      "The lowest rate the automatic schedule reaches. It is not a minimum the creator must charge.",
      `This schedule ends at ${rate(p.floor)}. A creator could choose to cut below that, even to 0%. The 0.30% base fee still applies.`,
      "The creator cannot raise the tax again after a cut.",
    ],
    hold: [
      "Wait before the first cut",
      "How long the starting tax stays in place. The clock starts with the first trade, not when you fill out this form.",
      p.hold === 0
        ? "With 0 days, the first scheduled reduction happens immediately when the clock starts."
        : `With ${clean(p.hold)} days, the first cut happens at day ${clean(p.hold)}. Later cuts follow your step interval.`,
      "Choose 0–30 whole days.",
    ],
    step: [
      "Size of each cut",
      "How many percentage points come off the tax at each scheduled step. This is a subtraction from the rate.",
      `A ${clean(p.step / 100)} percentage-point cut takes ${rate(p.start)} to ${rate(Math.max(p.floor, p.start - p.step))} at the first step. The last cut stops at your floor.`,
      "A Glide needs a positive cut and must reach its floor within 365 days.",
    ],
    interval: [
      "Time between cuts",
      "The gap between scheduled reductions after the first one.",
      `With a ${clean(p.interval)}-day interval, cuts happen on days ${clean(p.hold)}, ${clean(p.hold + p.interval)}, ${clean(p.hold + 2 * p.interval)} and so on, until the floor.`,
      "Choose 1–30 whole days. The first cut is set by the initial hold.",
    ],
    snipe: [
      "Opening protection",
      "A temporary extra-high tax on early buys, intended to discourage bots from buying first. Early human buyers pay it too. Sells keep the normal tax.",
      snipe === "Quick"
        ? "Quick starts at 99% and falls over 3 seconds. A $100 opening buy could incur $99 tax plus the $0.30 base fee."
        : snipe === "Long"
          ? `Long starts at ${clean(longStart)}% and falls over ${clean(windowSecs)} seconds. Buys pay whichever is higher: this opening tax or the normal tax.`
          : "Off means normal tax applies from the first trade. Quick lasts 3 seconds; Long lets you choose 30–300 seconds.",
      "Opening and normal taxes are compared, not added. The window can end early but cannot be extended.",
    ],
    opening: [
      "Opening buy tax",
      "The rate that early buys start at during Long protection. It falls through the opening window. A high setting leaves early buyers with much less of their purchase.",
      `At ${clean(longStart)}%, a $100 opening buy could incur ${Number.isFinite(longStart) ? usd(longStart) : "…"} in tax plus $0.30 base fee.`,
      "Choose 25–99%. When opening tax is higher, its split is 90% creator and 10% platform.",
    ],
    window: [
      "Opening window",
      "How many seconds the temporary buy protection takes to wind down.",
      `At ${clean(windowSecs)} seconds, the opening rate falls to zero over that period. The normal tax still applies whenever it is higher.`,
      "Choose 30–300 whole seconds. It can end early, but cannot be extended.",
    ],
  };
  return (
    content[field] || [
      "Path guide",
      "Choose a setting to see how it works.",
      "",
      "",
    ]
  );
}
export function LaunchHelp({ field, data }) {
  const [open, setOpen] = useState(false),
    [pinned, setPinned] = useState(false),
    [position, setPosition] = useState({ left: 0, top: 0 }),
    id = useId(),
    button = useRef(),
    bubble = useRef(),
    timer = useRef(),
    suppressFocus = useRef(false);
  const [title, copy, example, rule] = guideCopy(field, data);
  const show = () => {
    clearTimeout(timer.current);
    const r = button.current.getBoundingClientRect();
    setPosition({
      left: Math.max(12, Math.min(innerWidth - 312, r.left - 20)),
      top: r.bottom + 10,
    });
    setOpen(true);
  };
  const close = () => {
    clearTimeout(timer.current);
    setOpen(false);
    setPinned(false);
  };
  const leave = () => {
    if (!pinned) timer.current = setTimeout(() => setOpen(false), 160);
  };
  useEffect(() => {
    if (!open) return;
    const locate = () => {
      const r = button.current?.getBoundingClientRect(),
        b = bubble.current?.getBoundingClientRect();
      if (r && b)
        setPosition({
          left: Math.max(12, Math.min(innerWidth - b.width - 12, r.left - 20)),
          top:
            r.bottom + b.height + 20 > innerHeight
              ? Math.max(12, r.top - b.height - 10)
              : r.bottom + 10,
        });
    };
    locate();
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        suppressFocus.current = true;
        button.current?.focus();
        suppressFocus.current = false;
      }
    };
    const outside = (e) => {
      if (
        !button.current?.contains(e.target) &&
        !bubble.current?.contains(e.target)
      )
        close();
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  }, [open, title, copy, example]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <span className="launch-help" onMouseEnter={show} onMouseLeave={leave}>
      <button
        type="button"
        ref={button}
        className="guide-trigger"
        aria-label={"Explain " + title.toLowerCase()}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onFocus={() => {
          if (!suppressFocus.current) show();
        }}
        onBlur={(e) => {
          if (!bubble.current?.contains(e.relatedTarget) && !pinned) close();
        }}
        onClick={(e) => {
          e.preventDefault();
          if (pinned) close();
          else {
            setPinned(true);
            show();
          }
        }}
      >
        <PathBot active={open} />
      </button>
      {open &&
        createPortal(
          <div
            ref={bubble}
            id={id}
            role="tooltip"
            className="guide-popover"
            style={position}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={leave}
          >
            <div className="guide-popover-head">
              <div className="guide-bot">
                <PathBot active />
              </div>
              <div>
                <span>{title}</span>
                <small>Path guide · in plain language</small>
              </div>
              <button
                type="button"
                className="guide-close"
                aria-label="Close explanation"
                onClick={close}
              >
                <X size={13} />
              </button>
            </div>
            <p>{copy}</p>
            <div className="guide-example">{example}</div>
            {rule && (
              <div className="guide-rule">
                <Lock size={11} />
                <span>{rule}</span>
              </div>
            )}
          </div>,
          document.querySelector(".workspace") || document.body,
        )}
    </span>
  );
}
export function FieldHeading({ label, field, data, htmlFor }) {
  return (
    <div className="field-heading">
      <label htmlFor={htmlFor}>{label}</label>
      <LaunchHelp field={field} data={data} />
    </div>
  );
}
export function LaunchCoach({ step }) {
  return (
    <div className="launch-coach">
      <div className="guide-bot">
        <PathBot />
      </div>
      <div>
        <b>
          {step === 2
            ? "One last look."
            : step === 1
              ? "Watch your tax take shape."
              : "Need a hand?"}
        </b>
        <p>
          {step === 2
            ? "Check the pair and tax rules below. You’re saving a draft; no transaction is sent."
            : step === 1
              ? "The chart updates as you edit. Tap a little bot for an example using your numbers."
              : "Hover or tap a little bot beside any field. I’ll explain what it means."}
        </p>
      </div>
    </div>
  );
}
export function ReviewCommitment({ path, style, snipe }) {
  return (
    <div className="review-commitment">
      <h3>What this means for your buyers</h3>
      <p>
        Normal buys and sells start at {pct(path.start)}, plus the separate
        0.30% base fee.{" "}
        {style === "Flat"
          ? "There are no automatic tax cuts."
          : `The first reduction is on day ${path.hold}. The rate then drops by ${path.step / 100} percentage points every ${path.interval} days, reaching ${pct(path.floor)} on day ${floorDay(path)}.`}
      </p>
      <p>
        {snipe !== "Off"
          ? "Early buys may pay much more during opening protection. "
          : ""}
        After deployment, you cannot raise this tax or rewrite its schedule. You
        can choose to lower it faster. This commitment does not guarantee the
        token’s price.
      </p>
    </div>
  );
}
