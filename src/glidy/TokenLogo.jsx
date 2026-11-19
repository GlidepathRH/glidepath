import React, { useState } from "react";
// Demo identities are deliberately separate from real project metadata.
// Production logos must be resolved by chain + contract, never ticker alone.
export function TokenLogo({ market, className = "" }) {
  const [failed, setFailed] = useState(false);
  return (
    <span
      className={"token-avatar " + className}
      style={{ "--token": market.color }}
      title={market.name + " · illustrative launch identity"}
    >
      {failed ? (
        <span>{market.symbol.slice(0, 2)}</span>
      ) : (
        <img
          src={"/tokens/" + market.id + ".svg"}
          alt={market.name + " demo logo"}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}
