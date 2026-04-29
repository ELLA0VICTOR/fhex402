const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;

  console.log("═══════════════════════════════════════════════════");
  console.log("  fhex402 Deployment");
  console.log("═══════════════════════════════════════════════════");
  console.log("Network:    ", network);
  console.log("Deployer:   ", deployer.address);
  console.log("Balance:    ", hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)), "ETH");
  console.log("───────────────────────────────────────────────────\n");

  // Agent address — for single-wallet demo use deployer
  const agentAddress = process.env.AGENT_ADDRESS || deployer.address;
  console.log("Agent address:", agentAddress);

  // ── 1. Deploy fhex402Registry ────────────────────────────────────────────
  console.log("\n[1/3] Deploying fhex402Registry...");
  const Registry = await hre.ethers.getContractFactory("fhex402Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  ✓ fhex402Registry:", registryAddress);

  // ── 2. Deploy AgentVault ─────────────────────────────────────────────────
  console.log("\n[2/3] Deploying AgentVault...");
  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const agentVault = await AgentVault.deploy(agentAddress);
  await agentVault.waitForDeployment();
  const agentVaultAddress = await agentVault.getAddress();
  console.log("  ✓ AgentVault:", agentVaultAddress);

  // ── 3. Deploy ConfidentialPayroll ────────────────────────────────────────
  console.log("\n[3/3] Deploying ConfidentialPayroll...");
  const ConfidentialPayroll = await hre.ethers.getContractFactory("ConfidentialPayroll");
  const payroll = await ConfidentialPayroll.deploy(agentVaultAddress);
  await payroll.waitForDeployment();
  const payrollAddress = await payroll.getAddress();
  console.log("  ✓ ConfidentialPayroll:", payrollAddress);

  // ── Output ───────────────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════");
  console.log("  Deployment Complete");
  console.log("═══════════════════════════════════════════════════");
  console.log("\n── Add to packages/frontend/.env ──────────────────");
  console.log(`VITE_AGENT_VAULT_ADDRESS=${agentVaultAddress}`);
  console.log(`VITE_CONFIDENTIAL_PAYROLL_ADDRESS=${payrollAddress}`);
  console.log(`VITE_REGISTRY_ADDRESS=${registryAddress}`);

  if (network !== "hardhat" && network !== "localhost") {
    console.log("\n── Etherscan URLs ──────────────────────────────────");
    console.log(`https://sepolia.etherscan.io/address/${agentVaultAddress}`);
    console.log(`https://sepolia.etherscan.io/address/${payrollAddress}`);
    console.log(`https://sepolia.etherscan.io/address/${registryAddress}`);
  }

  // ── Verify on Etherscan ──────────────────────────────────────────────────
  if (process.env.ETHERSCAN_API_KEY && network === "sepolia") {
    console.log("\n── Verifying on Etherscan ──────────────────────────");
    try {
      await hre.run("verify:verify", {
        address: agentVaultAddress,
        constructorArguments: [agentAddress],
      });
      console.log("  ✓ AgentVault verified");
    } catch (e) {
      console.log("  ✗ AgentVault verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: payrollAddress,
        constructorArguments: [agentVaultAddress],
      });
      console.log("  ✓ ConfidentialPayroll verified");
    } catch (e) {
      console.log("  ✗ ConfidentialPayroll verification failed:", e.message);
    }

    try {
      await hre.run("verify:verify", {
        address: registryAddress,
        constructorArguments: [],
      });
      console.log("  ✓ Registry verified");
    } catch (e) {
      console.log("  ✗ Registry verification failed:", e.message);
    }
  }

  return { agentVaultAddress, payrollAddress, registryAddress };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
