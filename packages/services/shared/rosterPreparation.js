import dotenv from "dotenv";
import { createPublicClient, createWalletClient, http, parseUnits } from "viem";
import { sepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/node";
import { replaceRoster } from "../roster-api/rosterStore.js";
import { requireAddress, requireEnv, requirePrivateKey } from "./env.js";

dotenv.config();

const CONFIDENTIAL_PAYROLL_ABI = [
  {
    name: "isActive",
    type: "function",
    inputs: [{ name: "wallet", type: "address" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "addEmployee",
    type: "function",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "encryptedSalary", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "department", type: "string" },
      { name: "jurisdiction", type: "string" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "updateSalary",
    type: "function",
    inputs: [
      { name: "wallet", type: "address" },
      { name: "newEncryptedSalary", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
];

const GHOST_PAYROLL_TOKEN_ABI = [
  {
    name: "fundTreasury",
    type: "function",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [{ name: "encryptedAmountHandle", type: "bytes32" }],
    stateMutability: "nonpayable",
  },
];

function toHexValue(value) {
  if (!value) return value;
  if (typeof value === "string") return value.startsWith("0x") ? value : `0x${value}`;
  if (value instanceof Uint8Array) return `0x${Buffer.from(value).toString("hex")}`;
  if (value instanceof ArrayBuffer) return `0x${Buffer.from(new Uint8Array(value)).toString("hex")}`;
  if (Array.isArray(value)) return `0x${Buffer.from(value).toString("hex")}`;
  return value;
}

export function normalizePlainRoster(payload) {
  const source = Array.isArray(payload) ? payload : payload?.employees || payload?.roster;

  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("Roster must be an array or an object with a non-empty employees array");
  }

  const wallets = new Set();

  return source.map((employee, index) => {
    const id = String(employee.id || `emp-${String(index + 1).padStart(3, "0")}`);
    const wallet = String(employee.wallet || "");
    const salaryUSDC = String(employee.salaryUSDC || employee.salary || "");

    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet)) {
      throw new Error(`Employee ${id} has an invalid wallet address`);
    }

    const walletKey = wallet.toLowerCase();
    if (wallets.has(walletKey)) {
      throw new Error(`Duplicate wallet in roster: ${wallet}`);
    }
    wallets.add(walletKey);

    if (!salaryUSDC || Number(salaryUSDC) <= 0) {
      throw new Error(`Employee ${id} needs a positive salaryUSDC value`);
    }

    return {
      id,
      name: String(employee.name || id),
      wallet,
      salaryUSDC,
      salaryMicro: parseUnits(salaryUSDC, 6),
      department: String(employee.department || "Operations"),
      jurisdiction: String(employee.jurisdiction || "US").toUpperCase(),
      employedSince: String(employee.employedSince || new Date().toISOString().slice(0, 10)),
      active: employee.active !== false,
      level: employee.level ? String(employee.level) : "Employee",
      taxBand: employee.taxBand ? String(employee.taxBand) : "STANDARD",
    };
  });
}

async function encryptUint64(instance, value, contractAddress, userAddress) {
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(BigInt(value));
  const encrypted = await input.encrypt();
  return {
    handle: toHexValue(encrypted.handles[0]),
    proof: toHexValue(encrypted.inputProof),
  };
}

async function writeAndWait(publicClient, walletClient, request) {
  const hash = await walletClient.writeContract(request);
  await publicClient.waitForTransactionReceipt({ hash });
  return hash;
}

export async function prepareEncryptedRoster(payload, options = {}) {
  const log = options.log || (() => {});
  const employees = normalizePlainRoster(payload);
  const account = privateKeyToAccount(requirePrivateKey("DISBURSEMENT_PRIVATE_KEY"));
  const payrollAddress = requireAddress("CONFIDENTIAL_PAYROLL_ADDRESS");
  const tokenAddress = requireAddress("CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS");
  const rpcUrl = requireEnv("SEPOLIA_RPC_URL");

  const publicClient = createPublicClient({
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport: http(rpcUrl),
  });
  const fhe = await createInstance({
    ...SepoliaConfig,
    network: rpcUrl,
  });

  const roster = [];
  const txs = [];
  let totalSalary = 0n;

  log(`Encrypting ${employees.length} payroll records`);

  for (const employee of employees) {
    const encryptedSalary = await encryptUint64(fhe, employee.salaryMicro, payrollAddress, account.address);
    totalSalary += employee.salaryMicro;

    const active = await publicClient.readContract({
      address: payrollAddress,
      abi: CONFIDENTIAL_PAYROLL_ABI,
      functionName: "isActive",
      args: [employee.wallet],
    });

    const hash = await writeAndWait(
      publicClient,
      walletClient,
      active
        ? {
            address: payrollAddress,
            abi: CONFIDENTIAL_PAYROLL_ABI,
            functionName: "updateSalary",
            args: [employee.wallet, encryptedSalary.handle, encryptedSalary.proof],
          }
        : {
            address: payrollAddress,
            abi: CONFIDENTIAL_PAYROLL_ABI,
            functionName: "addEmployee",
            args: [
              employee.wallet,
              encryptedSalary.handle,
              encryptedSalary.proof,
              employee.department,
              employee.jurisdiction,
            ],
          },
    );

    txs.push({
      type: active ? "updateSalary" : "addEmployee",
      employeeId: employee.id,
      wallet: employee.wallet,
      hash,
    });
    log(`${active ? "Updated" : "Registered"} ${employee.id}`);

    roster.push({
      id: employee.id,
      name: employee.name,
      wallet: employee.wallet,
      department: employee.department,
      jurisdiction: employee.jurisdiction,
      employedSince: employee.employedSince,
      active: employee.active,
      level: employee.level,
      taxBand: employee.taxBand,
      encryptedSalary: encryptedSalary.handle,
      paymentCurrency: "gcUSDT",
    });
  }

  const treasuryFunding = options.treasuryFundUSDC
    ? parseUnits(String(options.treasuryFundUSDC), 6)
    : totalSalary;
  const encryptedFunding = await encryptUint64(fhe, treasuryFunding, tokenAddress, account.address);

  const fundHash = await writeAndWait(publicClient, walletClient, {
    address: tokenAddress,
    abi: GHOST_PAYROLL_TOKEN_ABI,
    functionName: "fundTreasury",
    args: [encryptedFunding.handle, encryptedFunding.proof],
  });
  txs.push({ type: "fundTreasury", hash: fundHash });
  log("Funded confidential payroll treasury");

  const summary = replaceRoster({ employees: roster });

  return {
    operator: account.address,
    employeeCount: roster.length,
    roster,
    summary,
    txs,
    tokenAddress,
    payrollAddress,
  };
}
