import { useState } from "react";
import { useAccount } from "wagmi";
import { LockIcon, PayrollIcon, RosterIcon, ShieldIcon } from "@/components/icons";
import { useAgentVault } from "@/hooks/useAgentVault";
import { usePayrollAgent } from "@/hooks/usePayrollAgent";
import { formatCiphertext } from "@/lib/fhevm";
import { formatAddress } from "@/lib/utils";

const DEMO_EMPLOYEES = [
  { id: "emp-001", name: "Amara Okonkwo", wallet: "0x742d35Cc6634C0532925a3b8D4C9b1A5AE6D7890", department: "Engineering", jurisdiction: "NG", employedSince: "2022-03-15", level: "Senior", taxBand: "PITA", encryptedSalary: "0x1a4f8b2c9d3e7f01a5b6c2d8e9f0a1b2" },
  { id: "emp-002", name: "Kofi Mensah", wallet: "0x8Ba1f109551bD432803012645Ac136ddd64DBA72", department: "Product", jurisdiction: "GH", employedSince: "2021-11-02", level: "Principal", taxBand: "GH-TAX", encryptedSalary: "0x2b5a9c3d0e4f8a1b2c3d4e5f6a7b8c9d" },
  { id: "emp-003", name: "Fatima Al-Hassan", wallet: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", department: "Design", jurisdiction: "AE", employedSince: "2023-01-20", level: "Lead", taxBand: "TAX_EXEMPT", encryptedSalary: "0x3c6b0d4e1f5a9b2c3d4e5f6a7b8c9d0e" },
  { id: "emp-004", name: "Marcus Veltri", wallet: "0x4dBa88e9dc5D4ee56f4aBdC6cF2e0CA1d8bE3F2", department: "Operations", jurisdiction: "US", employedSince: "2022-07-08", level: "Manager", taxBand: "W-2", encryptedSalary: "0x4d7c1e5f2a6b0c3d4e5f6a7b8c9d0e1f" },
  { id: "emp-005", name: "Yuki Tanaka", wallet: "0x5eCb99f0EA1e7dF65bcCd8E3Abc2F0d9C7aE4B1", department: "Engineering", jurisdiction: "JP", employedSince: "2023-04-12", level: "Mid", taxBand: "JP-RESIDENT", encryptedSalary: "0x5e8d2f6a3b7c1d4e5f6a7b8c9d0e1f2a" },
];

export function Payroll() {
  const { isConnected } = useAccount();
  const { cycleCount } = useAgentVault();
  const { agentState, runPayrollCycle } = usePayrollAgent();
  const [activeFilter, setActiveFilter] = useState("all");

  const departments = ["all", ...new Set(DEMO_EMPLOYEES.map((employee) => employee.department))];
  const filtered =
    activeFilter === "all"
      ? DEMO_EMPLOYEES
      : DEMO_EMPLOYEES.filter((employee) => employee.department === activeFilter);

  const daysEmployed = (since) =>
    Math.floor((Date.now() - new Date(since)) / (1000 * 60 * 60 * 24));

  return (
    <div className="page-workspace animate-fade-in">
      <div className="page-header">
        <div>
          <div className="page-kicker">Encrypted roster</div>
          <h1 className="page-title">Payroll</h1>
          <p className="page-subtitle">
            Encrypted employee records for the next payroll cycle.
          </p>
        </div>
        <div className="page-actions">
          <div className="pill">
            <RosterIcon className="w-3.5 h-3.5" />
            Cycle #{cycleCount?.toString() ?? "0"}
          </div>
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
          { value: String(DEMO_EMPLOYEES.length), label: "Employees", sub: "active records" },
          { value: String(new Set(DEMO_EMPLOYEES.map((e) => e.department)).size), label: "Teams", sub: "departments" },
          { value: String(new Set(DEMO_EMPLOYEES.map((e) => e.jurisdiction)).size), label: "Regions", sub: "jurisdictions" },
          { value: "$0.85", label: "Cycle cost", sub: "x402 services" },
        ].map(({ value, label, sub }) => (
          <div key={label} className="metric-card">
            <div className="metric-card-value">{value}</div>
            <div className="metric-card-label">{label}</div>
            <div className="metric-card-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="filter-tabs">
        {departments.map((department) => {
          const active = activeFilter === department;
          return (
            <button
              key={department}
              onClick={() => setActiveFilter(department)}
              className={active ? "btn-primary px-4 h-10 text-sm capitalize font-bold" : "btn-secondary px-4 h-10 text-sm capitalize font-bold"}
            >
              {department === "all" ? `All (${DEMO_EMPLOYEES.length})` : department}
            </button>
          );
        })}
      </div>

      <div className="grid gap-3">
        {filtered.map((employee) => (
          <EmployeeRow key={employee.id} employee={employee} days={daysEmployed(employee.employedSince)} />
        ))}
      </div>

      <div className="surface-row flex items-center gap-3 px-4 py-3 text-sm">
        <ShieldIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--green)" }} />
        <span style={{ color: "var(--text-secondary)" }}>
          Salary amounts are stored as euint64 ciphertext handles. Observers never see plaintext payroll values.
        </span>
      </div>
    </div>
  );
}

function EmployeeRow({ employee, days }) {
  const initials = employee.name
    .split(" ")
    .map((name) => name[0])
    .join("");

  return (
    <div className="employee-row">
      <div className="employee-avatar">
        {initials}
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {employee.name}
          </span>
          <span className="pill text-[11px]">{employee.level}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
          <span className="mono">{formatAddress(employee.wallet)}</span>
          <span>{employee.department}</span>
          <span>{days}d tenure</span>
        </div>
      </div>

      <div>
        <div className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {employee.jurisdiction}
        </div>
        <div className="text-xs mono mt-1" style={{ color: "var(--text-muted)" }}>
          {employee.taxBand}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <LockIcon className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
        <span className="encrypted-value">{formatCiphertext(employee.encryptedSalary)}</span>
      </div>

      <div className="flex justify-end">
        <ShieldIcon className="w-4 h-4" style={{ color: "var(--green)" }} />
      </div>
    </div>
  );
}
