import { createHash } from "crypto";

// Compute a cycle hash from roster data
export function computeRosterHash(roster) {
  const data = JSON.stringify(roster.map((e) => ({ id: e.id, wallet: e.wallet })));
  return "0x" + createHash("sha256").update(data).digest("hex");
}

export function demoTxHash(cycleId, employeeId) {
  const seed = `tx-${cycleId}-${employeeId}-${Date.now()}`;
  return "0x" + createHash("sha256").update(seed).digest("hex");
}

// Truncate hex for display
export function truncateHex(hex, chars = 8) {
  if (!hex || hex.length <= chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-6)}`;
}
