import { useAccount, useChainId, useConnect, useDisconnect } from "wagmi";
import { NavLink } from "react-router-dom";
import {
  BriefcaseBusiness,
  ExternalLink,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { GhostIcon } from "@/components/icons";
import { SEPOLIA_CHAIN_ID } from "@/constants";
import { formatAddress } from "@/lib/utils";

export function TopBar({ sidebarOpen, showSidebarControls = false, onToggleSidebar }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const isCorrectChain = chainId === SEPOLIA_CHAIN_ID;

  function handleConnect() {
    const connector = connectors.find((candidate) => candidate.id === "metaMask") || connectors[0];
    if (connector) connect({ connector });
  }

  return (
    <header className="app-topbar">
      <div className="topbar-inner">
        <div className="topbar-brand-row">
          {showSidebarControls && (
            <button
              type="button"
              onClick={onToggleSidebar}
              className="topbar-rail-toggle"
              title={sidebarOpen ? "Hide navigation rail" : "Show navigation rail"}
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeftOpen className="w-5 h-5" />}
            </button>
          )}

          <NavLink to="/" className="topbar-brand">
            <span className="topbar-brand-mark">
              <GhostIcon className="w-5 h-5" />
            </span>
            <span>fhex402</span>
          </NavLink>
        </div>

        <div className="topbar-actions">
          {isConnected && !isCorrectChain && (
            <div className="topbar-network-warning">
              <ShieldCheck className="w-4 h-4" />
              Wrong network
            </div>
          )}

          {isConnected ? (
            <>
              <a
                href={`https://sepolia.etherscan.io/address/${address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="topbar-icon-button"
                title="View on Etherscan"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button onClick={() => disconnect()} className="topbar-wallet-button">
                <WalletCards className="w-4 h-4" />
                {formatAddress(address)}
              </button>
            </>
          ) : (
            <button onClick={handleConnect} className="btn-primary topbar-connect">
              <BriefcaseBusiness className="w-4 h-4" />
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
