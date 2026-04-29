import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { runBatchComplianceCheck } from "./rules/compliance.js";
import {
  createX402Middleware,
  error,
  paymentSummary,
  requestLogger,
  success,
} from "../shared/middleware.js";

dotenv.config();

const app = express();
const PORT = 3002;
const SERVICE_WALLET =
  process.env.COMPLIANCE_WALLET_ADDRESS || "0x0000000000000000000000000000000000000002";
const PAYMENT_AMOUNT = "250000";
const PAYMENT_PRICE = "$0.25";

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(requestLogger("ComplianceAPI"));

const x402Middleware = createX402Middleware({
  method: "POST",
  path: "/check",
  price: PAYMENT_PRICE,
  payTo: SERVICE_WALLET,
  description: "GhostPay ComplianceAPI - jurisdiction and eligibility validation batch",
  serviceName: "ComplianceAPI",
  port: PORT,
});

app.post("/check", x402Middleware, (req, res) => {
  const { roster, cycleId } = req.body;

  if (!roster || !Array.isArray(roster)) {
    return error(res, "Invalid roster payload - expected array of employee objects");
  }

  if (roster.length === 0) {
    return error(res, "Empty roster - nothing to check");
  }

  if (roster.length > 100) {
    return error(res, "Roster too large - max 100 employees per batch", 413);
  }

  const { results, summary } = runBatchComplianceCheck(roster);

  console.log(
    `[ComplianceAPI] Checked ${results.length} employees - ` +
      `${summary.cleared} CLEARED, ${summary.flagged} FLAGGED`,
  );

  return success(res, {
    service: "GhostPay ComplianceAPI v2",
    cycleId: cycleId || "unspecified",
    summary,
    results,
    paymentVerified: req.paymentVerified || false,
    x402: paymentSummary(PAYMENT_AMOUNT, PAYMENT_PRICE),
  });
});

app.get("/health", (req, res) => {
  return success(res, {
    service: "ComplianceAPI",
    status: "online",
    port: PORT,
    x402: true,
    x402Version: 2,
    price: `${PAYMENT_PRICE} USDC per batch`,
    payTo: SERVICE_WALLET,
    rulesVersion: "v1.2.0",
    supportedJurisdictions: ["US", "GB", "NG", "GH", "AE", "JP", "SG", "CA", "AU", "IN", "DE", "FR", "BR"],
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  return success(res, {
    service: "GhostPay ComplianceAPI",
    version: "2.0.0",
    description: "Jurisdiction, eligibility and tax band validation for payroll agents",
    endpoints: {
      "POST /check": { payment: `${PAYMENT_PRICE} USDC`, description: "Batch compliance check" },
      "GET /health": { payment: "free", description: "Health check" },
    },
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("[ComplianceAPI] ------------------------------------");
  console.log(`[ComplianceAPI] Running on  http://localhost:${PORT}`);
  console.log(`[ComplianceAPI] Payment:    ${PAYMENT_PRICE} USDC -> ${SERVICE_WALLET.slice(0, 10)}...`);
  console.log("[ComplianceAPI] Rules:      v1.2.0");
  console.log(`[ComplianceAPI] x402:       v2 (${process.env.DEMO_MODE === "false" ? "live" : "demo"})`);
  console.log("[ComplianceAPI] ------------------------------------");
  console.log("");
});
