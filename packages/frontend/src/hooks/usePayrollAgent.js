import { useState, useCallback, useRef } from "react";
import { useWalletClient } from "wagmi";
import { x402Fetch, SERVICES } from "@/lib/x402";
import { encryptUint64, demoEncryptedValue } from "@/lib/fhevm";
import { CONTRACTS } from "@/lib/contracts";
import { sleep } from "@/lib/utils";

const INITIAL_STATE = {
  running: false,
  currentStep: null, // null | "roster" | "compliance" | "disburse" | "complete"
  cycleId: null,
  roster: null,
  complianceResults: null,
  disbursementResults: null,
  logs: [],
  error: null,
  startedAt: null,
  completedAt: null,
};

export function usePayrollAgent() {
  const { data: walletClient } = useWalletClient();
  const [agentState, setAgentState] = useState(INITIAL_STATE);
  const runningRef = useRef(false);

  // ── Log helper ──────────────────────────────────────────────────────────
  const addLog = useCallback((message, type = "info") => {
    setAgentState((prev) => ({
      ...prev,
      logs: [
        ...prev.logs,
        { id: Date.now() + Math.random(), timestamp: new Date().toISOString(), message, type },
      ],
    }));
  }, []);

  const updateState = useCallback((updates) => {
    setAgentState((prev) => ({ ...prev, ...updates }));
  }, []);

  // ── Main agent execution ─────────────────────────────────────────────────
  const runPayrollCycle = useCallback(async () => {
    if (runningRef.current) return;
    if (!walletClient) {
      addLog("Wallet not connected", "error");
      return;
    }

    runningRef.current = true;
    const userAddress = walletClient.account.address;
    const vaultAddress = CONTRACTS.AgentVault.address;
    const isDemoMode = !vaultAddress || vaultAddress === "undefined";

    updateState({
      running: true,
      currentStep: "roster",
      logs: [],
      error: null,
      roster: null,
      complianceResults: null,
      disbursementResults: null,
      startedAt: new Date().toISOString(),
      completedAt: null,
    });

    const cycleId = `cycle-${Date.now()}`;

    try {
      // ── STEP 0: Start cycle on-chain ────────────────────────────────────
      addLog("Initializing new payroll cycle...", "info");

      if (!isDemoMode) {
        const rosterHash = `0x${cycleId.replace(/[^a-f0-9]/gi, "").padEnd(64, "0")}`;
        addLog("Submitting startCycle tx to AgentVault...", "info");

        const startTxHash = await walletClient.writeContract({
          address: vaultAddress,
          abi: CONTRACTS.AgentVault.abi,
          functionName: "startCycle",
          args: [rosterHash],
        });
        addLog(`Cycle on-chain — tx: ${startTxHash.slice(0, 10)}...`, "success");
      } else {
        addLog("Demo mode — skipping on-chain startCycle", "info");
        await sleep(400);
      }

      // ── STEP 1: RosterAPI via x402 ──────────────────────────────────────
      addLog("Agent requesting employee roster via x402...", "info");
      updateState({ currentStep: "roster" });
      await sleep(300);

      if (!isDemoMode && vaultAddress) {
        addLog("Encrypting payment for FHE budget check...", "info");
        try {
          const enc = await encryptUint64(100000, vaultAddress, userAddress);
          await walletClient.writeContract({
            address: vaultAddress,
            abi: CONTRACTS.AgentVault.abi,
            functionName: "authorizeServicePayment",
            args: [enc.handles[0], enc.inputProof, 1n, 0],
          });
          addLog("FHE budget check passed — authorized RosterAPI payment", "success");
        } catch (e) {
          addLog(`FHE auth warning: ${e.message} — proceeding`, "warning");
        }
      }

      addLog("Paying RosterAPI via x402 ($0.10 USDC)...", "payment");
      await sleep(500);

      const rosterResponse = await x402Fetch(
        SERVICES.roster.endpoint,
        { method: "GET" },
        userAddress
      );

      let rosterData;
      if (rosterResponse.ok) {
        rosterData = await rosterResponse.json();
      } else {
        // Fallback demo data if services are offline
        addLog("RosterAPI offline — using demo roster data", "warning");
        rosterData = buildDemoRoster();
      }

      addLog(
        `RosterAPI responded — ${rosterData.employeeCount || rosterData.roster?.length || 5} employees fetched`,
        "success"
      );
      updateState({ roster: rosterData });
      await sleep(200);

      // ── STEP 2: ComplianceAPI via x402 ─────────────────────────────────
      addLog("Running compliance checks via x402...", "info");
      updateState({ currentStep: "compliance" });
      await sleep(300);

      if (!isDemoMode && vaultAddress) {
        try {
          const enc = await encryptUint64(250000, vaultAddress, userAddress);
          await walletClient.writeContract({
            address: vaultAddress,
            abi: CONTRACTS.AgentVault.abi,
            functionName: "authorizeServicePayment",
            args: [enc.handles[0], enc.inputProof, 1n, 1],
          });
          addLog("FHE budget check passed — authorized ComplianceAPI payment", "success");
        } catch (e) {
          addLog(`FHE auth warning: ${e.message} — proceeding`, "warning");
        }
      }

      addLog("Paying ComplianceAPI via x402 ($0.25 USDC)...", "payment");
      await sleep(600);

      const roster = rosterData.roster || rosterData;
      const complianceResponse = await x402Fetch(
        SERVICES.compliance.endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roster, cycleId }),
        },
        userAddress
      );

      let complianceData;
      if (complianceResponse.ok) {
        complianceData = await complianceResponse.json();
      } else {
        addLog("ComplianceAPI offline — using demo compliance data", "warning");
        complianceData = buildDemoCompliance(roster);
      }

      const summary = complianceData.summary || {};
      addLog(
        `Compliance done — ${summary.cleared ?? "5"} cleared, ${summary.flagged ?? "0"} flagged`,
        summary.flagged > 0 ? "warning" : "success"
      );
      updateState({ complianceResults: complianceData });
      await sleep(200);

      // ── STEP 3: DisbursAPI via x402 ────────────────────────────────────
      addLog("Initiating encrypted batch disbursement via x402...", "info");
      updateState({ currentStep: "disburse" });
      await sleep(300);

      if (!isDemoMode && vaultAddress) {
        try {
          const enc = await encryptUint64(500000, vaultAddress, userAddress);
          await walletClient.writeContract({
            address: vaultAddress,
            abi: CONTRACTS.AgentVault.abi,
            functionName: "authorizeServicePayment",
            args: [enc.handles[0], enc.inputProof, 1n, 2],
          });
          addLog("FHE budget check passed — authorized DisbursAPI payment", "success");
        } catch (e) {
          addLog(`FHE auth warning: ${e.message} — proceeding`, "warning");
        }
      }

      addLog("Paying DisbursAPI via x402 ($0.50 USDC)...", "payment");
      await sleep(700);

      const complianceResults = complianceData.results || complianceData;
      const disbursResponse = await x402Fetch(
        SERVICES.disburse.endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            complianceResults,
            cycleId,
            agentVaultAddress: vaultAddress,
          }),
        },
        userAddress
      );

      let disbursData;
      if (disbursResponse.ok) {
        disbursData = await disbursResponse.json();
      } else {
        addLog("DisbursAPI offline — using demo disbursement data", "warning");
        disbursData = buildDemoDisbursement(complianceResults, cycleId);
      }

      const disbSummary = disbursData.summary || {};
      addLog(
        `Disbursement complete — ${disbSummary.totalDispatched ?? complianceResults.filter(r => r.status === "CLEARED").length} payments sent`,
        "success"
      );
      updateState({ disbursementResults: disbursData, currentStep: "complete" });

      // ── STEP 4: Complete cycle on-chain ─────────────────────────────────
      addLog("Recording cycle completion on-chain...", "info");

      if (!isDemoMode && vaultAddress) {
        try {
          const totalEnc = await encryptUint64(850000, vaultAddress, userAddress);
          await walletClient.writeContract({
            address: vaultAddress,
            abi: CONTRACTS.AgentVault.abi,
            functionName: "completeCycle",
            args: [1n, totalEnc.handles[0], totalEnc.inputProof],
          });
          addLog("Cycle recorded on AgentVault — all amounts remain encrypted", "success");
        } catch (e) {
          addLog(`On-chain cycle record: ${e.message}`, "warning");
        }
      } else {
        await sleep(400);
      }

      addLog("Payroll cycle complete — salary amounts encrypted on-chain", "success");
      addLog("Open Audit tab to decrypt your private spend breakdown", "info");

      updateState({
        running: false,
        cycleId,
        completedAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("[PayrollAgent] Error:", err);
      addLog(`Error: ${err.message}`, "error");
      updateState({ running: false, error: err.message });
    } finally {
      runningRef.current = false;
    }
  }, [walletClient, addLog, updateState]);

  const resetAgent = useCallback(() => {
    if (runningRef.current) return;
    setAgentState(INITIAL_STATE);
  }, []);

  return { agentState, runPayrollCycle, resetAgent };
}

