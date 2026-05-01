import { useState } from "react";
import { useAccount } from "wagmi";
import { LockIcon, ShieldIcon, XIcon } from "@/components/icons";
import { CONTRACTS } from "@/lib/contracts";
import { encryptUint64 } from "@/lib/fhevm";
import { useAgentVault } from "@/hooks/useAgentVault";

const PRESETS = [1000, 5000, 10000, 50000];

export function DepositModal({ open, onClose }) {
  const { address } = useAccount();
  const { depositBudget, refetchAll, txPending } = useAgentVault();
  const [amount, setAmount] = useState("");
  const [encrypting, setEncrypting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  if (!open) return null;

  async function handleDeposit() {
    if (!amount || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
      setError("Enter a valid payroll budget amount");
      return;
    }

    setError(null);
    setEncrypting(true);

    try {
      const microUnits = Math.round(Number(amount) * 1_000_000);
      const vaultAddress = CONTRACTS.AgentVault.address;

      if (!vaultAddress) {
        throw new Error("AgentVault is not deployed. Set VITE_AGENT_VAULT_ADDRESS in .env");
      }

      const encrypted = await encryptUint64(microUnits, vaultAddress, address);
      setEncrypting(false);
      await depositBudget(encrypted.handles[0], encrypted.inputProof);
      setSuccess(true);
      setTimeout(async () => {
        await refetchAll();
        onClose();
        setSuccess(false);
        setAmount("");
      }, 1600);
    } catch (depositError) {
      setEncrypting(false);
      setError(depositError.message);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.62)", backdropFilter: "blur(8px)" }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="glass-card w-full max-w-md p-5 space-y-5 animate-slide-up">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "var(--text-primary)", color: "#111" }}>
              <LockIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                Deposit budget
              </div>
              <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                Encrypt a private payroll budget before it goes on-chain
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-secondary h-8 w-8 flex items-center justify-center">
            <XIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="surface-row flex items-start gap-3 p-3 text-sm">
          <ShieldIcon className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "var(--green)" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            This does not transfer faucet USDC or gcUSDT from your wallet. The contract stores only an encrypted budget limit.
          </span>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" style={{ color: "var(--text-secondary)" }}>
            Amount
          </label>
          <div className="surface-row flex items-center gap-2 px-3 py-3">
            <span className="mono text-sm" style={{ color: "var(--text-muted)" }}>$</span>
            <input
              type="number"
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                setError(null);
              }}
              placeholder="10000"
              className="flex-1 bg-transparent text-sm mono outline-none"
              style={{ color: "var(--text-primary)" }}
              min="0"
              step="100"
            />
            <span className="mono text-xs" style={{ color: "var(--text-muted)" }}>private units</span>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((preset) => {
              const active = amount === String(preset);
              return (
                <button
                  key={preset}
                  onClick={() => setAmount(String(preset))}
                  className={active ? "btn-primary h-8 text-xs mono" : "btn-secondary h-8 text-xs mono"}
                >
                  ${preset.toLocaleString()}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="surface-row p-3 text-xs mono" style={{ color: "var(--red)" }}>
            {error}
          </div>
        )}

        {success && (
          <div className="surface-row p-3 text-xs mono" style={{ color: "var(--green)" }}>
            Budget deposited and encrypted on-chain.
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button onClick={onClose} className="btn-secondary h-11 text-sm">
            Cancel
          </button>
          <button
            onClick={handleDeposit}
            disabled={encrypting || txPending || success || !amount}
            className="btn-primary h-11 text-sm font-semibold"
            style={{ opacity: encrypting || txPending || success || !amount ? 0.55 : 1 }}
          >
            {encrypting ? "Encrypting" : txPending ? "Confirming" : "Deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}
