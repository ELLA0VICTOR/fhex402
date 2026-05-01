import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { ExternalLinkIcon, LockIcon, PayrollIcon, RosterIcon, ShieldIcon } from "@/components/icons";
import { RosterTable } from "@/components/payroll/RosterTable";
import { useAgentVault } from "@/hooks/useAgentVault";
import { usePayrollAgent } from "@/hooks/usePayrollAgent";
import { apiFetch } from "@/lib/api";
import { CONTRACTS } from "@/lib/contracts";
import { formatCiphertext } from "@/lib/fhevm";
import { formatAddress } from "@/lib/utils";

export function Payroll() {
  const { isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { cycleCount } = useAgentVault();
  const { agentState, runPayrollCycle } = usePayrollAgent();
  const [activeFilter, setActiveFilter] = useState("all");
  const [summary, setSummary] = useState(null);
  const [roster, setRoster] = useState([]);
  const [complianceResults, setComplianceResults] = useState([]);
  const [disbursementResults, setDisbursementResults] = useState([]);
  const [loadError, setLoadError] = useState(null);
  const [rosterInput, setRosterInput] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [treasuryFundUSDC, setTreasuryFundUSDC] = useState("");
  const [setupState, setSetupState] = useState({ loading: false, message: "", error: "" });
  const [settlementReceipts, setSettlementReceipts] = useState([]);
  const [historyError, setHistoryError] = useState(null);

  async function refreshPayrollState() {
    try {
      setLoadError(null);
      const [summaryResponse, agentResponse] = await Promise.all([
        apiFetch("/api/roster/summary"),
        apiFetch("/api/agent/status"),
      ]);

      const summaryData = await summaryResponse.json().catch(() => null);
      const agentData = await agentResponse.json().catch(() => null);

      if (summaryResponse.ok && summaryData?.ok !== false) {
        setSummary(summaryData.summary || null);
      }

      if (agentResponse.ok && agentData?.ok !== false) {
        const state = agentData.state || {};
        setRoster(state.roster?.roster || []);
        setComplianceResults(state.complianceResults?.results || []);
        setDisbursementResults(state.disbursementResults?.disbursements || []);
      }
    } catch (err) {
      setLoadError(err.message);
    }
  }

  useEffect(() => {
    refreshPayrollState();
  }, []);

  useEffect(() => {
    if (agentState.roster?.roster) setRoster(agentState.roster.roster);
    if (agentState.complianceResults?.results) setComplianceResults(agentState.complianceResults.results);
    if (agentState.disbursementResults?.disbursements) setDisbursementResults(agentState.disbursementResults.disbursements);
  }, [agentState]);

  useEffect(() => {
    loadSettlementReceipts();
  }, [publicClient, agentState.disbursementResults]);

  const departments = useMemo(() => ["all", ...new Set(roster.map((employee) => employee.department))], [roster]);
  const filtered = activeFilter === "all" ? roster : roster.filter((employee) => employee.department === activeFilter);

  function loadSampleRoster() {
    setRosterInput(JSON.stringify({
      employees: [
        {
          id: "emp-001",
          name: "Maya Chen",
          wallet: "0xREPLACE_WITH_EMPLOYEE_WALLET_1",
          salaryUSDC: "1200.00",
          department: "Engineering",
          jurisdiction: "US",
          employedSince: "2023-09-12",
        },
        {
          id: "emp-002",
          name: "Daniel Okafor",
          wallet: "0xREPLACE_WITH_EMPLOYEE_WALLET_2",
          salaryUSDC: "950.00",
          department: "Operations",
          jurisdiction: "NG",
          employedSince: "2022-04-18",
        },
        {
          id: "emp-003",
          name: "Amara Singh",
          wallet: "0xREPLACE_WITH_EMPLOYEE_WALLET_3",
          salaryUSDC: "1500.00",
          department: "Finance",
          jurisdiction: "SG",
          employedSince: "2021-11-03",
        },
      ],
    }, null, 2));
  }

  function parseCsv(text) {
    const rows = text.trim().split(/\r?\n/).filter(Boolean);
    if (rows.length < 2) throw new Error("CSV needs a header and at least one employee row");
    const headers = rows[0].split(",").map((item) => item.trim());
    const employees = rows.slice(1).map((row) => {
      const values = row.split(",").map((item) => item.trim());
      return headers.reduce((acc, header, index) => {
        acc[header] = values[index] || "";
        return acc;
      }, {});
    });
    return { employees };
  }

  function parseRosterInput(text) {
    const trimmed = text.trim();
    if (!trimmed) throw new Error("Paste or upload a roster first");
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed);
    }
    return parseCsv(trimmed);
  }

  async function handleRosterFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setRosterInput(await file.text());
  }

  async function prepareRoster() {
    setSetupState({ loading: true, message: "Encrypting roster and registering employees...", error: "" });

    try {
      const payload = parseRosterInput(rosterInput);
      if (treasuryFundUSDC) payload.treasuryFundUSDC = treasuryFundUSDC;

      const response = await apiFetch("/api/agent/prepare-roster", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || response.statusText);
      }

      setSetupState({
        loading: false,
        message: `Encrypted ${data.employeeCount} employees and funded confidential payroll treasury.`,
        error: "",
      });
      await refreshPayrollState();
    } catch (err) {
      setSetupState({ loading: false, message: "", error: err.message });
    }
  }

  async function loadSettlementReceipts() {
    if (!publicClient || !CONTRACTS.GhostPayrollToken.address) return;

    try {
      setHistoryError(null);
      const count = await publicClient.readContract({
        address: CONTRACTS.GhostPayrollToken.address,
        abi: CONTRACTS.GhostPayrollToken.abi,
        functionName: "receiptCount",
      });
      const latest = Number(count || 0n);

      if (latest === 0) {
        setSettlementReceipts([]);
        return;
      }

      const ids = [];
      for (let id = latest; id >= 1 && ids.length < 10; id--) ids.push(id);

      const receipts = await Promise.all(ids.map(async (id) => {
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

      setSettlementReceipts(receipts);
    } catch (err) {
      setHistoryError(err.message);
    }
  }

  return (
    <div className="page-workspace animate-fade-in">
      <div className="page-header">
        <div>
          <div className="page-kicker">Encrypted roster</div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">
            Live encrypted employee records served by RosterAPI for the next payroll cycle.
          </p>
        </div>
        <div className="page-actions">
          <div className="pill">
            <RosterIcon className="w-3.5 h-3.5" />
            Cycle #{cycleCount?.toString() ?? "0"}
          </div>
          <button onClick={refreshPayrollState} className="btn-secondary h-12 px-5 text-sm font-bold gap-2">
            Refresh
          </button>
          {isConnected && (
            <button
              onClick={runPayrollCycle}
              disabled={agentState.running}
              className="btn-primary h-12 px-5 text-sm font-bold gap-2"
            >
              <PayrollIcon className="w-4 h-4" />
              {agentState.running ? "Running" : "Run cycle"}
            </button>
          )}
        </div>
      </div>

      <div className="stats-grid">
        {[
          { value: String(summary?.activeEmployees ?? roster.length), label: "Employees", sub: "active records" },
          { value: String(summary?.departments?.length ?? new Set(roster.map((e) => e.department)).size), label: "Teams", sub: "departments" },
          { value: String(summary?.jurisdictions?.length ?? new Set(roster.map((e) => e.jurisdiction)).size), label: "Regions", sub: "jurisdictions" },
          { value: "$0.003", label: "Cycle cost", sub: "x402 services" },
        ].map(({ value, label, sub }) => (
          <div key={label} className="metric-card">
            <div className="metric-card-value">{value}</div>
            <div className="metric-card-label">{label}</div>
            <div className="metric-card-sub">{sub}</div>
          </div>
        ))}
      </div>

      <section className="card p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Roster onboarding
            </div>
            <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
              Upload JSON or CSV. Salaries are encrypted before RosterAPI stores the payroll file.
            </div>
          </div>
          <button onClick={loadSampleRoster} className="btn-secondary h-10 px-4 text-sm font-bold">
            Load sample
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_220px_180px]">
          <input
            type="password"
            value={adminToken}
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="Roster admin token"
            className="input-clean"
          />
          <input
            type="text"
            value={treasuryFundUSDC}
            onChange={(event) => setTreasuryFundUSDC(event.target.value)}
            placeholder="Treasury gcUSDT optional"
            className="input-clean"
          />
          <label className="btn-secondary h-11 px-4 text-sm font-bold cursor-pointer inline-flex items-center justify-center">
            Upload file
            <input type="file" accept=".json,.csv,text/csv,application/json" onChange={handleRosterFile} className="hidden" />
          </label>
        </div>

        <textarea
          value={rosterInput}
          onChange={(event) => setRosterInput(event.target.value)}
          placeholder="Paste JSON or CSV roster here. CSV headers: id,name,wallet,salaryUSDC,department,jurisdiction,employedSince"
          className="input-clean min-h-[180px] font-mono text-xs"
        />

        <RosterSetupTimeline loading={setupState.loading} done={Boolean(setupState.message)} error={Boolean(setupState.error)} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={prepareRoster}
            disabled={setupState.loading}
            className="btn-primary h-11 px-5 text-sm font-bold"
          >
            {setupState.loading ? "Preparing roster" : "Prepare encrypted roster"}
          </button>
          {setupState.message && (
            <span className="text-sm" style={{ color: "var(--green)" }}>{setupState.message}</span>
          )}
          {setupState.error && (
            <span className="text-sm" style={{ color: "var(--red)" }}>{setupState.error}</span>
          )}
        </div>
      </section>

      {departments.length > 1 && (
        <div className="filter-tabs">
          {departments.map((department) => {
            const active = activeFilter === department;
            return (
              <button
                key={department}
                onClick={() => setActiveFilter(department)}
                className={active ? "btn-primary px-4 h-10 text-sm capitalize font-bold" : "btn-secondary px-4 h-10 text-sm capitalize font-bold"}
              >
                {department === "all" ? `All (${roster.length})` : department}
              </button>
            );
          })}
        </div>
      )}

      {loadError && <div className="workbench-error">{loadError}</div>}

      {filtered.length > 0 ? (
        <RosterTable
          roster={filtered}
          complianceResults={complianceResults}
          disbursementResults={disbursementResults}
        />
      ) : (
        <div className="surface-row flex items-center gap-3 px-4 py-3 text-sm">
          <LockIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            No encrypted roster loaded yet. Upload a roster to RosterAPI, then run a payroll cycle.
          </span>
        </div>
      )}

      <SettlementHistory
        receipts={settlementReceipts}
        error={historyError}
        onRefresh={loadSettlementReceipts}
      />

      <div className="surface-row flex items-center gap-3 px-4 py-3 text-sm">
        <ShieldIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--green)" }} />
        <span style={{ color: "var(--text-secondary)" }}>
          Salary values are expected as encrypted ciphertext handles. The frontend does not ship sample employee records.
        </span>
      </div>
    </div>
  );
}

