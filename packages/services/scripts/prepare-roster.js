import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { prepareEncryptedRoster } from "../shared/rosterPreparation.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servicesRoot = path.resolve(__dirname, "..");
const defaultInputPath = path.join(servicesRoot, "roster-api", "data", "roster.plain.local.json");
const inputPath = path.resolve(servicesRoot, process.env.PLAINTEXT_ROSTER_PATH || defaultInputPath);

function readPlainRoster() {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Plain roster file not found: ${inputPath}`);
  }
  return JSON.parse(fs.readFileSync(inputPath, "utf8"));
}

async function main() {
  const payload = readPlainRoster();
  const result = await prepareEncryptedRoster(payload, {
    treasuryFundUSDC: process.env.TREASURY_FUND_USDC || undefined,
    log: (message) => console.log(message),
  });

  for (const tx of result.txs) {
    console.log(`${tx.type}${tx.employeeId ? ` ${tx.employeeId}` : ""}: ${tx.hash}`);
  }

  console.log(`Encrypted roster prepared for ${result.employeeCount} employees`);
  console.log(`RosterAPI source: ${result.summary.source}`);
  console.log("Plain salary values were not written to the RosterAPI file.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
