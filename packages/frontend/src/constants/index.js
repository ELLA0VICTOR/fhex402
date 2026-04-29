export const SEPOLIA_CHAIN_ID = 11155111;

export const USDC_SEPOLIA = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
export const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

export const ZAMA_GATEWAY_SEPOLIA =
  import.meta.env.VITE_FHEVM_GATEWAY_URL || "https://gateway.sepolia.zama.ai";

export const SERVICE_COSTS = {
  roster: 100000,     // $0.10 USDC (6 decimals)
  compliance: 250000, // $0.25 USDC
  disburse: 500000,   // $0.50 USDC
  total: 850000,      // $0.85 USDC per full cycle
};

export const CYCLE_STEPS = [
  { id: "roster",     label: "Fetch Roster",       service: "RosterAPI",     cost: "$0.10" },
  { id: "compliance", label: "Compliance Check",   service: "ComplianceAPI", cost: "$0.25" },
  { id: "disburse",   label: "Batch Disburse",     service: "DisbursAPI",    cost: "$0.50" },
  { id: "complete",   label: "Cycle Complete",      service: null,            cost: null },
];

export const JURISDICTIONS = {
  US: "United States",
  GB: "United Kingdom",
  NG: "Nigeria",
  GH: "Ghana",
  AE: "UAE",
  JP: "Japan",
  SG: "Singapore",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
};

export const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Operations",
  "Finance",
  "Marketing",
  "Legal",
];
