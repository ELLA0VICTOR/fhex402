import { useState } from "react";
import { LockIcon, RefreshIcon, UnlockIcon, VaultIcon } from "@/components/icons";
import { DepositModal } from "./DepositModal";
import { formatCiphertext } from "@/lib/fhevm";
import { useAgentVault } from "@/hooks/useAgentVault";

export function VaultCard() {
  const [depositOpen, setDepositOpen] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const {
    agentActive,
    cycleCount,
    hasContract,
    lastDecryptedBudget,
    lastDecryptedSpent,
    refetchAll,
    requestBudgetDecryption,
    utilizationPct,
  } = useAgentVault();

  const hasDecryptedData = lastDecryptedBudget !== undefined && lastDecryptedBudget > 0n;
  const budgetDisplay = hasDecryptedData
    ? `${(Number(lastDecryptedBudget) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`
    : null;
  const spentDisplay = hasDecryptedData && lastDecryptedSpent > 0n
    ? `${(Number(lastDecryptedSpent) / 1_000_000).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC`
    : null;

  async function handleRequestDecrypt() {
    setRequesting(true);
    try {
      await requestBudgetDecryption();
      await refetchAll();
    } catch (error) {
      console.error(error);
    } finally {
      setRequesting(false);
    }
  }

  return (
    <>
      <div className="card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "var(--bg-elevated)" }}>
              <VaultIcon className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
            </div>
            <div>
              <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Agent Vault
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Private budget enforcement
              </div>
            </div>
          </div>
          <button onClick={refetchAll} className="btn-secondary h-8 w-8 flex items-center justify-center" title="Refresh">
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {!hasContract ? (
          <div className="surface-row p-3 text-xs" style={{ color: "var(--text-muted)" }}>
            Contracts are not connected yet.
          </div>
        ) : (
          <>
            <div className="grid gap-2">
              <VaultRow
                label="Budget"
                value={budgetDisplay}
                fallback={formatCiphertext("0x1a4f8b2c9d3e7f01")}
              />
              <VaultRow
                label="Spent"
                value={spentDisplay}
                fallback={formatCiphertext("0x3c6b0d4e1f5a9b2c")}
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mono" style={{ color: "var(--text-muted)" }}>
                <span>Utilization</span>
                <span>{hasDecryptedData ? `${utilizationPct}%` : "encrypted"}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-700"
                  style={{
                    width: `${utilizationPct}%`,
                    background: utilizationPct > 80 ? "var(--red)" : utilizationPct > 50 ? "var(--yellow)" : "var(--green)",
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { value: cycleCount?.toString() ?? "0", label: "Cycles" },
                { value: "3", label: "Services" },
                { value: agentActive ? "Ready" : "Idle", label: "Agent" },
              ].map(({ value, label }) => (
                <div key={label} className="surface-row p-3">
                  <div className="text-lg font-semibold mono" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
                    {label}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => setDepositOpen(true)} className="btn-primary h-10 text-sm font-medium">
                Deposit
              </button>
              <button
                onClick={handleRequestDecrypt}
                disabled={requesting}
                className="btn-secondary h-10 text-sm font-medium"
              >
                {requesting ? "Decrypting" : "Audit"}
              </button>
            </div>
          </>
        )}
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </>
  );
}

function VaultRow({ label, value, fallback }) {
  return (
    <div className="surface-row flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm" style={{ color: "var(--text-muted)" }}>
        {label}
      </span>
      {value ? (
        <span className="flex items-center gap-2 text-sm mono decrypt-reveal" style={{ color: "var(--text-primary)" }}>
          <UnlockIcon className="w-3.5 h-3.5" style={{ color: "var(--green)" }} />
          {value}
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <LockIcon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
          <span className="encrypted-value">{fallback}</span>
        </span>
      )}
    </div>
  );
}