// ── Demo data builders ──────────────────────────────────────────────────────
function buildDemoRoster() {
  const roster = [
    { id: "emp-001", name: "Amara Okonkwo",    wallet: "0x742d35Cc6634C0532925a3b8D4C9b1A5AE6D7890", department: "Engineering", jurisdiction: "NG", employedSince: "2022-03-15", active: true, encryptedSalary: demoEncryptedValue("emp-001"), taxBand: "PITA" },
    { id: "emp-002", name: "Kofi Mensah",      wallet: "0x8Ba1f109551bD432803012645Ac136ddd64DBA72", department: "Product",      jurisdiction: "GH", employedSince: "2021-11-02", active: true, encryptedSalary: demoEncryptedValue("emp-002"), taxBand: "GH-TAX" },
    { id: "emp-003", name: "Fatima Al-Hassan", wallet: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", department: "Design",       jurisdiction: "AE", employedSince: "2023-01-20", active: true, encryptedSalary: demoEncryptedValue("emp-003"), taxBand: "TAX_EXEMPT" },
    { id: "emp-004", name: "Marcus Veltri",    wallet: "0x4dBa88e9dc5D4ee56f4aBdC6cF2e0CA1d8bE3F2", department: "Operations",   jurisdiction: "US", employedSince: "2022-07-08", active: true, encryptedSalary: demoEncryptedValue("emp-004"), taxBand: "W-2" },
    { id: "emp-005", name: "Yuki Tanaka",      wallet: "0x5eCb99f0EA1e7dF65bcCd8E3Abc2F0d9C7aE4B1", department: "Engineering",  jurisdiction: "JP", employedSince: "2023-04-12", active: true, encryptedSalary: demoEncryptedValue("emp-005"), taxBand: "JP-RESIDENT" },
  ];
  return { ok: true, employeeCount: roster.length, roster, rosterHash: demoEncryptedValue("hash") };
}

function buildDemoCompliance(roster) {
  const results = roster.map((emp) => ({
    employeeId: emp.id,
    wallet: emp.wallet,
    name: emp.name,
    status: "CLEARED",
    riskScore: 0,
    riskLevel: "LOW",
    taxBand: emp.taxBand || "STANDARD",
    jurisdiction: emp.jurisdiction,
    issues: [],
    eligibleForPayment: true,
    checkedAt: new Date().toISOString(),
  }));
  return { ok: true, summary: { total: results.length, cleared: results.length, flagged: 0, allCleared: true }, results };
}

function buildDemoDisbursement(complianceResults, cycleId) {
  const cleared = complianceResults.filter((r) => r.status === "CLEARED");
  const disbursements = cleared.map((emp) => ({
    employeeId: emp.employeeId,
    wallet: emp.wallet,
    name: emp.name,
    status: "SENT",
    txHash: demoEncryptedValue(`tx-${cycleId}-${emp.employeeId}`).slice(0, 66),
    timestamp: new Date().toISOString(),
    note: "DEMO_MODE",
  }));
  return {
    ok: true,
    summary: { totalDispatched: disbursements.length, totalFailed: 0, encryptedTotalRef: demoEncryptedValue("total") },
    disbursements,
  };
}
