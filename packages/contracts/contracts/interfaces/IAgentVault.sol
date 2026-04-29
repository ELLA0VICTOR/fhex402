// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

interface IAgentVault {
    event BudgetDeposited(address indexed owner, uint256 timestamp);
    event AgentConfigured(address indexed agent, uint256 timestamp);
    event ServicePaid(uint8 indexed serviceId, uint256 cycleId, uint256 timestamp);
    event CycleStarted(uint256 indexed cycleId, uint256 timestamp);
    event CycleCompleted(uint256 indexed cycleId, uint256 timestamp);
    event DecryptionRequested(uint256 indexed requestId, address indexed requester);

    function depositBudget(externalEuint64 encryptedAmount, bytes calldata inputProof) external;

    function authorizeServicePayment(
        externalEuint64 encryptedPaymentAmount,
        bytes calldata inputProof,
        uint256 cycleId,
        uint8 serviceId
    ) external returns (ebool);

    function startCycle(bytes32 rosterHash) external returns (uint256);

    function completeCycle(
        uint256 cycleId,
        externalEuint64 encryptedTotal,
        bytes calldata inputProof
    ) external;

    function requestBudgetDecryption() external returns (bytes32 budgetHandle, bytes32 spentHandle);

    function finalizeBudgetDecryption(
        uint64 budget,
        uint64 spent,
        bytes calldata publicDecryptionProof
    ) external;

    function getEncryptedBudget() external view returns (euint64);
    function getEncryptedSpent() external view returns (euint64);

    function cycleCount() external view returns (uint256);
    function agentActive() external view returns (bool);
    function lastDecryptedBudget() external view returns (uint64);
    function lastDecryptedSpent() external view returns (uint64);
}
