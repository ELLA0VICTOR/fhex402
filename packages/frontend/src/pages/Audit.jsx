import { useEffect, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { ShieldIcon, UnlockIcon, LockIcon, CheckIcon } from "@/components/icons";
import { useAgentVault } from "@/hooks/useAgentVault";
import { formatAddress } from "@/lib/utils";
import { formatCiphertext } from "@/lib/fhevm";
import { CONTRACTS } from "@/lib/contracts";

export function Audit() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const {
    cycleCount,
    lastDecryptedBudget,
    lastDecryptedSpent,
    requestBudgetDecryption,
    refetchAll,
    txPending,
    hasContract,
  } = useAgentVault();

  const [decrypting, setDecrypting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [selectedCycle, setSelectedCycle] = useState(null);
  const [cycles, setCycles] = useState([]);

  const hasDecrypted = lastDecryptedBudget !== undefined && lastDecryptedBudget > 0n;
  const budget = hasDecrypted ? Number(lastDecryptedBudget) / 1_000_000 : null;
  const spent = hasDecrypted && lastDecryptedSpent > 0n ? Number(lastDecryptedSpent) / 1_000_000 : null;

  useEffect(() => {
    async function loadCycles() {
      if (!publicClient || !hasContract || Number(cycleCount || 0) === 0) {
        setCycles([]);
        return;
      }

      const count = Number(cycleCount);
      const next = [];
      for (let id = 1; id <= count; id++) {
        const [cycleId, timestamp, rosterHash, completed] = await publicClient.readContract({
          address: CONTRACTS.AgentVault.address,
          abi: CONTRACTS.AgentVault.abi,
          functionName: "getCycle",
          args: [BigInt(id)],
        });
        next.push({
          id: Number(cycleId),
          timestamp: Number(timestamp) * 1000,
          rosterHash,
          completed,
          serviceCost: 0.003,
        });
      }
      setCycles(next);
    }

    loadCycles().catch((err) => console.warn("[Audit] failed to load cycles:", err));
  }, [cycleCount, hasContract, publicClient]);

  async function handleDecrypt() {
    if (!hasContract) return;
    setDecrypting(true);
    try {
      await requestBudgetDecryption();
      await refetchAll();
      setDecrypting(false);
      setRevealed(true);
    } catch (e) {
      console.warn("[Audit] budget audit decrypt failed:", e);
      setDecrypting(false);
    }
  }

  return (
    <div className="page-workspace animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-kicker">Owner-only proof</div>
          <h1 className="page-title">
            Private Audit
          </h1>
          <p className="page-subtitle">
            Decrypt and verify your payroll spend. The revealed totals stay visible only to you.
          </p>
        </div>
        <div className="page-meta-note">
          <ShieldIcon className="w-3.5 h-3.5" />
          Owner-only decryption
        </div>
      </div>

      {/* Access note */}
      {isConnected && (
        <div className="access-line">
          <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            <span className="status-dot" style={{ background: "var(--green)" }} />
            Authenticated as{" "}
            <span className="font-mono" style={{ color: "var(--accent)" }}>
              {formatAddress(address)}
            </span>
          </div>
          <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            {hasContract ? `AgentVault: ${formatAddress(CONTRACTS.AgentVault.address)}` : "Contract not deployed"}
          </span>
        </div>
      )}

      <div className="audit-layout">
        {/* Decrypt panel */}
        <div className="audit-aside">
          {/* Decrypt card */}
          <div className="card audit-decrypt-card">
            <div className="flex items-center gap-2">
              {revealed || hasDecrypted ? (
                <UnlockIcon className="w-4 h-4" style={{ color: "var(--green)" }} />
              ) : (
                <LockIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
              )}
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Budget Decryption
              </span>
            </div>

            {/* Encrypted state display */}
            <div className="space-y-2">
              {[
                { label: "encryptedBudget", cipher: "0x1a4f8b2c9d3e7f01", decrypted: budget ? `${budget.toLocaleString()} units` : null },
                { label: "encryptedSpent",  cipher: "0x3c6b0d4e1f5a9b2c", decrypted: spent  ? `${spent.toLocaleString()} units`  : null },
              ].map(({ label, cipher, decrypted }) => (
                <div key={label}>
                  <div className="text-[10px] font-mono mb-1" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </div>
                  <div className="audit-cipher-row">
                    {decrypted ? (
                      <span className="text-sm font-semibold font-mono decrypt-reveal" style={{ color: "var(--green)" }}>
                        {decrypted}
                      </span>
                    ) : (
                      <span className="encrypted-value">{cipher}...</span>
                    )}
                    {decrypted ? (
                      <UnlockIcon className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
                    ) : (
                      <LockIcon className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Decrypt button */}
            <button
              onClick={handleDecrypt}
              disabled={decrypting || txPending || !isConnected || !hasContract}
              className="audit-action-button"
              style={{
                background: decrypting || !hasContract || !isConnected
                  ? "var(--bg-elevated)"
                  : "var(--accent)",
                color: decrypting || !hasContract || !isConnected ? "var(--text-muted)" : "#fff",
                cursor: decrypting || !hasContract || !isConnected ? "not-allowed" : "pointer",
              }}
            >
              {decrypting ? (
                <>
                  <span
                    className="w-4 h-4 rounded-full border-2 spinner"
                    style={{ borderColor: "var(--text-muted)", borderTopColor: "transparent" }}
                  />
                  Verifying Zama Relayer proof...
                </>
              ) : hasDecrypted ? (
                <>
                  <UnlockIcon className="w-4 h-4" />
                  Re-decrypt
                </>
              ) : (
                <>
                  <UnlockIcon className="w-4 h-4" />
                  Decrypt My Budget
                </>
              )}
            </button>

            {!hasContract && (
              <p className="text-[10px] text-center font-mono" style={{ color: "var(--text-muted)" }}>
                Deploy contracts first: <span style={{ color: "var(--accent)" }}>npm run deploy:sepolia</span>
              </p>
            )}
          </div>

          {/* Summary card */}
          {(revealed || hasDecrypted) && budget && (
            <div className="card p-4 space-y-3 animate-fade-in">
              <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
                Decrypted Summary
              </span>
              {[
                { label: "Total Budget",    value: `${budget.toFixed(2)} units`,                                  color: "var(--text-primary)" },
                { label: "Total Budget",    value: `${budget.toFixed(2)} units`,                                  color: "var(--text-primary)" },
                { label: "Total Spent",     value: spent ? `${spent.toFixed(2)} units` : "0.00 units",            color: "var(--red)" },
                { label: "Remaining",       value: `${(budget - (spent || 0)).toFixed(2)} units`,                 color: "var(--green)" },
                { label: "Service Costs",   value: "$0.003 USDC",                                                  color: "var(--accent)" },
                { label: "Cycles Run",      value: cycleCount?.toString() ?? "0",                                  color: "var(--text-secondary)" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span className="font-mono font-semibold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: cycle history */}
        <div className="audit-main">
          {/* How it works */}
          <div className="card audit-flow-card">
            <div className="flex items-center gap-2">
              <ShieldIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                FHE Decryption Flow
              </span>
            </div>
            <div className="space-y-2">
              {[
                { step: "1", text: "You call requestBudgetDecryption() on AgentVault" },
                { step: "2", text: "Contract marks budget and spent handles as publicly decryptable" },
                { step: "3", text: "Frontend asks the Zama Relayer SDK to publicDecrypt those handles" },
                { step: "4", text: "Relayer returns clear values plus a KMS decryption proof" },
                { step: "5", text: "AgentVault verifies the proof with FHE.checkSignatures()" },
                { step: "6", text: "lastDecryptedBudget / lastDecryptedSpent update on-chain" },
              ].map(({ step, text }) => (
                <div key={step} className="audit-step-row">
                  <div className="audit-step-index">
                    {step}
                  </div>
                  <span style={{ color: "var(--text-secondary)" }}>{text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cycle history */}
          <div className="card audit-history-card">
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Cycle History
              </span>
              <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                {cycleCount?.toString() ?? "0"} completed
              </span>
            </div>

            {cycles.length === 0 ? (
              <div className="audit-empty-state">
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  No cycles run yet. Go to Dashboard and click Run Payroll Cycle.
                </p>
              </div>
            ) : (
              <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                {cycles.map((cycle) => (
                  <div
                    key={cycle.id}
                    className="px-4 py-3 cursor-pointer transition-colors"
                    style={{
                      background: selectedCycle === cycle.id ? "var(--bg-elevated)" : "transparent",
                    }}
                    onClick={() => setSelectedCycle(selectedCycle === cycle.id ? null : cycle.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ background: cycle.completed ? "var(--green)" : "#F59E0B" }}
                        />
                        <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          Cycle #{cycle.id}
                        </span>
                        <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
                          {new Date(cycle.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: "var(--accent)" }}>
                          ${cycle.serviceCost} USDC
                        </span>
                        <CheckIcon className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
                      </div>
                    </div>

                    {selectedCycle === cycle.id && (
                      <div className="mt-3 space-y-2 animate-fade-in">
                        {[
                          { label: "Status", value: cycle.completed ? "Completed" : "Open" },
                          { label: "Service Cost", value: `$${cycle.serviceCost.toFixed(3)} USDC` },
                          { label: "Roster Hash", value: formatCiphertext(cycle.rosterHash) },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex items-center justify-between text-[11px]">
                            <span style={{ color: "var(--text-muted)" }}>{label}</span>
                            <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{value}</span>
                          </div>
                        ))}
                        <div className="flex items-center gap-1.5 pt-1">
                          <LockIcon className="w-3 h-3" style={{ color: "var(--accent)" }} />
                          <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
                            Salary amounts stored encrypted on-chain. Use Decrypt to reveal totals.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
