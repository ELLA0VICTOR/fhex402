import { createPublicClient, createWalletClient, formatUnits, http, isAddress, parseUnits } from "viem";
import { baseSepolia, sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import dotenv from "dotenv";
import { demoTxHash } from "../../shared/crypto.js";
import { requireAddress, requirePrivateKey, requireEnv } from "../../shared/env.js";

dotenv.config();

const CONFIDENTIAL_PAYROLL_ABI = [
  {
    name: "settleEmployee",
    type: "function",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "cycleId", type: "uint256" },
    ],
    outputs: [{ name: "encryptedAmountHandle", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
];

const DISBURSEMENT_NETWORKS = {
  "eip155:84532": {
    label: "Base Sepolia",
    chain: baseSepolia,
    rpcEnv: "BASE_SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://sepolia.base.org",
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    explorerTxBase: "https://base-sepolia.blockscout.com/tx/",
  },
  "base-sepolia": {
    aliasOf: "eip155:84532",
  },
  "eip155:11155111": {
    label: "Ethereum Sepolia",
    chain: sepolia,
    rpcEnv: "SEPOLIA_RPC_URL",
    defaultRpcUrl: "https://rpc.sepolia.org",
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    explorerTxBase: "https://sepolia.etherscan.io/tx/",
  },
  "ethereum-sepolia": {
    aliasOf: "eip155:11155111",
  },
  sepolia: {
    aliasOf: "eip155:11155111",
  },
};

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

function optionalAddress(value) {
  return value && isAddress(value) ? value : null;
}

function disbursementMode() {
  return (process.env.DISBURSEMENT_MODE || "confidential_token").trim();
}

function resolvePublicUsdcNetwork() {
  const requestedNetwork = (process.env.DISBURSEMENT_NETWORK || "eip155:84532").trim();
  const entry = DISBURSEMENT_NETWORKS[requestedNetwork];
  const networkKey = entry?.aliasOf || requestedNetwork;
  const config = DISBURSEMENT_NETWORKS[networkKey];

  if (!config || config.aliasOf) {
    throw new Error(
      `Unsupported DISBURSEMENT_NETWORK "${requestedNetwork}". Use eip155:84532 for Base Sepolia or eip155:11155111 for Ethereum Sepolia.`,
    );
  }

  const rpcUrl =
    process.env.DISBURSEMENT_RPC_URL?.trim() ||
    process.env[config.rpcEnv]?.trim() ||
    config.defaultRpcUrl;
  const usdcAddress = process.env.DISBURSEMENT_USDC_ADDRESS?.trim() || config.usdcAddress;

  if (!isAddress(usdcAddress)) {
    throw new Error("DISBURSEMENT_USDC_ADDRESS must be a 0x-prefixed EVM address");
  }

  return {
    ...config,
    network: networkKey,
    rpcUrl,
    usdcAddress,
  };
}

function confidentialRuntime() {
  const payrollAddress = optionalAddress(process.env.CONFIDENTIAL_PAYROLL_ADDRESS);
  const tokenAddress = optionalAddress(process.env.CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS);

  return {
    mode: "confidential_token",
    network: "eip155:11155111",
    label: "Zama confidential payroll token",
    chain: "Ethereum Sepolia",
    chainId: sepolia.id,
    tokenSymbol: "gcUSDT",
    tokenAddress,
    payrollAddress,
    configured: Boolean(payrollAddress && tokenAddress),
    explorerTxBase: "https://sepolia.etherscan.io/tx/",
  };
}

export function getDisbursementRuntime() {
  if (disbursementMode() === "public_usdc") {
    const config = resolvePublicUsdcNetwork();
    return {
      mode: "public_usdc",
      network: config.network,
      label: `${config.label} public USDC`,
      chain: config.label,
      chainId: config.chain.id,
      tokenSymbol: "USDC",
      tokenAddress: config.usdcAddress,
      usdcAddress: config.usdcAddress,
      explorerTxBase: config.explorerTxBase,
      transferAmountUSDC: process.env.DISBURSEMENT_AMOUNT_USDC || null,
      configured: true,
    };
  }

  return confidentialRuntime();
}

export async function processBatch(eligibleEmployees, cycleId) {
  const isDemoMode = process.env.DEMO_MODE !== "false";
  const runtime = getDisbursementRuntime();

  console.log(
    `[DisbursAPI/batch] Processing ${eligibleEmployees.length} employees via ${runtime.label} - ` +
      `${isDemoMode ? "DEMO" : "LIVE"} mode`,
  );

  if (isDemoMode) {
    return simulateBatch(eligibleEmployees, cycleId, runtime);
  }

  if (runtime.mode === "public_usdc") {
    return executePublicUsdcBatch(eligibleEmployees, cycleId, runtime);
  }

  return executeConfidentialTokenBatch(eligibleEmployees, cycleId, runtime);
}

function simulateBatch(eligibleEmployees, cycleId, runtime) {
  return eligibleEmployees.map((emp, index) => {
    const delay = index * 50;
    const encryptedAmountRef = emp.encryptedAmountRef || emp.encryptedSalary || "enc:ref";

    return {
      employeeId: emp.employeeId,
      wallet: emp.wallet,
      name: emp.name,
      jurisdiction: emp.jurisdiction,
      taxBand: emp.taxBand,
      status: "SENT",
      txHash: demoTxHash(cycleId, emp.employeeId),
      txUrl: null,
      encryptedAmountRef,
      settlement: runtime.mode,
      network: runtime.network,
      chain: runtime.chain,
      tokenSymbol: runtime.tokenSymbol,
      tokenAddress: runtime.tokenAddress,
      timestamp: new Date(Date.now() + delay).toISOString(),
      gasUsed: "65000",
      blockNumber: null,
      note: `DEMO_MODE=true; set DEMO_MODE=false for live ${runtime.label} settlement`,
    };
  });
}

async function executeConfidentialTokenBatch(eligibleEmployees, cycleId, runtime) {
  if (!runtime.configured) {
    throw new Error(
      "CONFIDENTIAL_PAYROLL_ADDRESS and CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS are required for confidential token settlement",
    );
  }

  const account = privateKeyToAccount(requirePrivateKey("DISBURSEMENT_PRIVATE_KEY"));
  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(requireEnv("SEPOLIA_RPC_URL")),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(requireEnv("SEPOLIA_RPC_URL")),
  });

  const results = [];

  for (const emp of eligibleEmployees) {
    try {
      const hash = await walletClient.writeContract({
        address: requireAddress("CONFIDENTIAL_PAYROLL_ADDRESS"),
        abi: CONFIDENTIAL_PAYROLL_ABI,
        functionName: "settleEmployee",
        args: [emp.wallet, BigInt(cycleId)],
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const encryptedAmountRef = emp.encryptedAmountRef || emp.encryptedSalary || null;

      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        name: emp.name,
        status: "SENT",
        txHash: hash,
        txUrl: `${runtime.explorerTxBase}${hash}`,
        encryptedAmountRef,
        settlement: runtime.mode,
        network: runtime.network,
        chain: runtime.chain,
        tokenSymbol: runtime.tokenSymbol,
        tokenAddress: runtime.tokenAddress,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
        note: "Confidential salary token transfer; amount remains encrypted on-chain.",
      });

      console.log(
        `[DisbursAPI/batch] Settled encrypted payroll token to ${emp.wallet.slice(0, 10)}... tx: ${hash.slice(0, 10)}...`,
      );
    } catch (err) {
      console.error(`[DisbursAPI/batch] Confidential settlement failed for ${emp.wallet}:`, err.message);
      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        status: "FAILED",
        settlement: runtime.mode,
        network: runtime.network,
        chain: runtime.chain,
        tokenSymbol: runtime.tokenSymbol,
        tokenAddress: runtime.tokenAddress,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}

async function executePublicUsdcBatch(eligibleEmployees, cycleId, runtime) {
  const config = resolvePublicUsdcNetwork();
  const account = privateKeyToAccount(requirePrivateKey("DISBURSEMENT_PRIVATE_KEY"));
  const amount = parseUnits(requireEnv("DISBURSEMENT_AMOUNT_USDC"), 6);

  const publicClient = createPublicClient({
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });

  const requiredBalance = amount * BigInt(eligibleEmployees.length);
  const currentBalance = await publicClient.readContract({
    address: runtime.usdcAddress,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: [account.address],
  });

  if (currentBalance < requiredBalance) {
    throw new Error(
      `Insufficient ${runtime.chain} USDC for batch. Needed ${formatUnits(requiredBalance, 6)}, wallet has ${formatUnits(currentBalance, 6)}.`,
    );
  }

  const results = [];

  for (const emp of eligibleEmployees) {
    try {
      const hash = await walletClient.writeContract({
        address: runtime.usdcAddress,
        abi: USDC_ABI,
        functionName: "transfer",
        args: [emp.wallet, amount],
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        name: emp.name,
        status: "SENT",
        txHash: hash,
        txUrl: `${runtime.explorerTxBase}${hash}`,
        settlement: runtime.mode,
        network: runtime.network,
        chain: runtime.chain,
        tokenSymbol: "USDC",
        tokenAddress: runtime.usdcAddress,
        blockNumber: receipt.blockNumber.toString(),
        gasUsed: receipt.gasUsed.toString(),
        timestamp: new Date().toISOString(),
        note: "Public USDC fallback; amount is visible on-chain.",
      });
    } catch (err) {
      results.push({
        employeeId: emp.employeeId,
        wallet: emp.wallet,
        status: "FAILED",
        settlement: runtime.mode,
        network: runtime.network,
        chain: runtime.chain,
        error: err.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}
