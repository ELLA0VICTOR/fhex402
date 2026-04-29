import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { processBatch } from "./handlers/batch.js";
import {
  createX402Middleware,
  error,
  paymentSummary,
  requestLogger,
  success,
} from "../shared/middleware.js";
import { computeRosterHash } from "../shared/crypto.js";

dotenv.config();

const app = express();
const PORT = 3003;
const SERVICE_WALLET =
  process.env.DISBURSE_WALLET_ADDRESS || "0x0000000000000000000000000000000000000003";
const PAYMENT_AMOUNT = "500000";
const PAYMENT_PRICE = "$0.50";

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(requestLogger("DisbursAPI"));

const x402Middleware = createX402Middleware({
  method: "POST",
  path: "/disburse",
  price: PAYMENT_PRICE,
  payTo: SERVICE_WALLET,
  description: "GhostPay DisbursAPI - encrypted batch payroll disbursement",
  serviceName: "DisbursAPI",
  port: PORT,
});

app.post("/disburse", x402Middleware, async (req, res) => {
  const { complianceResults, cycleId, agentVaultAddress } = req.body;

  if (!complianceResults || !Array.isArray(complianceResults)) {
    return error(res, "Invalid payload - expected complianceResults array");
  }

  if (!cycleId) {
    return error(res, "cycleId is required");
  }

  const eligibleEmployees = complianceResults.filter(
    (r) => r.eligibleForPayment === true || r.status === "CLEARED",
  );
  const flaggedEmployees = complianceResults.filter((r) => r.status === "FLAGGED");

  if (eligibleEmployees.length === 0) {
    return res.status(422).json({
      ok: false,
      error: "No eligible employees after compliance check",
      flaggedCount: flaggedEmployees.length,
      flaggedEmployees: flaggedEmployees.map((e) => ({
        employeeId: e.employeeId,
        wallet: e.wallet,
        reason: e.issues?.map((i) => i.code).join(", ") || "COMPLIANCE_FAILED",
      })),
    });
  }

  console.log(
    `[DisbursAPI] Cycle ${cycleId} - disbursing to ${eligibleEmployees.length} employees ` +
      `(${flaggedEmployees.length} flagged)`,
  );

  try {
    const disbursementResults = await processBatch(eligibleEmployees, cycleId);

    const sent = disbursementResults.filter((r) => r.status === "SENT");
    const failed = disbursementResults.filter((r) => r.status === "FAILED");
    const encryptedTotalRef = computeRosterHash(
      eligibleEmployees.map((e) => ({ id: e.employeeId, wallet: e.wallet })),
    );

    return success(res, {
      service: "GhostPay DisbursAPI v2",
      cycleId,
      agentVaultAddress: agentVaultAddress || null,
      summary: {
        totalEligible: eligibleEmployees.length,
        totalFlagged: flaggedEmployees.length,
        totalDispatched: sent.length,
        totalFailed: failed.length,
        encryptedTotalRef,
        note: "Salary amounts remain encrypted in AgentVault; query on-chain for the FHE ciphertext.",
      },
      disbursements: disbursementResults,
      flagged: flaggedEmployees.map((e) => ({
        employeeId: e.employeeId,
        wallet: e.wallet,
        issues: e.issues?.map((i) => i.code),
      })),
      paymentVerified: req.paymentVerified || false,
      x402: paymentSummary(PAYMENT_AMOUNT, PAYMENT_PRICE),
    });
  } catch (err) {
    console.error("[DisbursAPI] Batch processing error:", err);
    return error(res, `Disbursement failed: ${err.message}`, 500);
  }
});

app.get("/health", (req, res) => {
  return success(res, {
    service: "DisbursAPI",
    status: "online",
    port: PORT,
    x402: true,
    x402Version: 2,
    price: `${PAYMENT_PRICE} USDC per batch disbursement`,
    payTo: SERVICE_WALLET,
    demoMode: process.env.DEMO_MODE !== "false",
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  return success(res, {
    service: "GhostPay DisbursAPI",
    version: "2.0.0",
    description: "Encrypted batch salary disbursement for payroll agents",
    endpoints: {
      "POST /disburse": { payment: `${PAYMENT_PRICE} USDC`, description: "Execute batch disbursement" },
      "GET /health": { payment: "free", description: "Health check" },
    },
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("[DisbursAPI] ---------------------------------------");
  console.log(`[DisbursAPI] Running on  http://localhost:${PORT}`);
  console.log(`[DisbursAPI] Payment:    ${PAYMENT_PRICE} USDC -> ${SERVICE_WALLET.slice(0, 10)}...`);
  console.log(`[DisbursAPI] x402:       v2 (${process.env.DEMO_MODE === "false" ? "live" : "demo"})`);
  console.log("[DisbursAPI] ---------------------------------------");
  console.log("");
});
