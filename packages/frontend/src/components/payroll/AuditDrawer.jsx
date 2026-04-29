import { useState } from "react";
import { useAccount } from "wagmi";
import { ShieldIcon, UnlockIcon, LockIcon, XIcon } from "@/components/icons";
import { useAgentVault } from "@/hooks/useAgentVault";
import { formatAddress } from "@/lib/utils";

export function AuditDrawer({ open, onClose, agentState }) {
  const { address } = useAccount();
  const {
    lastDecryptedBudget,
    lastDecryptedSpent,
    cycleCount,
    requestBudgetDecryption,
    txPending,
    refetchAll,
  } = useAgentVault();

  const [decrypting, setDecrypting] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const { complianceResults, disbursementResults, roster } = agentState;

  const budgetVal = lastDecryptedBudget ? Number(lastDecryptedBudget) / 1_000_000 : null;
  const spentVal = lastDecryptedSpent ? Number(lastDecryptedSpent) / 1_000_000 : null;

  async function handleDecrypt() {
    setDecrypting(true);
    try {
      await requestBudgetDecryption();
      await refetchAll();
      setDecrypting(false);
      setRevealed(true);
    } catch (e) {
      console.warn("[AuditDrawer] budget audit decrypt failed:", e);
      setDecrypting(false);
    }
  }

  if (!open) return null;

  const totalServices = 0.10 + 0.25 + 0.50;
  const employeeCount = roster?.roster?.length ?? 0;
  const dispatchedCount = disbursementResults?.summary?.totalDispatched ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-lg rounded-lg animate-slide-up overflow-hidden"
        style={{ background: "var(--bg-card)", border: "1px solid var(--border-bright)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Private Audit - Cycle Breakdown
            </span>
          </div>
          <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Privacy note */}
          <div
            className="flex items-start gap-2 rounded-md p-3 text-xs"
            style={{
              background: "var(--accent-glow)",
              border: "1px solid var(--border)",
              color: "var(--text-secondary)",
            }}
          >
            <LockIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: "var(--accent)" }} />
            <span>
              Only you (
              <span className="font-mono" style={{ color: "var(--accent)" }}>
                {formatAddress(address)}
              </span>
              ) can decrypt this breakdown. Your FHE access key is required.
              Employee salaries remain private. Only totals are revealed here.
            </span>
          </div>

          {/* Decrypt CTA */}
          {!revealed && (
            <button
              onClick={handleDecrypt}
              disabled={decrypting || txPending}
              className="w-full py-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2"
              style={{
                background: decrypting ? "var(--bg-elevated)" : "var(--accent)",
                color: decrypting ? "var(--text-muted)" : "#fff",
                cursor: decrypting ? "not-allowed" : "pointer",
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
              ) : (
                <>
                  <UnlockIcon className="w-4 h-4" />
                  Decrypt My Spend Breakdown
                </>
              )}
            </button>
          )}

          {/* Decrypted breakdown */}
          {(revealed || (budgetVal && budgetVal > 0)) && (
            <div className="space-y-3 animate-fade-in">
              <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
                Decrypted Budget State
              </div>

              <div className="space-y-2">
                {[
                  { label: "Total Budget", value: budgetVal ? `$${budgetVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC` : "-", color: "var(--text-primary)" },
                  { label: "Total Spent", value: spentVal ? `$${spentVal.toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC` : "-", color: "var(--red)" },
                  { label: "Remaining", value: budgetVal && spentVal ? `$${(budgetVal - spentVal).toLocaleString("en-US", { minimumFractionDigits: 2 })} USDC` : "-", color: "var(--green)" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between px-3 py-2.5 rounded-md"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  >
                    <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                    <span className="text-sm font-semibold font-mono decrypt-reveal" style={{ color }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Service spend breakdown */}
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Service Costs (This Cycle)
            </div>
            {[
              { label: "RosterAPI", cost: "$0.10 USDC", service: "x402 payment" },
              { label: "ComplianceAPI", cost: "$0.25 USDC", service: "x402 payment" },
              { label: "DisbursAPI", cost: "$0.50 USDC", service: "x402 payment" },
            ].map(({ label, cost, service }) => (
              <div
                key={label}
                className="flex items-center justify-between px-3 py-2"
                style={{
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <div>
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
                  <span className="text-[10px] font-mono ml-2" style={{ color: "var(--text-muted)" }}>{service}</span>
                </div>
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{cost}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2">
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                Total Service Cost
              </span>
              <span className="text-sm font-semibold font-mono" style={{ color: "var(--accent)" }}>
                $0.85 USDC
              </span>
            </div>
          </div>

          {/* Cycle stats */}
          {employeeCount > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: cycleCount?.toString() ?? "-", label: "Cycle #" },
                { value: String(employeeCount), label: "Employees" },
                { value: String(dispatchedCount), label: "Paid" },
              ].map(({ value, label }) => (
                <div
                  key={label}
                  className="text-center rounded-md py-2.5"
                  style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                >
                  <div className="text-lg font-semibold font-mono" style={{ color: "var(--text-primary)" }}>
                    {value}
                  </div>
                  <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
