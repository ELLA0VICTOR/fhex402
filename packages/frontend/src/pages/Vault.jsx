import { useState } from "react";
import { useAccount } from "wagmi";
import { VaultIcon, LockIcon, UnlockIcon, ShieldIcon, ExternalLinkIcon } from "@/components/icons";
import { useAgentVault } from "@/hooks/useAgentVault";
import { formatCiphertext } from "@/lib/fhevm";
import { formatAddress } from "@/lib/utils";
import { DepositModal } from "@/components/vault/DepositModal";
import { CONTRACTS } from "@/lib/contracts";

export function Vault() {
  const { address } = useAccount();
  const [depositOpen, setDepositOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const {
    cycleCount,
    agentActive,
    lastDecryptedBudget,
    lastDecryptedSpent,
    utilizationPct,
    ownerAddress,
    agentAddress,
    hasContract,
    requestBudgetDecryption,
    refetchAll,
    txPending,
  } = useAgentVault();

  const hasDecrypted = lastDecryptedBudget !== undefined && lastDecryptedBudget > 0n;

  async function handleDecrypt() {
    setRequesting(true);
    try {
      await requestBudgetDecryption();
      await refetchAll();
      setRequesting(false);
    } catch (e) {
      console.warn("[Vault] budget audit decrypt failed:", e);
      setRequesting(false);
    }
  }

  const budgetDisplay = hasDecrypted
    ? `${(Number(lastDecryptedBudget) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`
    : null;
  const spentDisplay = hasDecrypted && lastDecryptedSpent > 0n
    ? `${(Number(lastDecryptedSpent) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`
    : null;
  const remainingDisplay = hasDecrypted
    ? `${((Number(lastDecryptedBudget) - Number(lastDecryptedSpent)) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`
    : null;

  return (
    <div className="page-workspace animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Private treasury</div>
          <h1 className="page-title">
            Agent Vault
          </h1>
          <p className="page-subtitle">
            FHE-encrypted payroll budget on Sepolia Testnet.
          </p>
        </div>
        <button
          onClick={() => setDepositOpen(true)}
          className="btn-primary page-action-button"
        >
          <LockIcon className="w-3.5 h-3.5" />
          Deposit Budget
        </button>
      </div>

      <div className="vault-layout">
        {/* Left: vault state */}
        <div className="vault-main">
          {/* Budget card */}
          <div className="card vault-budget-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <VaultIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                  Encrypted Budget
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="status-dot" style={{ background: agentActive ? "var(--green)" : "var(--text-muted)" }} />
                <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                  {agentActive ? "AGENT ACTIVE" : "INACTIVE"}
                </span>
              </div>
            </div>

            {/* Budget rows */}
            <div className="space-y-3">
              {[
                { label: "Budget", encrypted: "0x1a4f8b2c...", decrypted: budgetDisplay, accent: false },
                { label: "Spent",  encrypted: "0x3c6b0d4e...", decrypted: spentDisplay,  accent: false },
                { label: "Remaining", encrypted: "0x5e8d2f6a...", decrypted: remainingDisplay, accent: true },
              ].map(({ label, encrypted, decrypted, accent }) => (
                <div key={label} className="vault-data-row">
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <div className="flex items-center gap-2">
                    {decrypted ? (
                      <>
                        <UnlockIcon className="w-3 h-3" style={{ color: "var(--green)" }} />
                        <span
                          className="text-sm font-semibold font-mono decrypt-reveal"
                          style={{ color: accent ? "var(--green)" : "var(--text-primary)" }}
                        >
                          {decrypted}
                        </span>
                      </>
                    ) : (
                      <>
                        <LockIcon className="w-3 h-3" style={{ color: "var(--accent)" }} />
                        <span className="encrypted-value">{encrypted}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Utilization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                <span>Budget utilization</span>
                <span>{hasDecrypted ? `${utilizationPct}%` : "encrypted"}</span>
              </div>
              <div className="vault-progress-track">
                <div
                  className="vault-progress-fill"
                  style={{
                    width: `${utilizationPct}%`,
                    background: utilizationPct > 80 ? "var(--red)" : utilizationPct > 50 ? "#F59E0B" : "var(--accent)",
                  }}
                />
              </div>
            </div>

            {/* Decrypt action */}
            <button
              onClick={handleDecrypt}
              disabled={requesting || txPending}
              className="btn-secondary vault-action-button"
              style={{
                cursor: requesting ? "not-allowed" : "pointer",
              }}
            >
              {requesting ? (
                <>
                  <span className="w-3.5 h-3.5 rounded-full border-2 spinner"
                    style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }} />
                  Decrypting with Zama Relayer...
                </>
              ) : (
                <>
                  <UnlockIcon className="w-3.5 h-3.5" />
                  Decrypt Budget (Private Audit)
                </>
              )}
            </button>
          </div>

          {/* FHE explanation card */}
          <div className="card vault-explain-card">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                How FHE Budget Enforcement Works
              </span>
            </div>
            <div className="space-y-2 text-[11px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
              <p>
                When the agent authorizes a service payment, the AgentVault contract computes
                <span className="font-mono" style={{ color: "var(--accent)" }}> encryptedSpent + paymentAmount &lt;= encryptedBudget </span>
                entirely in encrypted space using{" "}
                <span style={{ color: "var(--text-secondary)" }}>TFHE.le()</span>.
              </p>
              <p>
                The result is an encrypted boolean (<span className="font-mono" style={{ color: "var(--accent)" }}>ebool</span>).
                If true, the new total is stored via{" "}
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>TFHE.select()</span>.
                No plaintext value ever touches the chain.
              </p>
              <p>
                The audit flow publishes public handles, asks the Zama Relayer SDK
                for a public decryption proof, then verifies that proof on-chain.
              </p>
            </div>
          </div>
        </div>

        {/* Right: contract info */}
        <div className="vault-aside">
          <div className="card vault-info-card">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              Contract Info
            </span>

            {[
              { label: "AgentVault", address: CONTRACTS.AgentVault.address },
              { label: "Owner", address: ownerAddress },
              { label: "Agent", address: agentAddress },
            ].map(({ label, address: addr }) => (
              <div key={label}>
                <div className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
                  {label}
                </div>
                {addr ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono" style={{ color: "var(--text-secondary)" }}>
                      {formatAddress(addr, 10)}
                    </span>
                    <a
                      href={`https://sepolia.etherscan.io/address/${addr}`}
                      target="_blank" rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </a>
                  </div>
                ) : (
                  <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>-</span>
                )}
              </div>
            ))}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: "12px" }}>
              <div className="text-[10px] uppercase tracking-widest mb-2" style={{ color: "var(--text-muted)" }}>
                On-chain Stats
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: cycleCount?.toString() ?? "0", label: "Cycles" },
                  { value: agentActive ? "Active" : "Inactive", label: "Status" },
                ].map(({ value, label }) => (
                  <div key={label} className="vault-stat-card">
                    <div className="text-base font-semibold font-mono" style={{ color: "var(--text-primary)" }}>{value}</div>
                    <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* FHEVM network info */}
          <div className="card vault-info-card">
            <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
              FHEVM Network
            </span>
            {[
              { label: "Network", value: "Sepolia Testnet" },
              { label: "Chain ID", value: "11155111" },
              { label: "FHEVM", value: "Zama FHEVM v0.11" },
              { label: "Relayer", value: "relayer.testnet.zama.cloud" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between text-xs">
                <span style={{ color: "var(--text-muted)" }}>{label}</span>
                <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