function SettlementHistory({ receipts, error, onRefresh }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div>
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            On-chain settlement history
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
            Confidential gcUSDT receipt records read from GhostPayrollToken.
          </div>
        </div>
        <button onClick={onRefresh} className="btn-secondary h-10 px-4 text-sm font-bold">
          Refresh
        </button>
      </div>

      {error && (
        <div className="px-4 py-3 text-sm" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}

      {receipts.length === 0 && !error ? (
        <div className="px-4 py-4 text-sm" style={{ color: "var(--text-muted)" }}>
          No confidential settlement receipts yet. Run a payroll cycle to create on-chain proof.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Receipt", "Employee", "Cycle", "Encrypted Amount", "Time", "Contract"].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-medium" style={{ color: "var(--text-muted)" }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {receipts.map((receipt) => (
                <tr key={receipt.id} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="px-4 py-3 mono" style={{ color: "var(--text-secondary)" }}>
                    #{receipt.id}
                  </td>
                  <td className="px-4 py-3 mono" style={{ color: "var(--text-secondary)" }}>
                    {formatAddress(receipt.to)}
                  </td>
                  <td className="px-4 py-3 mono" style={{ color: "var(--text-secondary)" }}>
                    {receipt.cycleId?.toString?.() || "-"}
                  </td>
                  <td className="px-4 py-3">
                    <span className="encrypted-value">{formatCiphertext(receipt.encryptedAmountHandle)}</span>
                  </td>
                  <td className="px-4 py-3 mono" style={{ color: "var(--text-muted)" }}>
                    {receipt.timestamp ? new Date(Number(receipt.timestamp) * 1000).toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={`https://sepolia.etherscan.io/address/${CONTRACTS.GhostPayrollToken.address}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mono text-xs"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      gcUSDT
                      <ExternalLinkIcon className="w-3 h-3" style={{ color: "var(--text-muted)" }} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function RosterSetupTimeline({ loading, done, error }) {
  const steps = [
    ["Encrypt salaries", "Zama Relayer SDK creates encrypted salary handles"],
    ["Register employees", "ConfidentialPayroll stores salary handles on Sepolia"],
    ["Fund treasury", "GhostPayrollToken receives encrypted gcUSDT treasury"],
    ["Store roster", "RosterAPI saves only encrypted salary references"],
  ];

  return (
    <div className="prepare-timeline">
      {steps.map(([title, text], index) => (
        <div key={title} className={done ? "complete" : loading ? "active" : error ? "error" : ""}>
          <span>{done ? "ok" : loading ? index + 1 : "-"}</span>
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
