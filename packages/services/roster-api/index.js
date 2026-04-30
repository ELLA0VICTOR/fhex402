import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { getActiveRoster, getRosterSummary, replaceRoster } from "./rosterStore.js";
import {
  createX402Middleware,
  error,
  paymentSummary,
  requestLogger,
  success,
} from "../shared/middleware.js";
import { computeRosterHash } from "../shared/crypto.js";
import { isLiveMode, requireAddress } from "../shared/env.js";

dotenv.config();

const app = express();
const PORT = 3001;
const SERVICE_WALLET = isLiveMode()
  ? requireAddress("ROSTER_WALLET_ADDRESS")
  : process.env.ROSTER_WALLET_ADDRESS || "0x0000000000000000000000000000000000000001";
const PAYMENT_AMOUNT = "1000";
const PAYMENT_PRICE = "$0.001";
const ADMIN_TOKEN = process.env.ROSTER_ADMIN_TOKEN;

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(requestLogger("RosterAPI"));

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) {
    return error(res, "ROSTER_ADMIN_TOKEN is not configured", 503);
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-admin-token"];
  if (token !== ADMIN_TOKEN) {
    return error(res, "Unauthorized roster administration request", 401);
  }

  next();
}

const x402Middleware = createX402Middleware({
  method: "GET",
  path: "/roster",
  price: PAYMENT_PRICE,
  payTo: SERVICE_WALLET,
  description: "GhostPay RosterAPI - encrypted employee roster fetch",
  serviceName: "RosterAPI",
  port: PORT,
});

app.get("/roster", x402Middleware, (req, res) => {
  const activeEmployees = getActiveRoster();

  if (activeEmployees.length === 0) {
    return error(res, "No active employees configured in RosterAPI", 404);
  }

  const roster = activeEmployees.map((emp) => ({
    id: emp.id,
    name: emp.name,
    wallet: emp.wallet,
    department: emp.department,
    jurisdiction: emp.jurisdiction,
    employedSince: emp.employedSince,
    active: emp.active,
    level: emp.level,
    encryptedSalary: emp.encryptedSalary,
    taxBand: emp.taxBand,
    paymentCurrency: emp.paymentCurrency || "gcUSDT",
  }));

  const rosterHash = computeRosterHash(roster);

  return success(res, {
    service: "GhostPay RosterAPI v2",
    cycleDate: new Date().toISOString(),
    employeeCount: roster.length,
    roster,
    rosterHash,
    paymentVerified: req.paymentVerified || false,
    x402: paymentSummary(PAYMENT_AMOUNT, PAYMENT_PRICE),
  });
});

app.get("/health", (req, res) => {
  const summary = getRosterSummary();
  return success(res, {
    service: "RosterAPI",
    status: summary.configured ? "online" : "needs_roster",
    port: PORT,
    x402: true,
    x402Version: 2,
    price: `${PAYMENT_PRICE} USDC per request`,
    payTo: SERVICE_WALLET,
    employeeCount: summary.activeEmployees,
    departments: summary.departments,
    jurisdictions: summary.jurisdictions,
    rosterConfigured: summary.configured,
    rosterSource: summary.source,
    uptime: process.uptime(),
  });
});

app.get("/summary", (req, res) => {
  return success(res, {
    service: "GhostPay RosterAPI",
    summary: getRosterSummary(),
  });
});

app.put("/admin/roster", requireAdmin, (req, res) => {
  try {
    const summary = replaceRoster(req.body);
    return success(res, {
      service: "GhostPay RosterAPI",
      summary,
    });
  } catch (err) {
    return error(res, err.message, 400);
  }
});

app.get("/", (req, res) => {
  return success(res, {
    service: "GhostPay RosterAPI",
    version: "2.0.0",
    description: "Encrypted employee roster for payroll agents",
    endpoints: {
      "GET /roster": { payment: `${PAYMENT_PRICE} USDC`, description: "Fetch encrypted roster" },
      "GET /summary": { payment: "free", description: "Roster readiness summary" },
      "PUT /admin/roster": { payment: "free", description: "Replace encrypted roster using admin token" },
      "GET /health": { payment: "free", description: "Health check" },
    },
  });
});

app.listen(PORT, () => {
  const summary = getRosterSummary();
  console.log("");
  console.log("[RosterAPI] ----------------------------------------");
  console.log(`[RosterAPI] Running on  http://localhost:${PORT}`);
  console.log(`[RosterAPI] Payment:    ${PAYMENT_PRICE} USDC -> ${SERVICE_WALLET.slice(0, 10)}...`);
  console.log(`[RosterAPI] Employees:  ${summary.activeEmployees} active`);
  console.log(`[RosterAPI] x402:       v2 (${process.env.DEMO_MODE === "false" ? "live" : "demo"})`);
  console.log("[RosterAPI] ----------------------------------------");
  console.log("");
});
