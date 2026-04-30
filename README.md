# fhex402 / GhostPay

Private AI payroll rail built with Zama FHEVM and x402.

GhostPay lets a company run a payroll cycle through an autonomous server-side agent. The agent pays three HTTP services through x402, while the payroll budget checks and audit trail stay encrypted on Zama FHEVM smart contracts deployed to Ethereum Sepolia.

## What It Does

1. The company deploys `AgentVault` and `ConfidentialPayroll` on Ethereum Sepolia.
2. The company deposits an encrypted payroll budget into `AgentVault`.
3. A server-side payroll agent runs the cycle:
   - pays `RosterAPI` over x402 and receives encrypted employee records
   - pays `ComplianceAPI` over x402 and validates eligibility
   - pays `DisbursAPI` over x402 and settles encrypted payroll token transfers
4. Before each paid service call, `AgentVault` checks encrypted spend against encrypted budget with FHE.
5. The owner can later request a private audit/decryption flow for budget totals.

## Network Split

| Layer | Network | Why |
| --- | --- | --- |
| Zama FHE contracts | Ethereum Sepolia `11155111` | Required FHEVM host chain for the confidential dApp |
| x402 service payments | Base Sepolia `eip155:84532` | Supported by the public x402 test facilitator |
| Salary settlement | Ethereum Sepolia `11155111` | Uses `GhostPayrollToken` confidential balances and encrypted transfer amounts |

The confidential smart-contract app remains on Ethereum Sepolia. Base Sepolia is only used as the low-cost x402 service-fee rail, not as the private salary rail.

## Packages

| Package | Purpose |
| --- | --- |
| `packages/contracts` | Hardhat + Solidity + Zama FHEVM contracts |
| `packages/frontend` | Vite React UI |
| `packages/services` | RosterAPI, ComplianceAPI, DisbursAPI, and PayrollAgent |

## Contracts

| Contract | Purpose |
| --- | --- |
| `AgentVault.sol` | Encrypted budget, encrypted spent total, FHE budget enforcement |
| `ConfidentialPayroll.sol` | Encrypted employee salary records |
| `GhostPayrollToken.sol` | ERC-7984-style confidential payroll settlement token |
| `fhex402Registry.sol` | Registry for agent/services metadata |

## Services

| Service | Port | x402 Cost |
| --- | --- | --- |
| RosterAPI | `3001` | `$0.001` |
| ComplianceAPI | `3002` | `$0.001` |
| DisbursAPI | `3003` | `$0.001` |
| PayrollAgent | `3004` | Internal agent API |

## Setup

Install dependencies:

```bash
npm install
```

Create local env files from the examples:

```bash
copy packages\contracts\.env.example packages\contracts\.env
copy packages\frontend\.env.example packages\frontend\.env
copy packages\services\.env.example packages\services\.env
```

Fill the env values locally. Never commit real `.env` files.

## Deploy

Compile and test:

```bash
npm run compile
npm test
```

Deploy to Ethereum Sepolia:

```bash
npm run deploy:sepolia
```

Copy the deployed contract addresses into:

```bash
packages/frontend/.env
packages/services/.env
```

The deploy script prints all required variables, including `VITE_CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS` and `CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS`.

## Run Locally

Prepare the encrypted roster after deployment:

```bash
npm run prepare:roster --workspace=packages/services
```

You can also use the Payroll tab in the app to upload JSON/CSV. Both paths encrypt salary values, register employees on `ConfidentialPayroll`, fund `GhostPayrollToken`, and write the safe roster file used by `RosterAPI`.

Plain roster input shape:

```json
{
  "employees": [
    {
      "id": "emp-001",
      "name": "Employee One",
      "wallet": "0x...",
      "salaryUSDC": "1250.00",
      "department": "Engineering",
      "jurisdiction": "US",
      "employedSince": "2024-01-01"
    }
  ]
}
```

The `.local.json` roster files are gitignored.

Start services:

```bash
npm run dev:services
```

Start frontend:

```bash
npm run dev:frontend
```

Open:

```text
http://localhost:5173
```

## Demo Flow

1. Connect MetaMask on Ethereum Sepolia.
2. Deposit an encrypted budget into the vault.
3. Make sure the services are online.
4. Upload/configure an encrypted roster for `RosterAPI`.
5. Click `Run payroll cycle`.
6. Watch the agent pay each x402 service, update the encrypted vault state, and produce confidential payroll token receipts.
7. Use the audit tab to request/decrypt budget totals.

## Important Notes

- Real secrets belong only in local `.env` files.
- Testnet USDC has no real financial value.
- Salary handles are expected to be encrypted before they reach the roster service.
- Salary settlement defaults to the confidential payroll token:

```env
DISBURSEMENT_MODE=confidential_token
CONFIDENTIAL_PAYROLL_ADDRESS=0x...
CONFIDENTIAL_PAYROLL_TOKEN_ADDRESS=0x...
```

- Base Sepolia USDC remains the x402 fee rail. It is not used to prove private salary amounts.

## Tech Stack

| Layer | Tech |
| --- | --- |
| Smart contracts | Solidity, Hardhat, Zama FHEVM |
| Frontend | Vite, React, Tailwind CSS |
| FHE client | `@zama-fhe/relayer-sdk` |
| Services | Node.js, Express |
| x402 | `@x402/express`, `@x402/fetch`, `@x402/evm` |
| Blockchain client | viem |
