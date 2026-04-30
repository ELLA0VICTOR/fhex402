import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useAccount, usePublicClient, useSignTypedData } from "wagmi";
import { ExternalLinkIcon, LockIcon, ShieldIcon, UnlockIcon } from "@/components/icons";
import { CONTRACTS } from "@/lib/contracts";
import {
  createUserDecryptRequest,
  formatCiphertext,
  getUserClearValue,
  userDecryptHandles,
} from "@/lib/fhevm";
import { formatAddress } from "@/lib/utils";

function formatGcUsdt(value) {
  const raw = typeof value === "bigint" ? value : BigInt(value || 0);
  const formatted = formatUnits(raw, 6);
  const [whole, decimals = ""] = formatted.split(".");
  const trimmedDecimals = decimals.replace(/0+$/, "").slice(0, 6);
  return `${Number(whole).toLocaleString()}${trimmedDecimals ? `.${trimmedDecimals}` : ""}`;
}

function sameAddress(a, b) {
  return String(a || "").toLowerCase() === String(b || "").toLowerCase();
}

export function Employee() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { signTypedDataAsync } = useSignTypedData();
  const [encryptedBalance, setEncryptedBalance] = useState(null);
  const [clearBalance, setClearBalance] = useState(null);
  const [isEmployee, setIsEmployee] = useState(false);
  const [lastPaidCycle, setLastPaidCycle] = useState(null);
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState("");

  const canRead = Boolean(isConnected && publicClient && CONTRACTS.GhostPayrollToken.address);
  const receiptTotal = receipts.length;
  const latestReceipt = receipts[0];
  const hasRevealed = clearBalance !== null;

  const statusCopy = useMemo(() => {
    if (!isConnected) return "Connect an employee wallet";
    if (decrypting) return "Waiting for private decrypt";
    if (hasRevealed) return "Balance revealed locally";
    if (encryptedBalance) return "Encrypted balance ready";
    return "No balance loaded";
  }, [decrypting, encryptedBalance, hasRevealed, isConnected]);

  async function loadEmployeeState() {
    if (!canRead || !address) return;

    setLoading(true);
    setError("");
    setClearBalance(null);

    try {
      const [balanceHandle, active, paidCycle, receiptCount] = await Promise.all([
        publicClient.readContract({
          address: CONTRACTS.GhostPayrollToken.address,
          abi: CONTRACTS.GhostPayrollToken.abi,
          functionName: "getEncryptedBalance",
          args: [address],
        }),
        publicClient.readContract({
          address: CONTRACTS.ConfidentialPayroll.address,
          abi: CONTRACTS.ConfidentialPayroll.abi,
          functionName: "isActive",
          args: [address],
        }).catch(() => false),
        publicClient.readContract({
          address: CONTRACTS.ConfidentialPayroll.address,
          abi: CONTRACTS.ConfidentialPayroll.abi,
          functionName: "getLastPaidCycle",
          args: [address],
        }).catch(() => 0n),
        publicClient.readContract({
          address: CONTRACTS.GhostPayrollToken.address,
          abi: CONTRACTS.GhostPayrollToken.abi,
          functionName: "receiptCount",
        }).catch(() => 0n),
      ]);

      setEncryptedBalance(balanceHandle);
      setIsEmployee(Boolean(active));
      setLastPaidCycle(paidCycle);

      const latest = Number(receiptCount || 0n);
      const ids = [];
      for (let id = latest; id >= 1 && ids.length < 30; id--) ids.push(id);

      const allReceipts = await Promise.all(ids.map(async (id) => {
        const receipt = await publicClient.readContract({
          address: CONTRACTS.GhostPayrollToken.address,
          abi: CONTRACTS.GhostPayrollToken.abi,
          functionName: "getReceipt",
          args: [BigInt(id)],
        });
        const values = Array.isArray(receipt)
          ? receipt
          : [receipt.from, receipt.to, receipt.cycleId, receipt.timestamp, receipt.encryptedAmountHandle, receipt.operator];

        return {
          id,
          from: values[0],
          to: values[1],
          cycleId: values[2],
          timestamp: values[3],
          encryptedAmountHandle: values[4],
          operator: values[5],
        };
      }));

      setReceipts(allReceipts.filter((receipt) => sameAddress(receipt.to, address)));
    } catch (err) {
      setError(err.message || "Failed to load encrypted employee balance");
    } finally {
      setLoading(false);
    }
  }

  async function decryptBalance() {
    if (!encryptedBalance || !address) return;

    setDecrypting(true);
    setError("");

    try {
      const contractAddress = CONTRACTS.GhostPayrollToken.address;
      const request = await createUserDecryptRequest([contractAddress]);
      const signature = await signTypedDataAsync({
        domain: request.eip712.domain,
        types: {
          UserDecryptRequestVerification: request.eip712.types.UserDecryptRequestVerification,
        },
        primaryType: "UserDecryptRequestVerification",
        message: request.eip712.message,
      });
      const result = await userDecryptHandles({
        request,
        signature,
        userAddress: address,
        handleContractPairs: [
          {
            handle: encryptedBalance,
            contractAddress,
          },
        ],
      });

      setClearBalance(getUserClearValue(result, encryptedBalance));
    } catch (err) {
      setError(err.message || "Private balance decrypt failed");
    } finally {
      setDecrypting(false);
    }
  }

  useEffect(() => {
    if (canRead) {
      loadEmployeeState();
    } else {
      setEncryptedBalance(null);
      setClearBalance(null);
      setReceipts([]);
      setIsEmployee(false);
      setLastPaidCycle(null);
    }
  }, [address, canRead]);

  return (
    <div className="page-workspace employee-workspace animate-fade-in">
      <div className="page-header">
        <div>
          <div className="page-kicker">Employee wallet</div>
          <h1 className="page-title">Private Balance</h1>
          <p className="page-subtitle">
            View confidential gcUSDT payroll receipts and reveal only the connected wallet balance.
          </p>
        </div>
        <div className="page-meta-note">
          <ShieldIcon className="w-3.5 h-3.5" />
          {statusCopy}
        </div>
      </div>

      <div className="employee-balance-layout">
        <section className="employee-balance-main">
          <div className="employee-balance-hero">
            <div>
              <div className="panel-kicker">gcUSDT balance</div>
              <div className="employee-balance-value">
                {hasRevealed ? `${formatGcUsdt(clearBalance)} gcUSDT` : "Encrypted"}
              </div>
              <div className="employee-balance-sub">
                {address ? formatAddress(address) : "No employee wallet connected"}
              </div>
            </div>
            {hasRevealed ? (
              <UnlockIcon className="employee-balance-lock" />
            ) : (
              <LockIcon className="employee-balance-lock" />
            )}
          </div>

          <div className="employee-data-lines">
            <DataLine label="Encrypted balance" value={encryptedBalance ? formatCiphertext(encryptedBalance) : "-"} mono />
            <DataLine label="Payroll status" value={isEmployee ? "Active employee" : "Not in current roster"} />
            <DataLine label="Last paid cycle" value={lastPaidCycle ? `#${lastPaidCycle.toString()}` : "-"} mono />
            <DataLine label="Private receipts" value={String(receiptTotal)} mono />
          </div>

          {error && <div className="workbench-error">{error}</div>}

          <div className="employee-actions">
            <button
              onClick={decryptBalance}
              disabled={!encryptedBalance || decrypting || !isConnected}
              className="btn-primary employee-primary-action"
            >
              {decrypting ? "Requesting wallet signature" : hasRevealed ? "Decrypt again" : "Decrypt my balance"}
            </button>
            <button onClick={loadEmployeeState} disabled={loading || !isConnected} className="btn-secondary employee-secondary-action">
              {loading ? "Refreshing" : "Refresh"}
            </button>
          </div>
        </section>

        <aside className="employee-balance-aside">
          <div className="side-panel-header">
            <div>
              <h3>Private Decryption</h3>
              <p>Wallet signature, Zama KMS, local reveal.</p>
            </div>
          </div>

          <div className="employee-step-list">
            {[
              ["1", "Read encrypted balance handle"],
              ["2", "Sign the decrypt request"],
              ["3", "Relayer checks wallet permission"],
              ["4", "Balance appears only in this session"],
            ].map(([step, label]) => (
              <div key={step} className="employee-step-row">
                <span>{step}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>

          <a
            href={`https://sepolia.etherscan.io/address/${CONTRACTS.GhostPayrollToken.address}`}
            target="_blank"
            rel="noopener noreferrer"
            className="employee-contract-link"
          >
            gcUSDT contract
            <ExternalLinkIcon className="w-4 h-4" />
          </a>
        </aside>
      </div>

      <section className="employee-receipts">
        <div className="panel-header-row">
          <div>
            <div className="panel-kicker">On-chain receipts</div>
            <h3>My confidential settlements</h3>
          </div>
          <span className="state-label">{receiptTotal} records</span>
        </div>

        {receipts.length === 0 ? (
          <div className="employee-empty-state">
            {isEmployee
              ? "No settlement receipts found for this wallet yet."
              : "Connect one of the employee wallets used in the roster."}
          </div>
        ) : (
          <div className="employee-receipt-list">
            {receipts.map((receipt) => (
              <div key={receipt.id} className="employee-receipt-row">
                <div>
                  <strong>Receipt #{receipt.id}</strong>
                  <span>Cycle #{receipt.cycleId?.toString?.() || "-"}</span>
                </div>
                <span className="encrypted-value">{formatCiphertext(receipt.encryptedAmountHandle)}</span>
                <time>{receipt.timestamp ? new Date(Number(receipt.timestamp) * 1000).toLocaleString() : "-"}</time>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function DataLine({ label, value, mono = false }) {
  return (
    <div className="employee-data-line">
      <span>{label}</span>
      <strong className={mono ? "mono" : ""}>{value}</strong>
    </div>
  );
}
