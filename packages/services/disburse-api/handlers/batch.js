import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import { demoTxHash } from "../../shared/crypto.js";

dotenv.config();

// USDC on Sepolia testnet
const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    name: "balanceOf",
    type: "function",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
];

// Process a batch of eligible employees for disbursement
// DEMO_MODE=true: simulates transfers without on-chain txs
// DEMO_MODE=false: fires real USDC transfers on Sepolia
export async function processBatch(eligibleEmployees, cycleId) {
  const isDemoMode = process.env.DEMO_MODE !== "false";

  console.log(
    `[DisbursAPI/batch] Processing ${eligibleEmployees.length} employees — ` +
    `${isDemoMode ? "DEMO" : "LIVE"} mode`
  );

  if (isDemoMode) {
    return simulateBatch(eligibleEmployees, cycleId);
  }

  return await executeBatch(eligibleEmployees, cycleId);
}

// Simulate disbursement (demo mode)
function simulateBatch(eligibleEmployees, cycleId) {
  return eligibleEmployees.map((emp, index) => {
    // Simulate a small delay variance
    const delay = index * 50;

    return {
      employeeId: emp.employeeId,
      wallet: emp.wallet,
      name: emp.name,
      jurisdiction: emp.jurisdiction,
      taxBand: emp.taxBand,
      status: "SENT",
      txHash: demoTxHash(cycleId, emp.employeeId),
      // Salary remains encrypted — we only reference the ciphertext handle
      encryptedAmountRef: emp.encryptedAmountRef || "enc:ref",
      // Note: no plaintext amount is ever returned
      timestamp: new Date(Date.now() + delay).toISOString(),
      gasUsed: "65000",
      blockNumber: null,
      note: "DEMO_MODE — set DEMO_MODE=false for live Sepolia transfers",
    };
  });
}

// Execute real on-chain USDC transfers (production mode)
async function executeBatch(eligibleEmployees, cycleId) {
  if (!process.env.DISBURSEMENT_PRIVATE_KEY) {
    throw new Error("DISBURSEMENT_PRIVATE_KEY not set for live mode");
  }

  const account = privateKeyToAccount(process.env.DISBURSEMENT_PRIVATE_KEY);

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
  });

  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
  });

  const results = [];

  for (const emp of eligibleEmployees) {
    try {
      // NOTE: In a real FHE payroll system, the salary amount is decrypted
      // only at the point of transfer via a secure enclave or threshold scheme.
      // Here we use a placeholder amount for Sepolia demo.
      // Production would use TFHE.decrypt() with proper access controls.
      const DEMO_AMOUNT = parseUnits("0.01", 6); // $0.01 USDC for Sepolia demo

      const hash = await walletClient.writeContract({
        address: USDC_SEPOLIA,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [emp.wallet, DEMO_AMOUNT],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        name: emp.name,
        status: "SENT",
        txHash: hash,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
      });

      console.log(`[DisbursAPI/batch] Sent to ${emp.wallet.slice(0, 10)}... tx: ${hash.slice(0, 10)}...`);
    } catch (err) {
      console.error(`[DisbursAPI/batch] Failed for ${emp.wallet}:`, err.message);
      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        status: "FAILED",
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}
