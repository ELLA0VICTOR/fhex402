import { useEffect, useRef } from "react";

const LOG_STYLE = {
  info: { color: "var(--text-secondary)", prefix: "info" },
  success: { color: "var(--green)", prefix: "done" },
  error: { color: "var(--red)", prefix: "error" },
  payment: { color: "var(--text-primary)", prefix: "x402" },
  warning: { color: "var(--yellow)", prefix: "warn" },
};

export function AgentLog({ logs }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [logs.length]);

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
          Agent log
        </span>
        <span className="pill px-2 py-1 text-[11px] mono">
          {logs.length} events
        </span>
      </div>

      <div className="space-y-1 max-h-56 overflow-y-auto pr-1 mono">
        {logs.length === 0 ? (
          <div className="surface-row py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
            Waiting for the next payroll cycle.
          </div>
        ) : (
          logs.map((log) => {
            const style = LOG_STYLE[log.type] || LOG_STYLE.info;
            return (
              <div key={log.id} className="grid grid-cols-[64px_46px_1fr] gap-2 text-xs leading-6 log-entry">
                <span className="tabular-nums" style={{ color: "var(--text-muted)" }}>
                  {new Date(log.timestamp).toLocaleTimeString("en", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
                <span style={{ color: style.color }}>{style.prefix}</span>
                <span style={{ color: style.color }}>{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
