import React, { useEffect, useId, useRef, useState } from "react";
import { ArrowRight, ChevronLeft, X } from "lucide-react";
import { Link } from "./ui";
import { useVisibleMotion } from "./useVisibleMotion";

export { SoftEyes as PathBot } from "./SoftEyes";
import { SoftEyes as PathBot } from "./SoftEyes";

const topics = [
  [
    "What does the tax mean?",
    "In a GLIDY example, a 3% token tax takes $3 on a $100 trade. The separate 0.30% base fee adds 30¢. Gas, slippage and price changes are extra. Early buys may cost more if opening protection is on.",
  ],
  [
    "Can a creator raise it?",
    "The specified GLIDY pool only allows the tax to fall. Creators can cut sooner, even below the scheduled floor. They cannot raise it again or rewrite the schedule. The token price can still fall.",
  ],
  [
    "What’s on the back of a card?",
    "The main gallery uses real Robinhood token snapshots. Tax details show the reported creator fee, not a GLIDY schedule. Choose Demo tax paths to explore a GLIDY schedule with a floor and automatic cuts.",
  ],
];
export function PathAssistant({ route }) {
  const [open, setOpen] = useState(false),
    [topic, setTopic] = useState(null),
    ref = useRef(),
    panel = useRef(),
    trigger = useRef(),
    id = useId();
  const dismiss = () => {
    setOpen(false);
    trigger.current?.focus();
  };
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector(
          topic === null ? ".pal-topics button" : ".pal-answer h3",
        )
        ?.focus();
  }, [open, topic]);
  useEffect(() => {
    if (!open) return;
    const key = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const outside = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", key);
    document.addEventListener("pointerdown", outside);
    return () => {
      document.removeEventListener("keydown", key);
      document.removeEventListener("pointerdown", outside);
    };
  }, [open]);
  return (
    <div className="path-assistant" ref={ref}>
      {open && (
        <section
          ref={panel}
          className="pal-panel"
          id={id}
          aria-label="Path guide"
        >
          <header>
            <span>YOUR PATH GUIDE</span>
            <button
              className="ws-icon"
              aria-label="Close path guide"
              onClick={dismiss}
            >
              <X size={16} />
            </button>
          </header>
          <div className="pal-intro">
            <PathBot active />
            <div>
              <h2>
                {topic === null ? "A little help?" : "Here’s how it works."}
              </h2>
              <p>
                {topic === null
                  ? "Pick a question. I’ll keep it simple."
                  : "One setting at a time."}
              </p>
            </div>
          </div>
          {topic === null ? (
            <div className="pal-topics">
              {topics.map(([q], i) => (
                <button key={q} onClick={() => setTopic(i)}>
                  {q}
                  <ArrowRight size={14} />
                </button>
              ))}
            </div>
          ) : (
            <div className="pal-answer">
              <button onClick={() => setTopic(null)}>
                <ChevronLeft size={13} />
                All questions
              </button>
              <h3 tabIndex={-1}>{topics[topic][0]}</h3>
              <p>{topics[topic][1]}</p>
            </div>
          )}
          <footer>
            <span>Built-in guide · sample workspace</span>
            <Link
              to={route === "launch" ? "/docs/overview" : "/launch"}
              onClick={() => setOpen(false)}
            >
              {route === "launch" ? "Read the rules" : "Try the designer"}
              <ArrowRight size={12} />
            </Link>
          </footer>
        </section>
      )}
      <button
        ref={trigger}
        className="pal-launcher"
        aria-label={open ? "Close path guide" : "Open path guide"}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen(!open)}
      >
        <span className="pal-launcher-label">
          {open ? "Got it." : "Need a hand?"}
        </span>
        <PathBot active={open} follow />
      </button>
    </div>
  );
}
