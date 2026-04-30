import { apiFetch, apiUrl } from "@/lib/api";

export const SERVICES = {
  roster: {
    id: 0,
    name: "RosterAPI",
    endpoint: apiUrl("/api/roster/roster"),
    healthEndpoint: apiUrl("/api/roster/health"),
    description: "Encrypted employee roster for current pay cycle",
    cost: "$0.001 USDC",
    costMicro: 1000,
    icon: "roster",
    port: 3001,
  },
  compliance: {
    id: 1,
    name: "ComplianceAPI",
    endpoint: apiUrl("/api/compliance/check"),
    healthEndpoint: apiUrl("/api/compliance/health"),
    description: "Jurisdiction, eligibility and tax band validation",
    cost: "$0.001 USDC",
    costMicro: 1000,
    icon: "compliance",
    port: 3002,
  },
  disburse: {
    id: 2,
    name: "DisbursAPI",
    endpoint: apiUrl("/api/disburse/disburse"),
    healthEndpoint: apiUrl("/api/disburse/health"),
    description: "Encrypted batch salary disbursement execution",
    cost: "$0.001 USDC",
    costMicro: 1000,
    icon: "disburse",
    port: 3003,
  },
};

export async function checkServicesHealth() {
  const results = {};

  for (const [key, service] of Object.entries(SERVICES)) {
    try {
      const res = await apiFetch(service.healthEndpoint, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      results[key] = {
        online: data.ok !== false && data.status === "online",
        ...data,
      };
    } catch (err) {
      results[key] = {
        online: false,
        error: err.message,
      };
    }
  }

  return results;
}
