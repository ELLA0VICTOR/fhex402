// fhex402 Compliance Rule Engine
// In production: integrates with real KYC/AML providers (Chainalysis, Elliptic, etc.)
// For demo: deterministic rule engine with realistic compliance logic

const SANCTIONED_JURISDICTIONS = new Set(["KP", "IR", "SY", "CU", "RU", "BY"]);
const HIGH_RISK_JURISDICTIONS = new Set(["AF", "SO", "SS", "VE", "MM"]);
const TAX_EXEMPT_JURISDICTIONS = new Set(["AE", "QA", "BH", "KW", "OM"]);

// Tax band lookup by jurisdiction
const TAX_BANDS = {
  US: "W-2",
  GB: "PAYE",
  DE: "LOHNSTEUER",
  FR: "IR",
  JP: "JP-RESIDENT",
  SG: "SG-RESIDENT",
  NG: "PITA",
  GH: "GH-TAX",
  KE: "KE-PAYE",
  ZA: "ZA-PAYE",
  AE: "TAX_EXEMPT",
  QA: "TAX_EXEMPT",
  CA: "T4",
  AU: "TFN",
  IN: "TDS",
  BR: "CPF",
  MX: "RFC",
  AR: "AFIP",
};

export function runComplianceCheck(employee) {
  const issues = [];
  let riskScore = 0;

  // ─── Rule 1: Sanctioned Jurisdiction ──────────────────────────────────────
  if (SANCTIONED_JURISDICTIONS.has(employee.jurisdiction)) {
    issues.push({
      code: "SANCTIONED_JURISDICTION",
      severity: "CRITICAL",
      detail: `Jurisdiction ${employee.jurisdiction} is sanctioned — payment blocked`,
    });
    riskScore += 100;
  }

  // ─── Rule 2: High Risk Jurisdiction ───────────────────────────────────────
  if (HIGH_RISK_JURISDICTIONS.has(employee.jurisdiction)) {
    issues.push({
      code: "HIGH_RISK_JURISDICTION",
      severity: "WARNING",
      detail: `Jurisdiction ${employee.jurisdiction} flagged for elevated monitoring`,
    });
    riskScore += 30;
  }

  // ─── Rule 3: Employment Tenure ────────────────────────────────────────────
  const employedDays = Math.floor(
    (Date.now() - new Date(employee.employedSince).getTime()) / (1000 * 60 * 60 * 24)
  );
  if (employedDays < 30) {
    issues.push({
      code: "PROBATION_PERIOD",
      severity: "WARNING",
      detail: `Employee in probation (${employedDays} days employed, 30 required)`,
    });
    riskScore += 20;
  }

  // ─── Rule 4: Wallet Address Validation ────────────────────────────────────
  if (!employee.wallet || !/^0x[0-9a-fA-F]{40}$/.test(employee.wallet)) {
    issues.push({
      code: "INVALID_WALLET",
      severity: "CRITICAL",
      detail: "Employee wallet address is missing or malformed",
    });
    riskScore += 100;
  }

  // ─── Rule 5: Active Status ────────────────────────────────────────────────
  if (employee.active === false) {
    issues.push({
      code: "INACTIVE_EMPLOYEE",
      severity: "CRITICAL",
      detail: "Employee is marked inactive — skip disbursement",
    });
    riskScore += 100;
  }

  // ─── Rule 6: Duplicate Wallet Check ──────────────────────────────────────
  // In production: check against full roster for wallet uniqueness
  // Here we flag known zero address
  if (employee.wallet === "0x0000000000000000000000000000000000000000") {
    issues.push({
      code: "ZERO_ADDRESS",
      severity: "CRITICAL",
      detail: "Wallet is the zero address",
    });
    riskScore += 100;
  }

  // ─── Derive Final Status ──────────────────────────────────────────────────
  const criticalIssues = issues.filter((i) => i.severity === "CRITICAL");
  const status = criticalIssues.length > 0 ? "FLAGGED" : "CLEARED";

  const taxBand = TAX_BANDS[employee.jurisdiction] || "STANDARD";
  const taxExempt = TAX_EXEMPT_JURISDICTIONS.has(employee.jurisdiction);

  // Risk level categorization
  let riskLevel = "LOW";
  if (riskScore >= 100) riskLevel = "CRITICAL";
  else if (riskScore >= 30) riskLevel = "MEDIUM";

  return {
    employeeId: employee.id,
    wallet: employee.wallet,
    name: employee.name,
    status,
    riskScore,
    riskLevel,
    taxBand,
    taxExempt,
    jurisdiction: employee.jurisdiction,
    encryptedSalary: employee.encryptedSalary,
    encryptedAmountRef: employee.encryptedSalary,
    employedDays,
    issues,
    criticalCount: criticalIssues.length,
    warningCount: issues.filter((i) => i.severity === "WARNING").length,
    checkedAt: new Date().toISOString(),
    complianceVersion: "v1.2.0",
    // Flag for disbursement layer
    eligibleForPayment: status === "CLEARED",
  };
}

// Batch compliance check with aggregate stats
export function runBatchComplianceCheck(roster) {
  const results = roster.map(runComplianceCheck);

  const summary = {
    total: results.length,
    cleared: results.filter((r) => r.status === "CLEARED").length,
    flagged: results.filter((r) => r.status === "FLAGGED").length,
    highRisk: results.filter((r) => r.riskLevel === "MEDIUM" || r.riskLevel === "CRITICAL").length,
    allCleared: results.every((r) => r.status === "CLEARED"),
    jurisdictions: [...new Set(results.map((r) => r.jurisdiction))],
    taxBands: [...new Set(results.map((r) => r.taxBand))],
  };

  return { results, summary };
}
