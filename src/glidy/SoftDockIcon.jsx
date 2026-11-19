import React, { useId } from "react";

/** One purple symbol per destination, with a shared optical weight and finish. */
export function SoftDockIcon({ kind, size = 25 }) {
  const id = "dock" + useId().replaceAll(":", "");
  const paths = {
    explore:
      "M12 2.7a9.3 9.3 0 1 0 0 18.6 9.3 9.3 0 0 0 0-18.6Zm0 2.2a7.1 7.1 0 1 1 0 14.2 7.1 7.1 0 0 1 0-14.2Zm4.5 2.6-2.8 6.2-6.2 2.8 2.8-6.2 6.2-2.8Z",
    trending:
      "M14.1 4.5h5.2a1.2 1.2 0 0 1 1.2 1.2v5.2a1.2 1.2 0 0 1-2.4 0V8.6l-5.2 5.2a1.2 1.2 0 0 1-1.7 0l-3-3-4.7 4.7a1.2 1.2 0 0 1-1.7-1.7l5.5-5.5a1.2 1.2 0 0 1 1.7 0l3 3 4.4-4.4h-2.3a1.2 1.2 0 1 1 0-2.4Z",
    watchlist:
      "M7 2.8h10a2.2 2.2 0 0 1 2.2 2.2v15.1a1.1 1.1 0 0 1-1.7.9L12 17.5 6.5 21a1.1 1.1 0 0 1-1.7-.9V5A2.2 2.2 0 0 1 7 2.8Zm0 2.2v13.1l4.4-2.8a1.1 1.1 0 0 1 1.2 0l4.4 2.8V5H7Z",
    launch:
      "M3.1 9.4 19.9 3c.8-.3 1.4.3 1.1 1.1l-6.4 16.8c-.3.9-1.6 1-2 .1l-3.3-6.3 6.8-6.8-8 5.7-5.1-2.2c-.9-.4-.8-1.7.1-2Z",
    lab: "M3.5 4.5h5a1.2 1.2 0 0 1 1.2 1.2v3.6h4a1.2 1.2 0 0 1 1.2 1.2v3.6h5.6a1.2 1.2 0 1 1 0 2.4h-6.8a1.2 1.2 0 0 1-1.2-1.2v-3.6h-4a1.2 1.2 0 0 1-1.2-1.2V6.9H3.5a1.2 1.2 0 1 1 0-2.4Z",
    docs: "M3.2 3.8c3.4-.9 5.8-.3 8.8 1.7 3-2 5.4-2.6 8.8-1.7.5.1.9.6.9 1.1v14.4c0 .8-.7 1.3-1.4 1.1-3-.8-5-.3-7.7 1.5-.4.2-.8.2-1.2 0-2.7-1.8-4.7-2.3-7.7-1.5-.7.2-1.4-.3-1.4-1.1V4.9c0-.5.4-1 .9-1.1ZM4.5 5.8v12.2c2.3-.3 4.3.2 6.4 1.3V7.4c-2.3-1.5-4-1.9-6.4-1.6Zm8.6 1.6v11.9c2.1-1.1 4.1-1.6 6.4-1.3V5.8c-2.4-.3-4.1.1-6.4 1.6Z",
  };
  return (
    <svg
      className="soft-dock-icon"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor="#9274ef" />
          <stop offset=".55" stopColor="#7051cf" />
          <stop offset="1" stopColor="#5336ad" />
        </linearGradient>
      </defs>
      <path
        d={paths[kind]}
        fill={"url(#" + id + ")"}
        fillRule="evenodd"
        clipRule="evenodd"
      />
    </svg>
  );
}
