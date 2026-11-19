import React, { useEffect, useId } from "react";
import { useVisibleMotion } from "./useVisibleMotion";

/** Animated UI counterpart of the supplied soft-eye mark; no network or AI service. */
export function SoftEyes({ active = false, follow = false, className = "" }) {
  const id = "eyes" + useId().replaceAll(":", "");
  const motion = useVisibleMotion();
  useEffect(() => {
    const node = motion.ref.current;
    if (!follow || !motion["data-animating"] || !node) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    const reset = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      node.style.setProperty("--look-x", "0px");
      node.style.setProperty("--look-y", "0px");
    };
    const move = (event) => {
      if (
        event.pointerType === "touch" ||
        reduced.matches ||
        node.closest('[data-motion="off"]') ||
        document.hidden
      ) {
        reset();
        return;
      }
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const bounds = node.getBoundingClientRect();
        const x = Math.max(
          -3.5,
          Math.min(3.5, (event.clientX - bounds.left - bounds.width / 2) / 70),
        );
        const y = Math.max(
          -3,
          Math.min(3, (event.clientY - bounds.top - bounds.height / 2) / 85),
        );
        node.style.setProperty("--look-x", x + "px");
        node.style.setProperty("--look-y", y + "px");
      });
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", reset);
    reduced.addEventListener("change", reset);
    return () => {
      reset();
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", reset);
      reduced.removeEventListener("change", reset);
    };
  }, [follow, motion["data-animating"]]);
  return (
    <span
      {...motion}
      className={
        "path-bot soft-eyes " + (active ? "is-talking " : "") + className
      }
      aria-hidden="true"
    >
      <svg viewBox="0 0 136 120" fill="none">
        <defs>
          <radialGradient id={id + "ivory"} cx="27%" cy="21%" r="87%">
            <stop stopColor="#fffdfa" />
            <stop offset=".45" stopColor="#f3eae3" />
            <stop offset=".79" stopColor="#d9cbbb" />
            <stop offset="1" stopColor="#ffecae" />
          </radialGradient>
          <linearGradient id={id + "violet"} x1=".2" y1="0" x2=".7" y2="1">
            <stop stopColor="#bba3ff" />
            <stop offset=".29" stopColor="#7146fa" />
            <stop offset=".58" stopColor="#3d20c3" />
            <stop offset="1" stopColor="#281586" />
          </linearGradient>
          <radialGradient id={id + "pupil"} cx="30%" cy="18%" r="95%">
            <stop stopColor="#8862ff" />
            <stop offset=".43" stopColor="#4b2aca" />
            <stop offset="1" stopColor="#221076" />
          </radialGradient>
          <linearGradient id={id + "shine"} x2=".5" y2="1">
            <stop stopColor="#f8e9ff" />
            <stop offset="1" stopColor="#bd93ff" stopOpacity=".25" />
          </linearGradient>
          <filter
            id={id + "shadow"}
            x="-50%"
            y="-50%"
            width="200%"
            height="200%"
          >
            <feGaussianBlur stdDeviation="2.3" />
          </filter>
        </defs>
        <ellipse
          className="eye-ground"
          cx="68"
          cy="111"
          rx="37"
          ry="3"
          fill="#80659a"
          opacity=".13"
          filter={"url(#" + id + "shadow)"}
        />
        <g className="eye-float">
          <g
            className="eye-brows"
            fill={"url(#" + id + "violet)"}
            stroke="#c1a9ff"
            strokeWidth=".7"
          >
            <path d="M21 25 53 23C64 22 65 35 54 36L23 38C12 39 11 26 21 25Z" />
            <path d="M80 28C92 10 111 10 122 26C128 35 117 41 111 34C104 27 96 29 90 36C83 44 73 37 80 28Z" />
          </g>
          <g className="eye-blink">
            <g transform="rotate(17 40 73)">
              <ellipse
                cx="40"
                cy="73"
                rx="24"
                ry="32"
                fill={"url(#" + id + "ivory)"}
              />
              <ellipse
                cx="38"
                cy="64"
                rx="13"
                ry="20"
                fill="white"
                opacity=".13"
              />
              <g className="eye-pupil">
                <ellipse
                  cx="42"
                  cy="71"
                  rx="11.5"
                  ry="20"
                  fill={"url(#" + id + "pupil)"}
                  stroke="#4d26ac"
                  strokeWidth=".6"
                />
                <ellipse
                  cx="38"
                  cy="63"
                  rx="4.2"
                  ry="7.5"
                  fill={"url(#" + id + "shine)"}
                />
              </g>
            </g>
            <g transform="rotate(17 98 68)">
              <ellipse
                cx="98"
                cy="68"
                rx="24"
                ry="31"
                fill={"url(#" + id + "ivory)"}
              />
              <ellipse
                cx="96"
                cy="59"
                rx="13"
                ry="20"
                fill="white"
                opacity=".13"
              />
              <g className="eye-pupil">
                <ellipse
                  cx="98"
                  cy="66"
                  rx="11.5"
                  ry="19.5"
                  fill={"url(#" + id + "pupil)"}
                  stroke="#4d26ac"
                  strokeWidth=".6"
                />
                <ellipse
                  cx="94"
                  cy="58"
                  rx="4.2"
                  ry="7.5"
                  fill={"url(#" + id + "shine)"}
                />
              </g>
            </g>
          </g>
        </g>
      </svg>
    </span>
  );
}
