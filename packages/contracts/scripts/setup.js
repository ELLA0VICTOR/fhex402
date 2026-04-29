const hre = require("hardhat");
require("dotenv").config();

// Demo employee data matching services/roster-api/data/employees.js
const DEMO_EMPLOYEES = [
  { name: "Amara Okonkwo",   wallet: "0x742d35Cc6634C0532925a3b8D4C9b1A5AE6D7890", dept: "Engineering", jurisdiction: "NG" },
  { name: "Kofi Mensah",     wallet: "0x8Ba1f109551bD432803012645Ac136ddd64DBA72", dept: "Product",      jurisdiction: "GH" },
  { name: "Fatima Al-Hassan",wallet: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec", dept: "Design",       jurisdiction: "AE" },
  { name: "Marcus Veltri",   wallet: "0x4dBa88e9dc5D4ee56f4aBdC6cF2e0CA1d8bE3F2", dept: "Operations",   jurisdiction: "US" },
  { name: "Yuki Tanaka",     wallet: "0x5eCb99f0EA1e7dF65bcCd8E3Abc2F0d9C7aE4B1", dept: "Engineering",  jurisdiction: "JP" },
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const agentVaultAddress = process.env.VITE_AGENT_VAULT_ADDRESS;
  const payrollAddress = process.env.VITE_CONFIDENTIAL_PAYROLL_ADDRESS;

  if (!agentVaultAddress || !payrollAddress) {
    throw new Error("Set VITE_AGENT_VAULT_ADDRESS and VITE_CONFIDENTIAL_PAYROLL_ADDRESS in .env");
  }

  console.log("fhex402 Demo Setup");
  console.log("AgentVault:", agentVaultAddress);
  console.log("ConfidentialPayroll:", payrollAddress);
  console.log("Deployer:", deployer.address);

  const AgentVault = await hre.ethers.getContractAt("AgentVault", agentVaultAddress);
  const Payroll = await hre.ethers.getContractAt("ConfidentialPayroll", payrollAddress);

  console.log("\nNote: In production, depositBudget() and addEmployee() require");
  console.log("FHEVM-encrypted inputs. For demo, use the frontend UI to:");
  console.log("  1. Connect MetaMask on Sepolia");
  console.log("  2. Click 'Deposit Budget' and enter your encrypted amount");
  console.log("  3. Add employees via ConfidentialPayroll");
  console.log("  4. Click 'Run Payroll Cycle'");

  console.log("\nSetup script complete — use the frontend for encrypted interactions.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
