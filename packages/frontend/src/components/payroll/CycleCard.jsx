import { ComplianceIcon, DisbursIcon, RosterIcon, ShieldIcon } from "@/components/icons";

const STEP_ICONS = {
  roster: RosterIcon,
  compliance: ComplianceIcon,
  disburse: DisbursIcon,
  complete: ShieldIcon,
};

const STEP_LABELS = {
  roster: "Fetching roster",
  compliance: "Running compliance",
  disburse: "Disbursing salaries",
  complete: "Cycle complete",
};

export function CycleCard({ agentState }) {
  const {
    completedAt,
    complianceResults,
    currentStep,
    cycleId,
    disbursementResults,
    roster,
    running,
    startedAt,
  } = agentState;

  const rosterCount = roster?.employeeCount ?? roster?.roster?.length ?? 0;
  const clearedCount =
    complianceResults?.summary?.cleared ??
    complianceResults?.results?.filter((r) => r.status === "CLEARED").length ??
    0;
  const dispatchedCount =
    disbursementResults?.summary?.totalDispatched ??
    disbursementResults?.disbursements?.filter((d) => d.status === "SENT").length ??
    0;
  const ActiveIcon = currentStep ? STEP_ICONS[currentStep] : ShieldIcon;
  const duration =
    startedAt && completedAt ? Math.round((new Date(completedAt) - new Date(startedAt)) / 1000) : null;

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            Current cycle
          </div>
          <div className="text-xs mt-1 mono" style={{ color: "var(--text-muted)" }}>
            {cycleId ? cycleId.slice(0, 24) : "No cycle started"}
          </div>
        </div>
        {duration && (
          <span className="pill px-2 py-1 text-[11px] mono">
            {duration}s
          </span>
        )}
      </div>

      {running && currentStep ? (
        <div className="surface-row agent-active flex items-center gap-3 px-4 py-4">
          <span
            className="w-4 h-4 rounded-full border-2 spinner flex-shrink-0"
            style={{ borderColor: "var(--text-secondary)", borderTopColor: "transparent" }}
          />
          <ActiveIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-primary)" }} />
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            {STEP_LABELS[currentStep]}
          </span>
          <span className="ml-auto text-xs mono" style={{ color: "var(--text-muted)" }}>
            x402
          </span>
        </div>
      ) : !cycleId ? (
        <div className="surface-row px-4 py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
          Start a payroll cycle to see live progress.
        </div>
      ) : null}

      {(rosterCount > 0 || clearedCount > 0 || dispatchedCount > 0) && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Roster", value: rosterCount || "-", sub: "employees" },
            { label: "Cleared", value: clearedCount || "-", sub: "eligible" },
            { label: "Sent", value: dispatchedCount || "-", sub: "payments" },
          ].map(({ label, value, sub }) => (
            <div key={label} className="surface-row p-4">
              <div className="text-2xl font-semibold mono" style={{ color: "var(--text-primary)" }}>
                {value}
              </div>
              <div className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>
                {label}
              </div>
              <div className="text-xs mono" style={{ color: "var(--text-muted)" }}>
                {sub}
              </div>
            </div>
          ))}
        </div>
      )}

      {dispatchedCount > 0 && (
        <div className="surface-row flex items-center gap-3 px-3 py-3 text-sm">
          <ShieldIcon className="w-4 h-4 flex-shrink-0" style={{ color: "var(--green)" }} />
          <span style={{ color: "var(--text-secondary)" }}>
            Payroll completed with encrypted salary totals preserved on-chain.
          </span>
        </div>
      )}
    </div>
  );
}
