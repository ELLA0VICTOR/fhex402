import { ComplianceIcon, DisbursIcon, RefreshIcon, RosterIcon } from "@/components/icons";

const SERVICE_META = {
  roster: { label: "RosterAPI", Icon: RosterIcon, cost: "$0.10", port: 3001 },
  compliance: { label: "ComplianceAPI", Icon: ComplianceIcon, cost: "$0.25", port: 3002 },
  disburse: { label: "DisbursAPI", Icon: DisbursIcon, cost: "$0.50", port: 3003 },
};

export function ServicesStatus({ health, onRefresh }) {
  const statuses = Object.values(health);
  const checked = statuses.length > 0;
  const allOnline = checked && statuses.every((s) => s.online);

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            x402 service mesh
          </span>
          <span className="pill px-2 py-1 text-[11px] mono">
            <span
              className="status-dot"
              style={{ background: !checked ? "var(--text-muted)" : allOnline ? "var(--green)" : "var(--red)" }}
            />
            {!checked ? "checking" : allOnline ? "online" : "degraded"}
          </span>
        </div>
        {onRefresh && (
          <button onClick={onRefresh} className="btn-secondary h-8 w-8 flex items-center justify-center" title="Refresh">
            <RefreshIcon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-3">
        {Object.entries(SERVICE_META).map(([key, { label, Icon, cost, port }], index) => {
          const online = health[key]?.online;
          return (
            <div
              key={key}
              className="px-4 py-4"
              style={{
                borderRight: index === 2 ? "none" : "1px solid var(--border)",
                background: online ? "rgba(255,255,255,0.01)" : "transparent",
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                  >
                    <Icon className="w-4 h-4" style={{ color: online ? "var(--text-primary)" : "var(--text-muted)" }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {label}
                    </div>
                    <div className="text-xs mt-1 mono" style={{ color: "var(--text-muted)" }}>
                      :{port} / {cost}
                    </div>
                  </div>
                </div>
                <span
                  className="status-dot mt-2"
                  style={{
                    background: online === undefined ? "var(--text-muted)" : online ? "var(--green)" : "var(--red)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
