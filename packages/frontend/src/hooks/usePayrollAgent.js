import { useCallback, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

const INITIAL_STATE = {
  running: false,
  currentStep: null,
  cycleId: null,
  roster: null,
  complianceResults: null,
  disbursementResults: null,
  logs: [],
  error: null,
  startedAt: null,
  completedAt: null,
};

async function readAgentState() {
  const response = await apiFetch("/api/agent/status");
  const data = await response.json().catch(() => null);

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.error || "Payroll agent status is unavailable");
  }

  return data.state || INITIAL_STATE;
}

export function usePayrollAgent() {
  const [agentState, setAgentState] = useState(INITIAL_STATE);
  const pollingRef = useRef(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const pollAgent = useCallback(() => {
    stopPolling();
    pollingRef.current = setInterval(async () => {
      try {
        const nextState = await readAgentState();
        setAgentState(nextState);
        if (!nextState.running) stopPolling();
      } catch (err) {
        setAgentState((prev) => ({
          ...prev,
          running: false,
          error: err.message,
        }));
        stopPolling();
      }
    }, 1200);
  }, [stopPolling]);

  const runPayrollCycle = useCallback(async () => {
    if (agentState.running) return;

    setAgentState((prev) => ({
      ...prev,
      running: true,
      currentStep: "roster",
      error: null,
      logs: [
        {
          id: `frontend-${Date.now()}`,
          timestamp: new Date().toISOString(),
          message: "Starting backend payroll agent...",
          type: "info",
        },
      ],
    }));

    try {
      const response = await apiFetch("/api/agent/run", { method: "POST" });
      const data = await response.json().catch(() => null);

      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Payroll agent refused to start");
      }

      setAgentState(data.state || INITIAL_STATE);
      pollAgent();
    } catch (err) {
      setAgentState((prev) => ({
        ...prev,
        running: false,
        error: err.message,
        logs: [
          ...prev.logs,
          {
            id: `frontend-error-${Date.now()}`,
            timestamp: new Date().toISOString(),
            message: err.message,
            type: "error",
          },
        ],
      }));
    }
  }, [agentState.running, pollAgent]);

  const resetAgent = useCallback(async () => {
    stopPolling();

    try {
      const response = await apiFetch("/api/agent/reset", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error || "Unable to reset payroll agent");
      }
      setAgentState(data.state || INITIAL_STATE);
    } catch (err) {
      setAgentState({ ...INITIAL_STATE, error: err.message });
    }
  }, [stopPolling]);

  return { agentState, runPayrollCycle, resetAgent };
}
