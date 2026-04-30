import { ExternalLinkIcon, LockIcon } from "@/components/icons";
import { formatCiphertext } from "@/lib/fhevm";
import { formatAddress } from "@/lib/utils";

export function RosterTable({ roster, complianceResults, disbursementResults }) {
  if (!roster || roster.length === 0) return null;

  function getCompliance(wallet) {
    return complianceResults?.find((r) => r.wallet?.toLowerCase() === wallet?.toLowerCase()) || null;
  }

  function getDisburse(employeeId) {
    return disbursementResults?.find((r) => r.employeeId === employeeId) || null;
  }

  return (
    <div className="card overflow-hidden roster-table-card">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Employee roster
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            {roster.length} encrypted salary records
          </div>
        </div>
        <LockIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm roster-table">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              {["Employee", "Wallet", "Department", "Region", "Salary", "Compliance", "Payment"].map((heading) => (
                <th key={heading} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roster.map((emp) => {
              const compliance = getCompliance(emp.wallet);
              const disburse = getDisburse(emp.id);
              const cleared = compliance?.status === "CLEARED";
              const sent = disburse?.status === "SENT";

              return (
                <tr key={emp.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3">
                    <div className="font-medium" style={{ color: "var(--text-primary)" }}>
                      {emp.name}
                    </div>
                    <div className="text-xs mono mt-1" style={{ color: "var(--text-muted)" }}>
                      {emp.id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://sepolia.etherscan.io/address/${emp.wallet}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mono text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {formatAddress(emp.wallet)}
                      <ExternalLinkIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </a>
                  </td>
                  <td className="px-4 py-3" style={{ color: "var(--text-secondary)" }}>
                    {emp.department}
                  </td>
                  <td className="px-4 py-3">
                    <div className="mono text-xs" style={{ color: "var(--text-secondary)" }}>
                      {emp.jurisdiction}
                    </div>
                    {emp.taxBand && (
                      <div className="text-xs mono mt-1" style={{ color: "var(--text-muted)" }}>
                        {emp.taxBand}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <LockIcon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
                      <span className="encrypted-value">{formatCiphertext(emp.encryptedSalary)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {compliance ? (
                      <span className="pill px-2 py-1 text-xs mono">
                        <span className="status-dot" style={{ background: cleared ? "var(--green)" : "var(--red)" }} />
                        {compliance.status}
                      </span>
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {disburse ? (
                      sent && disburse.txHash ? (
                        <div className="space-y-1">
                          <a
                            href={disburse.txUrl || `https://sepolia.etherscan.io/tx/${disburse.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 mono text-xs"
                            style={{ color: "var(--text-secondary)" }}
                          >
                            {disburse.txHash.slice(0, 8)}...
                            <ExternalLinkIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                          </a>
                          <div className="mono text-xs" style={{ color: "var(--text-muted)" }}>
                            {disburse.settlement === "confidential_token"
                              ? `${disburse.tokenSymbol || "gcUSDT"} encrypted`
                              : disburse.tokenSymbol || "USDC"}
                          </div>
                          {disburse.encryptedAmountRef && (
                            <div className="encrypted-value">
                              {formatCiphertext(disburse.encryptedAmountRef)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="mono text-xs" style={{ color: "var(--red)" }}>
                          FAILED
                        </span>
                      )
                    ) : (
                      <span style={{ color: "var(--text-muted)" }}>-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
