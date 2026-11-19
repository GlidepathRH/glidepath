import React from "react";
function Glyph({ children, size = 22, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="launch-glyph"
      {...props}
    >
      {children}
    </svg>
  );
}
export const DiscoverGlyph = (props) => (
  <Glyph {...props}>
    <circle className="glyph-orbit" cx="12" cy="12" r="8.5" />
    <path d="m15.5 8.5-2 5-5 2 2-5Z" />
    <circle cx="12" cy="12" r=".8" fill="currentColor" stroke="none" />
  </Glyph>
);
export const TrendingGlyph = (props) => (
  <Glyph {...props}>
    <path d="M3 20h18" opacity=".4" />
    <path className="glyph-bar first" d="M5 17v-4" />
    <path className="glyph-bar second" d="M11 17V9" />
    <path className="glyph-bar third" d="M17 17V6" />
    <path className="glyph-arrow" d="m3 8 5-4 5 2 7-4m-4 0h4v4" />
  </Glyph>
);
export const SavedGlyph = (props) => (
  <Glyph {...props}>
    <path d="M6 4h12v17l-6-4-6 4Z" />
    <path className="glyph-arrow" d="m9 9 2 2 4-4" />
  </Glyph>
);
export const CreateGlyph = (props) => (
  <Glyph {...props}>
    <path d="m3 10 18-7-7 18-3-8Z" opacity=".65" />
    <path className="glyph-arrow" d="m11 13 6-6M3 17l-1 4 4-1" />
  </Glyph>
);
export const LabGlyph = (props) => (
  <Glyph {...props}>
    <path d="M3 4v16h18" opacity=".4" />
    <path className="glyph-stairs" d="M6 7h4v4h4v4h6" />
    <circle cx="6" cy="7" r="1.5" fill="currentColor" stroke="none" />
    <circle cx="20" cy="15" r="1.5" fill="currentColor" stroke="none" />
  </Glyph>
);
export const GuideGlyph = (props) => (
  <Glyph {...props}>
    <path d="M3 5c4-1 6 0 9 2 3-2 5-3 9-2v14c-4-1-6 0-9 2-3-2-5-3-9-2Z" />
    <path d="M12 7v14M6 9l3 1m6 0 3-1M6 13l3 1m6 0 3-1" opacity=".5" />
  </Glyph>
);
