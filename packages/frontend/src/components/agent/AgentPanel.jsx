import { AgentIcon, CheckIcon } from "@/components/icons";
import { CYCLE_STEPS } from "@/constants";

export function AgentPanel({ agentState, onRun, onReset, servicesOnline }) {
  const { currentStep, cycleId, error, running } = agentState;
  const stepOrder = CYCLE_STEPS.map((s) => s.id);
  const currentIndex = stepOrder.indexOf(currentStep);
  const isComplete = currentStep === "complete";
  const status = running ? "Running" : isComplete ? "Complete" : servicesOnline ? "Ready" : "Offline";

  return (
    <div className="card p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: running ? "rgba(245, 165, 36, 0.12)" : "var(--bg-elevated)" }}
          >
            <AgentIcon className="w-4 h-4" style={{ color: running ? "var(--yellow)" : "var(--text-primary)" }} />
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
              AI Payroll Agent
            </div>
            <div className="text-xs" style={{ color: "var(--text-muted)" }}>
              Sequential x402 workflow
            </div>
          </div>
        </div>
        <span className="pill px-2 py-1 text-[11px] mono">
          <span
            className="status-dot"
            style={{
              background: running ? "var(--yellow)" : isComplete || servicesOnline ? "var(--green)" : "var(--red)",
            }}
          />
          {status}
        </span>
      </div>

      <div className="space-y-2">
        {CYCLE_STEPS.map((step, index) => {
          const isDone = currentStep === "complete" || (currentIndex > index && currentIndex !== -1);
          const isActive = currentStep === step.id;
          const isPending = !isDone && !isActive;

          return (
            <div
              key={step.id}
              className="surface-row flex items-center gap-3 px-3 py-3 transition-colors"
              style={{ background: isActive ? "#353535" : "var(--bg-elevated)" }}
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] mono flex-shrink-0"
                style={{
                  background: isDone ? "var(--green)" : isActive ? "var(--text-primary)" : "#1f1f1f",
                  color: isDone || isActive ? "#111" : "var(--text-muted)",
                  border: isPending ? "1px solid var(--border)" : "1px solid transparent",
                }}
              >
                {isDone ? <CheckIcon className="w-3.5 h-3.5" /> : index + 1}
              </div>

              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium" style={{ color: isPending ? "var(--text-muted)" : "var(--text-primary)" }}>
                  {step.label}
                </div>
                {step.service && (
                  <div className="text-xs mt-0.5 mono" style={{ color: "var(--text-muted)" }}>
                    {step.service}{step.cost ? ` / ${step.cost} USDC` : ""}
                  </div>
                )}
              </div>

              {isActive && (
                <span
                  className="w-4 h-4 rounded-full border-2 spinner flex-shrink-0"
                  style={{ borderColor: "var(--text-secondary)", borderTopColor: "transparent" }}
                />
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs mono px-1" style={{ color: "var(--text-muted)" }}>
        <span>Per-cycle service cost</span>
        <span style={{ color: "var(--text-secondary)" }}>$0.003 USDC</span>
      </div>

      {error && (
        <div className="surface-row p-3 text-xs mono break-all" style={{ color: "var(--red)" }}>
          {error}
        </div>
      )}

      {isComplete && cycleId && (
        <div className="surface-row p-3 text-xs" style={{ color: "var(--green)" }}>
          Cycle complete. Salary amounts stayed encrypted through the full path.
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={onRun}
          disabled={running || (!servicesOnline && !import.meta.env.DEV)}
          className="btn-primary flex-1 h-11 text-sm font-semibold"
          style={{ opacity: running ? 0.7 : 1 }}
        >
          {running ? "Agent running" : isComplete ? "Run another cycle" : "Run payroll cycle"}
        </button>

        {!running && (isComplete || error) && (
          <button onClick={onReset} className="btn-secondary h-11 px-4 text-sm">
            Reset
          </button>
        )}
      </div>
    </div>
  );
}
