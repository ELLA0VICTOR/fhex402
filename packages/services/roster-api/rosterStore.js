import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { computeRosterHash } from "../shared/crypto.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVICES_ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(SERVICES_ROOT, ".env") });

const DEFAULT_ROSTER_PATH = path.join(__dirname, "data", "roster.local.json");
const ROSTER_DATA_PATH = resolveRosterPath(process.env.ROSTER_DATA_PATH);

let employees = [];

function resolveRosterPath(value) {
  if (!value) return DEFAULT_ROSTER_PATH;
  return path.isAbsolute(value) ? value : path.resolve(SERVICES_ROOT, value);
}

function normalizeEmployee(employee, index) {
  const id = String(employee.id || `emp-${String(index + 1).padStart(3, "0")}`);
  const wallet = String(employee.wallet || "");
  const encryptedSalary = String(employee.encryptedSalary || employee.encryptedSalaryHandle || "");

  if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
    throw new Error(`Roster employee ${id} has an invalid wallet address`);
  }

  if (!/^0x[0-9a-fA-F]{32,}$/.test(encryptedSalary)) {
    throw new Error(`Roster employee ${id} is missing an encryptedSalary ciphertext handle`);
  }

  return {
    id,
    name: String(employee.name || id),
    wallet,
    department: String(employee.department || "Operations"),
    jurisdiction: String(employee.jurisdiction || "US").toUpperCase(),
    employedSince: String(employee.employedSince || new Date().toISOString().slice(0, 10)),
    active: employee.active !== false,
    level: employee.level ? String(employee.level) : "Employee",
    encryptedSalary,
    taxBand: employee.taxBand ? String(employee.taxBand) : "STANDARD",
    paymentCurrency: employee.paymentCurrency ? String(employee.paymentCurrency) : "gcUSDT",
  };
}

function normalizeRoster(input) {
  const source = Array.isArray(input) ? input : input?.employees || input?.roster;
  if (!Array.isArray(source)) {
    throw new Error("Roster payload must be an array or an object with employees/roster");
  }

  const normalized = source.map(normalizeEmployee);
  const wallets = new Set();

  for (const employee of normalized) {
    const wallet = employee.wallet.toLowerCase();
    if (wallets.has(wallet)) {
      throw new Error(`Duplicate employee wallet in roster: ${employee.wallet}`);
    }
    wallets.add(wallet);
  }

  return normalized;
}

export function loadRoster() {
  if (!fs.existsSync(ROSTER_DATA_PATH)) {
    employees = [];
    return employees;
  }

  const raw = fs.readFileSync(ROSTER_DATA_PATH, "utf8");
  employees = normalizeRoster(JSON.parse(raw));
  return employees;
}

export function replaceRoster(payload, { persist = true } = {}) {
  const normalized = normalizeRoster(payload);
  employees = normalized;

  if (persist) {
    fs.mkdirSync(path.dirname(ROSTER_DATA_PATH), { recursive: true });
    fs.writeFileSync(ROSTER_DATA_PATH, `${JSON.stringify({ employees: normalized }, null, 2)}\n`);
  }

  return getRosterSummary();
}

export function getActiveRoster() {
  return loadRoster().filter((employee) => employee.active);
}

export function getRosterSummary() {
  const all = loadRoster();
  const active = all.filter((employee) => employee.active);

  return {
    source: ROSTER_DATA_PATH,
    totalEmployees: all.length,
    activeEmployees: active.length,
    departments: [...new Set(active.map((employee) => employee.department))],
    jurisdictions: [...new Set(active.map((employee) => employee.jurisdiction))],
    rosterHash: computeRosterHash(active),
    configured: active.length > 0,
  };
}

export function getRosterPath() {
  return ROSTER_DATA_PATH;
}
