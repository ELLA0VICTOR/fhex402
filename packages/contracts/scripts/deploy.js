const hre = require("hardhat");
require("dotenv").config();

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = hre.network.name;
  const agentAddress = process.env.AGENT_ADDRESS || deployer.address;

  console.log("===================================================");
  console.log("  fhex402 Deployment");
  console.log("===================================================");
  console.log("Network:  ", network);
  console.log("Deployer: ", deployer.address);
  console.log(
    "Balance:  ",
    hre.ethers.formatEther(await hre.ethers.provider.getBalance(deployer.address)),
    "ETH",
  );
  console.log("Agent:    ", agentAddress);

  console.log("\n[1/4] Deploying fhex402Registry...");
  const Registry = await hre.ethers.getContractFactory("fhex402Registry");
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log("  OK fhex402Registry:", registryAddress);

  console.log("\n[2/4] Deploying AgentVault...");
  const AgentVault = await hre.ethers.getContractFactory("AgentVault");
  const agentVault = await AgentVault.deploy(agentAddress);
  await agentVault.waitForDeployment();
  const agentVaultAddress = await agentVault.getAddress();
  console.log("  OK AgentVault:", agentVaultAddress);

  console.log("\n[3/4] Deploying GhostPayrollToken...");
  const GhostPayrollToken = await hre.ethers.getContractFactory("GhostPayrollToken");
  const payrollToken = await GhostPayrollToken.deploy(agentAddress);
  await payrollToken.waitForDeployment();
  const payrollTokenAddress = await payrollToken.getAddress();
  console.log("  OK GhostPayrollToken:", payrollTokenAddress);

  console.log("\n[4/4] Deploying ConfidentialPayroll...");
  const ConfidentialPayroll = await hre.ethers.getContractFactory("ConfidentialPayroll");
  const payroll = await ConfidentialPayroll.deploy(agentVaultAddress, agentAddress);
  await payroll.waitForDeployment();
  const payrollAddress = await payroll.getAddress();
  console.log("  OK ConfidentialPayroll:", payrollAddress);

  console.log("\nConfiguring confidential settlement...");
  await (await payrollToken.setPayrollContract(payrollAddress)).wait();
  await (await payroll.setSettlementToken(payrollTokenAddress)).wait();
  console.log("  OK Payroll token linked to ConfidentialPayroll");

  console.log("\n===================================================");
  console.log("  Deployment Complete");
  console.log("===================================================");
  console.log("\nAdd to packages/frontend/.env:");
  console.log(`VITE_AGENT_VAULT_ADDRESS=${agentVaultAddress}`);
  console.log(`VITE_CONFIDENTIAL_PAYROLL_ADDRESS=${payrollAddress}`);
  console.log(`VITE_CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS=${payrollTokenAddress}`);
  console.log(`VITE_REGISTRY_ADDRESS=${registryAddress}`);

  console.log("\nAdd to packages/services/.env:");
  console.log(`AGENT_VAULT_ADDRESS=${agentVaultAddress}`);
  console.log(`CONFIDENTIAL_PAYROLL_ADDRESS=${payrollAddress}`);
  console.log(`CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS=${payrollTokenAddress}`);

  if (network !== "hardhat" && network !== "localhost") {
    console.log("\nSepolia URLs:");
    console.log(`https://sepolia.etherscan.io/address/${agentVaultAddress}`);
    console.log(`https://sepolia.etherscan.io/address/${payrollAddress}`);
    console.log(`https://sepolia.etherscan.io/address/${payrollTokenAddress}`);
    console.log(`https://sepolia.etherscan.io/address/${registryAddress}`);
  }

  if (process.env.ETHERSCAN_API_KEY && network === "sepolia") {
    console.log("\nVerifying on Etherscan...");
    const verifyTargets = [
      ["AgentVault", agentVaultAddress, [agentAddress]],
      ["GhostPayrollToken", payrollTokenAddress, [agentAddress]],
      ["ConfidentialPayroll", payrollAddress, [agentVaultAddress, agentAddress]],
      ["fhex402Registry", registryAddress, []],
    ];

    for (const [name, address, constructorArguments] of verifyTargets) {
      try {
        await hre.run("verify:verify", { address, constructorArguments });
        console.log(`  OK ${name} verified`);
      } catch (e) {
        console.log(`  ${name} verification failed: ${e.message}`);
      }
    }
  }

  return {
    agentVaultAddress,
    payrollAddress,
    payrollTokenAddress,
    registryAddress,
  };
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
