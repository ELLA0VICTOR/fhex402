# GhostPay Submission Notes

## Judge Testing Access

GhostPay requires a roster/admin API key for testing protected demo flows. This key is provided so judges can verify the app end-to-end without needing to generate their own backend secret.

```text
1816d7d774f0e1a45a2aff9da9c2d16a7ec2bf8e1d477126bd7d7ed790e04493
```

Where to use it:

- Open the GhostPay app.
- Go to the Payroll / roster upload flow.
- Paste the API key into the admin/API key field when prompted.
- Upload or use the demo roster, then run the payroll agent flow.

This key is for judging and testnet demo access only. It does not expose private wallet keys, deploy contracts, or decrypt employee balances.

## Judge Roster Upload Access

The roster upload flow is admin-protected so random visitors cannot overwrite the demo payroll data.

- Admin token: use the judge testing API key above.
- Where to use it: open GhostPay, go to Payroll, paste the token in the roster upload/admin field, then upload the CSV roster.
- What it unlocks: roster preparation only. It does not expose private keys, deploy contracts, or decrypt employee balances.

## Demo Contracts

- Network: Ethereum Sepolia
- AgentVault:
- ConfidentialPayroll:
- GhostPayrollToken / gcUSDT:

## Demo Employee Wallets

List the public test wallets used in the demo here. Never include funded private keys in public notes.

- Employee 1:
- Employee 2:
- Employee 3:
