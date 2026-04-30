import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { createPublicClient, createWalletClient, http } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import { requireAddress, requirePrivateKey, requireEnv } from "../shared/env.js";
import { prepareEncryptedRoster } from "../shared/rosterPreparation.js";
import { computeRosterHash } from "../shared/crypto.js";
import { getActiveRoster } from "../roster-api/rosterStore.js";

dotenv.config();

const PORT = 3004;
const SERVICE_BASE = {
  roster: process.env.ROSTER_API_URL || "http://localhost:3001",
  compliance: process.env.COMPLIANCE_API_URL || "http://localhost:3002",
  disburse: process.env.DISBURSE_API_URL || "http://localhost:3003",
};

const SERVICE_COSTS = {
  roster: 1000n,
  compliance: 1000n,
  disburse: 1000n,
};

const AGENT_VAULT_ABI = [
  {
    name: "cycleCount",
    type: "function",
    inputs: [],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
  {
    name: "authorizeServicePayment",
    type: "function",
    inputs: [
      { name: "encryptedPaymentAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "cycleId", type: "uint256" },
      { name: "serviceId", type: "uint8" },
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    name: "startCycle",
    type: "function",
    inputs: [{ name: "rosterHash", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "completeCycle",
    type: "function",
    inputs: [
      { name: "cycleId", type: "uint256" },
      { name: "encryptedTotal", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "1mb" }));

function requireAdmin(req, res, next) {
  const adminToken = process.env.ROSTER_ADMIN_TOKEN;
  if (!adminToken) {
    return res.status(503).json({ ok: false, error: "ROSTER_ADMIN_TOKEN is not configured" });
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-admin-token"];
  if (token !== adminToken) {
    return res.status(401).json({ ok: false, error: "Unauthorized roster setup request" });
  }

  next();
}

let fheInstancePromise = null;
let running = false;
let state = initialState();

function initialState() {
  return {
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
}

function addLog(message, type = "info") {
  state.logs.push({
    id: `${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    message,
    type,
  });
}

function stateForResponse() {
  if (state.roster?.roster?.length) return state;

  const roster = getActiveRoster();
  if (!roster.length) return state;

  return {
    ...state,
    roster: {
      roster,
      employeeCount: roster.length,
      rosterHash: computeRosterHash(roster),
    },
  };
}

function toHexValue(value) {
  if (!value) return value;
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (value instanceof ArrayBuffer) return `0x${Buffer.from(new Uint8Array(value)).toString("hex")}`;
  if (Array.isArray(value)) return `0x${Buffer.from(value).toString("hex")}`;
  return value;
}

async function getFheInstance() {
  if (!fheInstancePromise) {
    fheInstancePromise = createInstance({
      ...SepoliaConfig,
      network: requireEnv("SEPOLIA_RPC_URL"),
    });
  }
  return fheInstancePromise;
}

async function encryptUint64(value, contractAddress, userAddress) {
  const instance = await getFheInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(BigInt(value));
  const encrypted = await input.encrypt();
  return {
    handle: toHexValue(encrypted.handles[0]),
    proof: toHexValue(encrypted.inputProof),
  };
}

async function fetchJson(response, label) {
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.ok === false) {
    throw new Error(`${label} failed: ${data?.error || response.statusText || response.status}`);
  }
  return data;
}

async function writeAndWait(publicClient, walletClient, request) {
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

function createPaidFetch(agentAccount) {
  return wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [
      {
        network: process.env.X402_NETWORK || "eip155:*",
        client: new ExactEvmScheme(agentAccount),
      },
    ],
  });
}

async function authorizePayment({ publicClient, walletClient, vaultAddress, agentAddress, cycleId, serviceId, amount }) {
  const encrypted = await encryptUint64(amount, vaultAddress, agentAddress);
  return writeAndWait(publicClient, walletClient, {
    address: vaultAddress,
    abi: AGENT_VAULT_ABI,
    functionName: "authorizeServicePayment",
    args: [encrypted.handle, encrypted.proof, cycleId, serviceId],
  });
}

async function runCycle() {
  running = true;
  state = {
    ...initialState(),
    running: true,
    currentStep: "roster",
    startedAt: new Date().toISOString(),
  };

  try {
    const privateKey = process.env.AGENT_PRIVATE_KEY || process.env.DISBURSEMENT_PRIVATE_KEY;
    if (!privateKey) throw new Error("AGENT_PRIVATE_KEY or DISBURSEMENT_PRIVATE_KEY is required");

    const vaultAddress = requireAddress("AGENT_VAULT_ADDRESS");
    const agentAccount = privateKeyToAccount(requirePrivateKey(process.env.AGENT_PRIVATE_KEY ? "AGENT_PRIVATE_KEY" : "DISBURSEMENT_PRIVATE_KEY"));
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(requireEnv("SEPOLIA_RPC_URL")),
    });
    const walletClient = createWalletClient({
      account: agentAccount,
      chain: sepolia,
      transport: http(requireEnv("SEPOLIA_RPC_URL")),
    });
    const paidFetch = createPaidFetch(agentAccount);

    const rosterSummary = await fetchJson(await fetch(`${SERVICE_BASE.roster}/summary`), "RosterAPI summary");
    if (!rosterSummary.summary?.configured) {
      throw new Error("RosterAPI has no active employees. Prepare the roster in Payroll, then restart services if the file was updated while they were already running.");
    }
    addLog(`RosterAPI readiness confirmed: ${rosterSummary.summary.activeEmployees} active employees`, "success");

    const currentCount = await publicClient.readContract({
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "cycleCount",
    });
    const cycleId = currentCount + 1n;
    state.cycleId = cycleId.toString();

    addLog("Agent selected the next payroll cycle", "info");
    addLog("Authorizing encrypted RosterAPI spend in AgentVault", "info");
    await authorizePayment({
      publicClient,
      walletClient,
      vaultAddress,
      agentAddress: agentAccount.address,
      cycleId,
      serviceId: 0,
      amount: SERVICE_COSTS.roster,
    });

    addLog("Paying RosterAPI through x402", "payment");
    const rosterData = await fetchJson(await paidFetch(`${SERVICE_BASE.roster}/roster`), "RosterAPI");
    const roster = rosterData.roster || [];
    if (!roster.length || !rosterData.rosterHash) {
      throw new Error("RosterAPI returned no configured encrypted employees");
    }

    state.roster = rosterData;
    addLog(`RosterAPI returned ${roster.length} encrypted employees`, "success");

    addLog("Starting AgentVault cycle on-chain", "info");
    await writeAndWait(publicClient, walletClient, {
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "startCycle",
      args: [rosterData.rosterHash],
    });

    state.currentStep = "compliance";
    addLog("Authorizing encrypted ComplianceAPI spend in AgentVault", "info");
    await authorizePayment({
      publicClient,
      walletClient,
      vaultAddress,
      agentAddress: agentAccount.address,
      cycleId,
      serviceId: 1,
      amount: SERVICE_COSTS.compliance,
    });

    addLog("Paying ComplianceAPI through x402", "payment");
    const complianceData = await fetchJson(
      await paidFetch(`${SERVICE_BASE.compliance}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roster, cycleId: cycleId.toString() }),
      }),
      "ComplianceAPI",
    );

    state.complianceResults = complianceData;
    addLog(
      `Compliance complete: ${complianceData.summary?.cleared ?? 0} cleared, ${complianceData.summary?.flagged ?? 0} flagged`,
      complianceData.summary?.flagged ? "warning" : "success",
    );

    state.currentStep = "disburse";
    addLog("Authorizing encrypted DisbursAPI spend in AgentVault", "info");
    await authorizePayment({
      publicClient,
      walletClient,
      vaultAddress,
      agentAddress: agentAccount.address,
      cycleId,
      serviceId: 2,
      amount: SERVICE_COSTS.disburse,
    });

    addLog("Paying DisbursAPI through x402", "payment");
    const disbursementData = await fetchJson(
      await paidFetch(`${SERVICE_BASE.disburse}/disburse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          complianceResults: complianceData.results || [],
          cycleId: cycleId.toString(),
          agentVaultAddress: vaultAddress,
        }),
      }),
      "DisbursAPI",
    );

    state.disbursementResults = disbursementData;
    addLog(`Disbursement complete: ${disbursementData.summary?.totalDispatched ?? 0} payments dispatched`, "success");

    addLog("Completing encrypted AgentVault cycle", "info");
    const encryptedTotal = await encryptUint64(
      SERVICE_COSTS.roster + SERVICE_COSTS.compliance + SERVICE_COSTS.disburse,
      vaultAddress,
      agentAccount.address,
    );
    await writeAndWait(publicClient, walletClient, {
      address: vaultAddress,
      abi: AGENT_VAULT_ABI,
      functionName: "completeCycle",
      args: [cycleId, encryptedTotal.handle, encryptedTotal.proof],
    });

    state.currentStep = "complete";
    state.running = false;
    state.completedAt = new Date().toISOString();
    addLog("Payroll cycle complete", "success");
  } catch (err) {
    state.running = false;
    state.error = err.message;
    addLog(err.message, "error");
  } finally {
    running = false;
  }
}

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "PayrollAgent",
    status: "online",
    running,
    agentVaultAddress: process.env.AGENT_VAULT_ADDRESS || null,
  });
});

app.get("/status", (req, res) => {
  res.json({ ok: true, state: stateForResponse() });
});

app.post("/run", (req, res) => {
  if (running) {
    return res.status(409).json({ ok: false, error: "Payroll agent is already running", state });
  }

  runCycle();
  return res.status(202).json({ ok: true, state });
});

app.post("/prepare-roster", requireAdmin, async (req, res) => {
  if (running) {
    return res.status(409).json({ ok: false, error: "Payroll agent is running" });
  }

  try {
    const result = await prepareEncryptedRoster(req.body, {
      treasuryFundUSDC: req.body?.treasuryFundUSDC,
      log: (message) => addLog(message, "info"),
    });

    state = {
      ...state,
      roster: {
        roster: result.roster,
        employeeCount: result.employeeCount,
        rosterHash: result.summary.rosterHash,
      },
    };

    return res.json({
      ok: true,
      summary: result.summary,
      employeeCount: result.employeeCount,
      txs: result.txs,
      operator: result.operator,
      tokenAddress: result.tokenAddress,
      payrollAddress: result.payrollAddress,
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.post("/reset", (req, res) => {
  if (running) {
    return res.status(409).json({ ok: false, error: "Payroll agent is running" });
  }
  state = initialState();
  return res.json({ ok: true, state });
});

app.listen(PORT, () => {
  console.log("");
  console.log("[PayrollAgent] ------------------------------------");
  console.log(`[PayrollAgent] Running on http://localhost:${PORT}`);
  console.log(`[PayrollAgent] Vault:      ${(process.env.AGENT_VAULT_ADDRESS || "").slice(0, 10)}...`);
  console.log(`[PayrollAgent] x402:       ${process.env.X402_NETWORK || "eip155:*"}`);
  console.log("[PayrollAgent] ------------------------------------");
  console.log("");
});
