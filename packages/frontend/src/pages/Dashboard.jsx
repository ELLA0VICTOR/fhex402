import { useEffect, useMemo, useState } from "react";
import { useAccount, useConnect } from "wagmi";
import {
  AgentIcon,
  CheckIcon,
  ComplianceIcon,
  DisbursIcon,
  GhostIcon,
  LockIcon,
  PayrollIcon,
  RosterIcon,
  VaultIcon,
} from "@/components/icons";
import { RosterTable } from "@/components/payroll/RosterTable";
import { DepositModal } from "@/components/vault/DepositModal";
import { CYCLE_STEPS } from "@/constants";
import { useAgentVault } from "@/hooks/useAgentVault";
import { usePayrollAgent } from "@/hooks/usePayrollAgent";
import { checkServicesHealth } from "@/lib/x402";

const SERVICE_META = {
  roster: { label: "RosterAPI", port: "3001", price: "$0.10", Icon: RosterIcon },
  compliance: { label: "ComplianceAPI", port: "3002", price: "$0.25", Icon: ComplianceIcon },
  disburse: { label: "DisbursAPI", port: "3003", price: "$0.50", Icon: DisbursIcon },
};

export function Dashboard() {
  const { isConnected } = useAccount();
  const { agentState, runPayrollCycle, resetAgent } = usePayrollAgent();
  const vault = useAgentVault();
  const [servicesHealth, setServicesHealth] = useState({});
  const [depositOpen, setDepositOpen] = useState(false);

  useEffect(() => {
    let interval;

    async function poll() {
      const health = await checkServicesHealth();
      setServicesHealth(health);
    }

    poll();
    interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const servicesOnline =
    Object.values(servicesHealth).length > 0 &&
    Object.values(servicesHealth).every((service) => service.online);

  if (!isConnected) {
    return <ConnectPrompt />;
  }

  const roster = agentState.roster?.roster;

  return (
    <>
      <div className="dashboard-workspace animate-fade-in">
        <DashboardHeader />

        <div className="dashboard-main-grid">
          <CycleWorkbench
            agentState={agentState}
            onRun={runPayrollCycle}
            onReset={resetAgent}
            servicesOnline={servicesOnline}
          />

          <div className="dashboard-side-rail">
            <VaultSummary vault={vault} onDeposit={() => setDepositOpen(true)} />
            <ServiceMesh health={servicesHealth} />
          </div>
        </div>

        <div className="dashboard-bottom-grid">
          <AgentLogPanel logs={agentState.logs} />
          {roster ? (
            <RosterTable
              roster={roster}
              complianceResults={agentState.complianceResults?.results}
              disbursementResults={agentState.disbursementResults?.disbursements}
            />
          ) : (
            <RosterPlaceholder />
          )}
        </div>
      </div>

      <DepositModal open={depositOpen} onClose={() => setDepositOpen(false)} />
    </>
  );
}

function DashboardHeader() {
  return (
    <section className="dashboard-header-panel">
      <div className="min-w-0">
        <h1>Payroll Command Center</h1>
        <p>
          Execute a private payroll cycle across encrypted budget checks, x402 service calls,
          compliance validation, and batch disbursement.
        </p>
      </div>
    </section>
  );
}

function CycleWorkbench({ agentState, onRun, onReset, servicesOnline }) {
  const { complianceResults, currentStep, cycleId, disbursementResults, error, roster, running } = agentState;
  const currentIndex = CYCLE_STEPS.findIndex((step) => step.id === currentStep);
  const isComplete = currentStep === "complete";
  const rosterCount = roster?.employeeCount ?? roster?.roster?.length ?? 0;
  const clearedCount =
    complianceResults?.summary?.cleared ??
    complianceResults?.results?.filter((result) => result.status === "CLEARED").length ??
    0;
  const dispatchedCount =
    disbursementResults?.summary?.totalDispatched ??
    disbursementResults?.disbursements?.filter((result) => result.status === "SENT").length ??
    0;

  return (
    <section className="workbench-panel">
      <div className="workbench-header">
        <div>
          <div className="panel-kicker">Agent workflow</div>
          <h2>Private payroll cycle</h2>
        </div>
        <span className="state-label">
          <span
            className="status-dot"
            style={{ background: running ? "var(--yellow)" : isComplete || servicesOnline ? "var(--green)" : "var(--red)" }}
          />
          {running ? "Running" : isComplete ? "Complete" : servicesOnline ? "Ready" : "Offline"}
        </span>
      </div>

      <div className="cycle-id-row">
        <span>Cycle</span>
        <span>{cycleId || "Not started"}</span>
      </div>

      <div className="cycle-stepper">
        {CYCLE_STEPS.map((step, index) => {
          const done = currentStep === "complete" || (currentIndex > index && currentIndex !== -1);
          const active = currentStep === step.id;
          return (
            <div key={step.id} className={`cycle-step ${active ? "active" : ""} ${done ? "done" : ""}`}>
              <div className="cycle-step-index">
                {done ? <CheckIcon className="w-4 h-4" /> : index + 1}
              </div>
              <div className="min-w-0">
                <div className="cycle-step-label">{step.label}</div>
                <div className="cycle-step-meta">
                  {step.service ? `${step.service} / ${step.cost} USDC` : "Finalize private audit state"}
                </div>
              </div>
              {active && <span className="cycle-spinner" />}
            </div>
          );
        })}
      </div>

      <div className="cycle-metrics">
        <MetricBox label="Roster" value={rosterCount || "-"} sub="employees" />
        <MetricBox label="Cleared" value={clearedCount || "-"} sub="eligible" />
        <MetricBox label="Sent" value={dispatchedCount || "-"} sub="payments" />
      </div>

      {error && <div className="workbench-error">{error}</div>}

      <div className="workbench-actions">
        <button
          onClick={onRun}
          disabled={running || (!servicesOnline && !import.meta.env.DEV)}
          className="btn-primary workbench-run"
        >
          <PayrollIcon className="w-4 h-4" />
          {running ? "Running cycle" : isComplete ? "Run another cycle" : "Run payroll cycle"}
        </button>
        {!running && (isComplete || error) && (
          <button onClick={onReset} className="btn-secondary workbench-reset">
            Reset
          </button>
        )}
      </div>
    </section>
  );
}

function VaultSummary({ vault, onDeposit }) {
  const {
    agentActive,
    cycleCount,
    hasContract,
    lastDecryptedBudget,
    lastDecryptedSpent,
    utilizationPct,
  } = vault;
  const hasDecrypted = lastDecryptedBudget !== undefined && lastDecryptedBudget > 0n;
  const budget = hasDecrypted ? Number(lastDecryptedBudget) / 1_000_000 : null;
  const spent = hasDecrypted ? Number(lastDecryptedSpent || 0n) / 1_000_000 : null;

  return (
    <section className="side-panel vault-panel">
      <div className="side-panel-header">
        <div className="side-icon">
          <VaultIcon className="w-4 h-4" />
        </div>
        <div>
          <h3>Agent Vault</h3>
          <p>{hasContract ? "Encrypted budget guard" : "Awaiting contract"}</p>
        </div>
      </div>

      <div className="vault-balance">
        <span>Budget</span>
        <strong>{budget === null ? "Encrypted" : `${budget.toLocaleString()} USDC`}</strong>
      </div>

      <div className="vault-progress">
        <div style={{ width: `${utilizationPct}%` }} />
      </div>

      <div className="mini-stat-grid">
        <MetricBox label="Spent" value={spent === null ? "-" : spent.toLocaleString()} sub="USDC" compact />
        <MetricBox label="Cycles" value={cycleCount?.toString() ?? "0"} sub="complete" compact />
        <MetricBox label="Agent" value={agentActive ? "On" : "Idle"} sub="status" compact />
      </div>

      <button onClick={onDeposit} className="btn-secondary side-action">
        Deposit budget
      </button>
    </section>
  );
}

function ServiceMesh({ health }) {
  const entries = useMemo(() => Object.entries(SERVICE_META), []);

  return (
    <section className="side-panel">
      <div className="side-panel-header">
        <div className="side-icon">
          <AgentIcon className="w-4 h-4" />
        </div>
        <div>
          <h3>x402 Services</h3>
          <p>Paid HTTP dependencies</p>
        </div>
      </div>

      <div className="service-list">
        {entries.map(([key, service]) => {
          const online = health[key]?.online;
          const Icon = service.Icon;
          return (
            <div key={key} className="service-row">
              <Icon className="w-4 h-4" />
              <div className="min-w-0">
                <strong>{service.label}</strong>
                <span>:{service.port} / {service.price}</span>
              </div>
              <span
                className="status-dot"
                style={{ background: online === undefined ? "var(--text-muted)" : online ? "var(--green)" : "var(--red)" }}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function AgentLogPanel({ logs }) {
  return (
    <section className="log-panel">
      <div className="panel-header-row">
        <div>
          <div className="panel-kicker">Runtime</div>
          <h3>Agent log</h3>
        </div>
        <span className="state-label">{logs.length} events</span>
      </div>

      <div className="log-stream">
        {logs.length === 0 ? (
          <div className="empty-log">
            <AgentIcon className="w-5 h-5" />
            <span>Run a payroll cycle to stream x402 calls and encrypted budget checks.</span>
          </div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`log-line ${log.type}`}>
              <span>
                {new Date(log.timestamp).toLocaleTimeString("en", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                  hour12: false,
                })}
              </span>
              <strong>{log.type}</strong>
              <p>{log.message}</p>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function RosterPlaceholder() {
  return (
    <section className="roster-placeholder">
      <div className="panel-header-row">
        <div>
          <div className="panel-kicker">Roster</div>
          <h3>Encrypted employees</h3>
        </div>
        <LockIcon className="w-4 h-4" />
      </div>

      <div className="placeholder-rows">
        {["RosterAPI", "ComplianceAPI", "DisbursAPI"].map((name, index) => (
          <div key={name} className="placeholder-row">
            <span>{index + 1}</span>
            <div>
              <strong>{name}</strong>
              <p>{index === 0 ? "Fetch encrypted salaries" : index === 1 ? "Validate eligibility" : "Dispatch transfers"}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MetricBox({ label, value, sub, compact = false }) {
  return (
    <div className={compact ? "metric-box compact" : "metric-box"}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{sub}</small>
    </div>
  );
}

function ConnectPrompt() {
  const { connect, connectors } = useConnect();

  function handleConnect() {
    const connector = connectors.find((candidate) => candidate.id === "metaMask") || connectors[0];
    if (connector) connect({ connector });
  }

  return (
    <div className="connect-stage animate-fade-in">
      <section className="connect-panel">
        <div className="connect-copy">
          <div className="connect-logo">
            <GhostIcon className="w-5 h-5" />
          </div>
          <div className="eyebrow-row">
            <span className="status-dot" style={{ background: "var(--green)" }} />
            <span>Private payroll rail</span>
          </div>
          <h1>Run payroll without revealing payroll.</h1>
          <p>
            GhostPay coordinates encrypted budget checks, x402 service payments,
            compliance validation, and salary disbursement from one agent console.
          </p>
          <button onClick={handleConnect} className="btn-primary connect-button">
            Connect MetaMask
          </button>
        </div>

        <div className="connect-preview" aria-hidden="true">
          <div className="preview-header">
            <span>Cycle preview</span>
            <strong>$0.85</strong>
          </div>
          {[
            ["Roster", "Encrypted salary fetch", RosterIcon],
            ["Compliance", "Eligibility checks", ComplianceIcon],
            ["Disburse", "Batch transfer", DisbursIcon],
          ].map(([label, text, Icon]) => (
            <div key={label} className="preview-step">
              <Icon className="w-4 h-4" />
              <div>
                <strong>{label}</strong>
                <span>{text}</span>
              </div>
              <CheckIcon className="w-4 h-4" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
