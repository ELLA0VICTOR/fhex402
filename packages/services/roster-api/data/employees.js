// Real seeded employee dataset for fhex402 demo
// encryptedSalary fields are realistic FHE-style ciphertexts
// In production, these would be actual Zama FHEVM euint64 ciphertexts
// stored on-chain in ConfidentialPayroll.sol

export const employees = [
  {
    id: "emp-001",
    name: "Amara Okonkwo",
    wallet: "0x742d35Cc6634C0532925a3b8D4C9b1A5AE6D7890",
    department: "Engineering",
    jurisdiction: "NG",
    employedSince: "2022-03-15",
    active: true,
    // FHE ciphertext representation of encrypted salary
    // In production: TFHE.asEuint64(salary).handle
    encryptedSalary:
      "0x1a4f8b2c9d3e7f01a5b6c2d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8",
    taxBand: "PITA",
    level: "Senior",
  },
  {
    id: "emp-002",
    name: "Kofi Mensah",
    wallet: "0x8Ba1f109551bD432803012645Ac136ddd64DBA72",
    department: "Product",
    jurisdiction: "GH",
    employedSince: "2021-11-02",
    active: true,
    encryptedSalary:
      "0x2b5a9c3d0e4f8a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4e5f",
    taxBand: "GH-TAX",
    level: "Principal",
  },
  {
    id: "emp-003",
    name: "Fatima Al-Hassan",
    wallet: "0x1CBd3b2770909D4e10f157cABC84C7264073C9Ec",
    department: "Design",
    jurisdiction: "AE",
    employedSince: "2023-01-20",
    active: true,
    encryptedSalary:
      "0x3c6b0d4e1f5a9b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c",
    taxBand: "TAX_EXEMPT",
    level: "Lead",
  },
  {
    id: "emp-004",
    name: "Marcus Veltri",
    wallet: "0x4dBa88e9dc5D4ee56f4aBdC6cF2e0CA1d8bE3F2",
    department: "Operations",
    jurisdiction: "US",
    employedSince: "2022-07-08",
    active: true,
    encryptedSalary:
      "0x4d7c1e5f2a6b0c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d",
    taxBand: "W-2",
    level: "Manager",
  },
  {
    id: "emp-005",
    name: "Yuki Tanaka",
    wallet: "0x5eCb99f0EA1e7dF65bcCd8E3Abc2F0d9C7aE4B1",
    department: "Engineering",
    jurisdiction: "JP",
    employedSince: "2023-04-12",
    active: true,
    encryptedSalary:
      "0x5e8d2f6a3b7c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e",
    taxBand: "JP-RESIDENT",
    level: "Mid",
  },
];
