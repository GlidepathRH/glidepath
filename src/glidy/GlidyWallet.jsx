import React, { useState } from "react";
import { ConnectButton, getDefaultConfig, RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { defineChain } from "viem";
import { createConfig, http, injected, WagmiProvider } from "wagmi";
import { Wallet } from "lucide-react";

export const robinhoodChain = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Blockscout", url: "https://robinhoodchain.blockscout.com" } },
});

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim();
const walletConfig = {
  appName: "GLIDY",
  chains: [robinhoodChain],
  transports: { [robinhoodChain.id]: http("https://rpc.mainnet.chain.robinhood.com") },
  ssr: true,
};
export const wagmiConfig = projectId
  ? getDefaultConfig({ ...walletConfig, projectId })
  : createConfig({ ...walletConfig, connectors: [injected()] });

export function GlidyWalletProviders({ children }) {
  const [queryClient] = useState(() => new QueryClient());
  return <WagmiProvider config={wagmiConfig}><QueryClientProvider client={queryClient}><RainbowKitProvider modalSize="compact" theme={lightTheme({ accentColor: "#7051cf", accentColorForeground: "#ffffff", borderRadius: "medium", fontStack: "system", overlayBlur: "small" })}>{children}</RainbowKitProvider></QueryClientProvider></WagmiProvider>;
}

export function GlidyConnectButton({ className = "" }) {
  return <ConnectButton.Custom>{({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted }) => {
    const ready = mounted && authenticationStatus !== "loading";
    const connected = ready && Boolean(account) && (!authenticationStatus || authenticationStatus === "authenticated");
    const wrongChain = connected && chain?.id !== robinhoodChain.id;
    const label = !ready ? "Connect wallet" : wrongChain ? "Switch network" : connected ? account.displayName : "Connect wallet";
    const onClick = wrongChain ? openChainModal : connected ? openAccountModal : openConnectModal;
    return <button type="button" className={`glidy-wallet-button ${className}`} onClick={onClick} disabled={!ready} aria-label={wrongChain ? "Switch to Robinhood Chain" : connected ? `Wallet ${account.displayName}; open wallet menu` : "Connect wallet"}>
      <Wallet size={15} aria-hidden="true" /><span>{label}</span>
    </button>;
  }}</ConnectButton.Custom>;
}
