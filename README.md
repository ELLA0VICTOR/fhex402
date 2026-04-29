# fhex402 — Private AI Payroll Rail

> **FHE-encrypted enterprise payroll** powered by **Zama FHEVM** + **x402 micropayments**

fhex402 is an autonomous AI agent payroll protocol built for the **Zama FHE Hackathon**.
An AI agent executes the full payroll cycle by paying for three real HTTP services
via the x402 payment protocol. All salary amounts and budgets are encrypted on-chain
using **Fully Homomorphic Encryption** — nobody on the network sees what was paid or to whom.

---

## Architecture

```
                    ┌─────────────────────┐
                    │   AgentVault.sol     │
                    │  (Sepolia + FHEVM)  │
                    │                     │
                    │  encryptedBudget    │
                    │  encryptedSpent     │
                    │  TFHE.le(·) check   │
                    └────────┬────────────┘
                             │ authorizeServicePayment()
                             │ (FHE budget enforcement)
                    ┌────────▼────────────┐
                    │   AI Payroll Agent   │
                    │  (browser wallet)    │
                    └────┬──────┬─────┬───┘
                x402 $   │      │     │  x402 $
              ┌──────────▼──┐ ┌─▼──┐ ┌▼──────────┐
              │  RosterAPI  │ │ CA │ │ DisbursAPI │
              │  :3001      │ │:02 │ │   :3003    │
              │  $0.10 USDC │ │$0.25│ │ $0.50 USDC │
              └─────────────┘ └────┘ └────────────┘
```

### Contracts
| Contract | Purpose |
|----------|---------|
| `AgentVault.sol` | FHE vault holding encrypted budget · enforces spend limits with `TFHE.le()` |
| `ConfidentialPayroll.sol` | Encrypted `euint64` salary records per employee |
| `fhex402Registry.sol` | On-chain service + agent registry |

### x402 Services
| Service | Port | Cost | Purpose |
|---------|------|------|---------|
| RosterAPI | 3001 | $0.10 USDC | Returns encrypted employee roster |
| ComplianceAPI | 3002 | $0.25 USDC | Validates jurisdiction, eligibility, tax band |
| DisbursAPI | 3003 | $0.50 USDC | Executes encrypted batch salary transfers |

---

## Quick Start

### 1. Install Dependencies

```bash
git clone https://github.com/yourhandle/fhex402
cd fhex402
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Fill in your values:
# - PRIVATE_KEY (deployer wallet)
# - SEPOLIA_RPC_URL (Infura / Alchemy)
# - ETHERSCAN_API_KEY (for verification)
# - ROSTER_WALLET_ADDRESS, COMPLIANCE_WALLET_ADDRESS, DISBURSE_WALLET_ADDRESS
# - FHEVM_* addresses from https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia
```

### 3. Compile & Deploy Contracts

```bash
# Compile
npm run compile

# Deploy to Sepolia
npm run deploy:sepolia

# Copy output addresses into packages/frontend/.env:
# VITE_AGENT_VAULT_ADDRESS=0x...
# VITE_CONFIDENTIAL_PAYROLL_ADDRESS=0x...
```

### 4. Start Everything

```bash
# Starts frontend (port 5173) + all 3 x402 services concurrently
npm run dev
```

### 5. Demo Flow (3 minutes)

1. Open `http://localhost:5173`
2. Connect MetaMask (switch to Sepolia Testnet)
3. Deposit an encrypted budget via **Agent Vault** → "Deposit Budget"
4. Confirm all 3 services show **ONLINE** in the status bar
5. Click **"Run Payroll Cycle"** — watch the agent:
   - Pay RosterAPI $0.10 USDC via x402
   - Pay ComplianceAPI $0.25 USDC via x402
   - Pay DisbursAPI $0.50 USDC via x402
   - All budget checks enforced by FHE on AgentVault
6. View encrypted salary ciphertexts in the roster table
7. Open **Audit** → **"Decrypt My Budget"** — FHE reveal moment

---

## Project Structure

```
fhex402/
├── packages/
│   ├── contracts/          # Hardhat + Zama FHEVM
│   │   ├── contracts/
│   │   │   ├── AgentVault.sol
│   │   │   ├── ConfidentialPayroll.sol
│   │   │   └── fhex402Registry.sol
│   │   └── scripts/deploy.js
│   │
│   ├── frontend/           # Vite + React 19 + Tailwind
│   │   └── src/
│   │       ├── pages/      # Dashboard, Payroll, Vault, Audit
│   │       ├── components/ # vault, agent, payroll, services, layout, icons
│   │       ├── hooks/      # useAgentVault, usePayrollAgent, useFhevm, useWallet
│   │       └── lib/        # fhevm.js, wagmi.js, x402.js, contracts.js
│   │
│   └── services/           # Three real x402 Express servers
│       ├── roster-api/     # port 3001
│       ├── compliance-api/ # port 3002
│       └── disburse-api/   # port 3003
└── package.json            # npm workspaces monorepo
```

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Smart Contracts | Solidity 0.8.24 + Zama FHEVM + Hardhat |
| Frontend | Vite + React 19 + Tailwind CSS v3 |
| FHE Client | fhevmjs (Zama browser SDK) |
| Wallet | Wagmi v2 + viem |
| Services | Node.js + Express + x402 protocol |
| Chain | Ethereum Sepolia Testnet |

---

## FHE Design

The key FHE operation in `AgentVault.sol`:

```solidity
euint64 newTotal = TFHE.add(encryptedSpent, paymentAmount);
ebool canPay = TFHE.le(newTotal, encryptedBudget);  // encrypted comparison
encryptedSpent = TFHE.select(canPay, newTotal, encryptedSpent);
```

- `TFHE.add()` — add encrypted values without decrypting
- `TFHE.le()` — compare encrypted values, result is encrypted `ebool`
- `TFHE.select()` — conditional update based on encrypted boolean
- `Gateway.requestDecryption()` — async owner-only budget reveal

**Nobody on-chain ever sees a plaintext salary amount.**

---

## Resources

- [Zama FHEVM Docs](https://docs.zama.ai/fhevm)
- [Zama Sepolia Addresses](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia)
- [FHEVM React Template](https://github.com/zama-ai/fhevm-react-template)
- [x402 Protocol](https://x402.org)
- [fhevmjs SDK](https://github.com/zama-ai/fhevmjs)

---

## Environment Variables Reference

| Variable | Description |
|----------|-------------|
| `PRIVATE_KEY` | Deployer/owner wallet private key |
| `AGENT_ADDRESS` | AI agent wallet address |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |
| `FHEVM_GATEWAY_ADDRESS` | Zama Gateway on Sepolia |
| `FHEVM_ACL_ADDRESS` | Zama ACL on Sepolia |
| `VITE_AGENT_VAULT_ADDRESS` | Deployed AgentVault address |
| `VITE_CONFIDENTIAL_PAYROLL_ADDRESS` | Deployed ConfidentialPayroll address |
| `DEMO_MODE` | `true` = simulated transfers, `false` = real USDC |
| `ROSTER_WALLET_ADDRESS` | Receives RosterAPI x402 payments |
| `COMPLIANCE_WALLET_ADDRESS` | Receives ComplianceAPI x402 payments |
| `DISBURSE_WALLET_ADDRESS` | Receives DisbursAPI x402 payments |

---

Built for the **Zama FHE Hackathon 2024** · MIT License
