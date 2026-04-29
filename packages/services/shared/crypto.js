import { createHash, randomBytes } from "crypto";

// Generate a deterministic FHE-style ciphertext representation
// In production, these would be actual Zama FHEVM ciphertexts
export function generateEncryptedHex(seed, length = 64) {
  const hash = createHash("sha256").update(seed).digest("hex");
  return "0x" + hash.padEnd(length, randomBytes(length).toString("hex")).slice(0, length);
}

// Generate a realistic-looking FHE ciphertext (matches Zama output format)
export function mockFHECiphertext(value, employeeId) {
  const seed = `fhex402-${employeeId}-${value}-${process.env.CYCLE_SALT || "demo"}`;
  const hash1 = createHash("sha256").update(seed).digest("hex");
  const hash2 = createHash("sha256").update(hash1).digest("hex");
  return "0x" + hash1 + hash2.slice(0, 64);
}

// Compute a cycle hash from roster data
export function computeRosterHash(roster) {
  const data = JSON.stringify(roster.map((e) => ({ id: e.id, wallet: e.wallet })));
  return "0x" + createHash("sha256").update(data).digest("hex");
}

// Generate a simulated tx hash for demo mode
export function demoTxHash(cycleId, employeeId) {
  const seed = `tx-${cycleId}-${employeeId}-${Date.now()}`;
  return "0x" + createHash("sha256").update(seed).digest("hex");
}

// Truncate hex for display
export function truncateHex(hex, chars = 8) {
  if (!hex || hex.length <= chars * 2 + 2) return hex;
  return `${hex.slice(0, chars + 2)}...${hex.slice(-6)}`;
}
