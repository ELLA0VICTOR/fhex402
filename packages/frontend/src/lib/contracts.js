// Contract ABIs are defined inline to avoid build-time artifact dependency.
// After `hardhat compile`, you can also import from:
// ../../contracts/artifacts/contracts/AgentVault.sol/AgentVault.json

export const AGENT_VAULT_ABI = [
  { name: "owner", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "agent", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "agentActive", type: "function", inputs: [], outputs: [{ type: "bool" }], stateMutability: "view" },
  { name: "cycleCount", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "lastDecryptedBudget", type: "function", inputs: [], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { name: "lastDecryptedSpent", type: "function", inputs: [], outputs: [{ type: "uint64" }], stateMutability: "view" },
  { name: "getEncryptedBudget", type: "function", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  { name: "getEncryptedSpent", type: "function", inputs: [], outputs: [{ type: "bytes32" }], stateMutability: "view" },
  {
    name: "depositBudget",
    type: "function",
    inputs: [
      { name: "encryptedAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "authorizeServicePayment",
    type: "function",
    inputs: [
      { name: "encryptedPaymentAmount", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
      { name: "cycleId", type: "uint256" },
      { name: "serviceId", type: "uint8" },
    ],
    outputs: [{ type: "bytes32" }],
    stateMutability: "nonpayable",
  },
  {
    name: "startCycle",
    type: "function",
    inputs: [{ name: "rosterHash", type: "bytes32" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "nonpayable",
  },
  {
    name: "completeCycle",
    type: "function",
    inputs: [
      { name: "cycleId", type: "uint256" },
      { name: "encryptedTotal", type: "bytes32" },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "requestBudgetDecryption",
    type: "function",
    inputs: [],
    outputs: [
      { name: "budgetHandle", type: "bytes32" },
      { name: "spentHandle", type: "bytes32" },
    ],
    stateMutability: "nonpayable",
  },
  {
    name: "finalizeBudgetDecryption",
    type: "function",
    inputs: [
      { name: "budget", type: "uint64" },
      { name: "spent", type: "uint64" },
      { name: "publicDecryptionProof", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "setAgent",
    type: "function",
    inputs: [{ name: "_agent", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    name: "getCycle",
    type: "function",
    inputs: [{ name: "cycleId", type: "uint256" }],
    outputs: [
      { name: "id", type: "uint256" },
      { name: "timestamp", type: "uint256" },
      { name: "rosterHash", type: "bytes32" },
      { name: "completed", type: "bool" },
    ],
    stateMutability: "view",
  },
  { name: "BudgetDeposited", type: "event", inputs: [{ name: "owner", type: "address", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
  { name: "CycleStarted", type: "event", inputs: [{ name: "cycleId", type: "uint256", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
  { name: "CycleCompleted", type: "event", inputs: [{ name: "cycleId", type: "uint256", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
  { name: "ServicePaid", type: "event", inputs: [{ name: "serviceId", type: "uint8", indexed: true }, { name: "cycleId", type: "uint256", indexed: false }, { name: "timestamp", type: "uint256", indexed: false }] },
  { name: "DecryptionRequested", type: "event", inputs: [{ name: "requestId", type: "uint256", indexed: true }, { name: "requester", type: "address", indexed: true }] },
  { name: "BudgetHandlesPublished", type: "event", inputs: [{ name: "budgetHandle", type: "bytes32", indexed: false }, { name: "spentHandle", type: "bytes32", indexed: false }] },
  { name: "BudgetDecryptionFinalized", type: "event", inputs: [{ name: "budget", type: "uint64", indexed: false }, { name: "spent", type: "uint64", indexed: false }, { name: "requester", type: "address", indexed: true }] },
];

export const CONFIDENTIAL_PAYROLL_ABI = [
  { name: "employer", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "agentVault", type: "function", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "getEmployeeCount", type: "function", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { name: "isActive", type: "function", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { name: "getLastPaidCycle", type: "function", inputs: [{ name: "wallet", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
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
    name: "markPaid",
    type: "function",
    inputs: [{ name: "wallet", type: "address" }, { name: "cycleId", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { name: "employeeList", type: "function", inputs: [{ name: "", type: "uint256" }], outputs: [{ type: "address" }], stateMutability: "view" },
  { name: "EmployeeAdded", type: "event", inputs: [{ name: "employee", type: "address", indexed: true }, { name: "timestamp", type: "uint256", indexed: false }] },
];

export const CONTRACTS = {
  AgentVault: {
    abi: AGENT_VAULT_ABI,
    address: import.meta.env.VITE_AGENT_VAULT_ADDRESS,
  },
  ConfidentialPayroll: {
    abi: CONFIDENTIAL_PAYROLL_ABI,
    address: import.meta.env.VITE_CONFIDENTIAL_PAYROLL_ADDRESS,
  },
};

export const SEPOLIA_CHAIN_ID = 11155111;
