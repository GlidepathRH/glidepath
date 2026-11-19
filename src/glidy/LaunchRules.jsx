import React from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  Lock,
} from "lucide-react";
import { Link } from "./ui";
import { PathBot } from "./PathBot";
import { useVisibleMotion } from "./useVisibleMotion";

function RuleScene({ kind }) {
  const motion = useVisibleMotion();
  return (
    <div
      {...motion}
      className={"rule-scene rule-scene-" + kind}
      aria-hidden="true"
    >
      {kind === "steps" ? (
        <div className="rule-schedule">
          <div className="rule-mini-heading">
            <i />
            YOUR SCHEDULE<span>3% → 1%</span>
          </div>
          <div className="rule-steps">
            {[
              ["3%", "DAY 0"],
              ["2.8%", "DAY 2"],
              ["2.6%", "DAY 9"],
            ].map(([rate, day], i) => (
              <div key={day} style={{ "--i": i }}>
                <b>{rate}</b>
                <span>{day}</span>
              </div>
            ))}
            <span className="rule-step-cursor" />
          </div>
          <div className="rule-mini-foot">
            <Lock size={9} />
            Set before the first trade
          </div>
        </div>
      ) : kind === "ceiling" ? (
        <div className="rule-ceiling">
          <div className="rule-mini-heading">
            <i />
            CREATOR CUT<span>LOWER ONLY</span>
          </div>
          <div className="rule-rate-change">
            <span>3.0%</span>
            <ArrowDownRight />
            <strong>1.0%</strong>
          </div>
          <div className="rule-cut-receipt">
            <span>
              <Check size={10} />
              Ceiling lowered
            </span>
            <Lock size={11} />
          </div>
        </div>
      ) : kind === "fees" ? (
        <div className="rule-fee-receipt">
          <div className="rule-mini-heading">
            <i />
            $100 TRADE<span>3% TAX</span>
          </div>
          <div>
            <span>Creator</span>
            <b>$2.60</b>
          </div>
          <div>
            <span>Platform tax share</span>
            <b>$0.40</b>
          </div>
          <div>
            <span>Base fee</span>
            <b>$0.30</b>
          </div>
          <footer>
            Total fee<strong>$3.30</strong>
          </footer>
        </div>
      ) : (
        <div className="rule-liquidity">
          <div className="rule-mini-heading">
            <i />
            POOL LIQUIDITY<span>AT TARGET</span>
          </div>
          <div className="rule-lock-scene">
            <div className="rule-lock-disc">
              <Lock size={23} strokeWidth={1.4} />
            </div>
            <span>
              Target reached<b>Liquidity locked</b>
            </span>
          </div>
          <div className="rule-lock-track">
            <i />
            <span>
              <Check size={9} />
            </span>
          </div>
          <div className="rule-mini-foot">Specified pool · permanent lock</div>
        </div>
      )}
    </div>
  );
}
export function LaunchRules() {
  return (
    <section className="launch-rules">
      <div className="launch-rules-heading">
        <PathBot />
        <div>
          <span className="micro-label">A LITTLE HELP BEFORE YOU LAUNCH</span>
          <h2>Know what you’re setting.</h2>
          <p>Four things to understand before the first trade.</p>
        </div>
        <Link to="/docs/overview">
          Read the rules
          <ArrowUpRight size={13} />
        </Link>
      </div>
      <div className="launch-rules-grid">
        {[
          [
            "steps",
            "Choose the way down.",
            "Pick the first cut, its size and how often it happens.",
            "Try a schedule",
            "/lab",
          ],
          [
            "ceiling",
            "Cut sooner if you want.",
            "Creators can lower the tax further. They cannot raise it back.",
            "Try a creator cut",
            "/lab",
          ],
          [
            "fees",
            "See the full fee.",
            "Token tax and the separate base fee, explained in dollars.",
            "Run the numbers",
            "/lab",
          ],
          [
            "liquidity",
            "Keep liquidity in place.",
            "The specified pool locks its liquidity permanently at the target.",
            "See how it works",
            "/docs/overview",
          ],
        ].map(([kind, title, copy, cta, to]) => (
          <Link className="launch-rule-card" to={to} key={kind}>
            <RuleScene kind={kind} />
            <div className="launch-rule-copy">
              <h3>{title}</h3>
              <p>{copy}</p>
              <span>
                {cta}
                <ArrowRight size={12} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
