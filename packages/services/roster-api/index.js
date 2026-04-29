import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { employees } from "./data/employees.js";
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
const PORT = 3001;
const SERVICE_WALLET =
  process.env.ROSTER_WALLET_ADDRESS || "0x0000000000000000000000000000000000000001";
const PAYMENT_AMOUNT = "100000";
const PAYMENT_PRICE = "$0.10";

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(requestLogger("RosterAPI"));

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
  const activeEmployees = employees.filter((e) => e.active);

  if (activeEmployees.length === 0) {
    return error(res, "No active employees in roster", 404);
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
    paymentCurrency: "USDC",
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
  return success(res, {
    service: "RosterAPI",
    status: "online",
    port: PORT,
    x402: true,
    x402Version: 2,
    price: `${PAYMENT_PRICE} USDC per request`,
    payTo: SERVICE_WALLET,
    employeeCount: employees.filter((e) => e.active).length,
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  return success(res, {
    service: "GhostPay RosterAPI",
    version: "2.0.0",
    description: "Encrypted employee roster for payroll agents",
    endpoints: {
      "GET /roster": { payment: `${PAYMENT_PRICE} USDC`, description: "Fetch encrypted roster" },
      "GET /health": { payment: "free", description: "Health check" },
    },
  });
});

app.listen(PORT, () => {
  console.log("");
  console.log("[RosterAPI] ----------------------------------------");
  console.log(`[RosterAPI] Running on  http://localhost:${PORT}`);
  console.log(`[RosterAPI] Payment:    ${PAYMENT_PRICE} USDC -> ${SERVICE_WALLET.slice(0, 10)}...`);
  console.log(`[RosterAPI] Employees:  ${employees.filter((e) => e.active).length} active`);
  console.log(`[RosterAPI] x402:       v2 (${process.env.DEMO_MODE === "false" ? "live" : "demo"})`);
  console.log("[RosterAPI] ----------------------------------------");
  console.log("");
});
