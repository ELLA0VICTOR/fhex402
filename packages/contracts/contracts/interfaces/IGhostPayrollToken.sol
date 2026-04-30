// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

interface IGhostPayrollToken {
    event ConfidentialTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed cycleId,
        bytes32 encryptedAmountHandle,
        uint256 receiptId,
        address operator
    );

    function fundTreasury(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external returns (bytes32 encryptedAmountHandle);

    function confidentialTransferFromTreasury(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 cycleId
    ) external returns (bytes32 encryptedAmountHandle);

    function getEncryptedBalance(address account) external view returns (euint64);
    function getEncryptedTotalSupply() external view returns (euint64);
    function getEncryptedTotalSettled() external view returns (euint64);
}
