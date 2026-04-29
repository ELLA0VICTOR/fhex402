// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title AgentVault
/// @notice FHE-encrypted payroll budget vault for GhostPay.
/// @dev Uses the current Zama self-relayed decryption workflow.
contract AgentVault is ZamaEthereumConfig {
    address public owner;
    address public agent;
    euint64 private encryptedBudget;
    euint64 private encryptedSpent;
    uint256 public cycleCount;
    bool public agentActive;

    struct PayrollCycle {
        uint256 cycleId;
        uint256 timestamp;
        bytes32 rosterHash;
        euint64 encryptedTotal;
        bool completed;
    }

    mapping(uint256 => PayrollCycle) public cycles;
    mapping(uint256 => mapping(uint8 => euint64)) private serviceSpend;

    uint256[] public decryptionRequests;
    uint64 public lastDecryptedBudget;
    uint64 public lastDecryptedSpent;

    event BudgetDeposited(address indexed owner, uint256 timestamp);
    event AgentConfigured(address indexed agent, uint256 timestamp);
    event ServicePaid(uint8 indexed serviceId, uint256 cycleId, uint256 timestamp);
    event CycleStarted(uint256 indexed cycleId, uint256 timestamp);
    event CycleCompleted(uint256 indexed cycleId, uint256 timestamp);
    event DecryptionRequested(uint256 indexed requestId, address indexed requester);
    event BudgetHandlesPublished(bytes32 budgetHandle, bytes32 spentHandle);
    event BudgetDecryptionFinalized(uint64 budget, uint64 spent, address indexed requester);

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;
        agentActive = false;

        encryptedSpent = FHE.asEuint64(0);
        FHE.allowThis(encryptedSpent);
        FHE.allow(encryptedSpent, owner);

        encryptedBudget = FHE.asEuint64(0);
        FHE.allowThis(encryptedBudget);
        FHE.allow(encryptedBudget, owner);

        if (_agent != address(0)) {
            FHE.allow(encryptedSpent, _agent);
            FHE.allow(encryptedBudget, _agent);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "AgentVault: not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent, "AgentVault: not agent");
        _;
    }

    function depositBudget(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        encryptedBudget = FHE.add(encryptedBudget, amount);

        FHE.allowThis(encryptedBudget);
        FHE.allow(encryptedBudget, owner);
        FHE.allow(encryptedBudget, agent);

        agentActive = true;
        emit BudgetDeposited(msg.sender, block.timestamp);
    }

    function setAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "AgentVault: zero agent");
        agent = _agent;
        FHE.allow(encryptedBudget, _agent);
        FHE.allow(encryptedSpent, _agent);
        emit AgentConfigured(_agent, block.timestamp);
    }

    function authorizeServicePayment(
        externalEuint64 encryptedPaymentAmount,
        bytes calldata inputProof,
        uint256 cycleId,
        uint8 serviceId
    ) external onlyAgent returns (ebool) {
        require(agentActive, "AgentVault: agent not active");
        require(serviceId <= 2, "AgentVault: invalid service ID");

        euint64 paymentAmount = FHE.fromExternal(encryptedPaymentAmount, inputProof);
        euint64 newTotal = FHE.add(encryptedSpent, paymentAmount);
        ebool canPay = FHE.le(newTotal, encryptedBudget);

        encryptedSpent = FHE.select(canPay, newTotal, encryptedSpent);

        euint64 zero = FHE.asEuint64(0);
        serviceSpend[cycleId][serviceId] = FHE.select(canPay, paymentAmount, zero);

        FHE.allowThis(encryptedSpent);
        FHE.allow(encryptedSpent, owner);
        FHE.allow(encryptedSpent, agent);
        FHE.allow(serviceSpend[cycleId][serviceId], owner);

        emit ServicePaid(serviceId, cycleId, block.timestamp);
        return canPay;
    }

    function startCycle(bytes32 rosterHash) external onlyAgent returns (uint256) {
        cycleCount++;
        euint64 zero = FHE.asEuint64(0);
        cycles[cycleCount] = PayrollCycle({
            cycleId: cycleCount,
            timestamp: block.timestamp,
            rosterHash: rosterHash,
            encryptedTotal: zero,
            completed: false
        });

        FHE.allowThis(cycles[cycleCount].encryptedTotal);
        FHE.allow(cycles[cycleCount].encryptedTotal, owner);
        FHE.allow(cycles[cycleCount].encryptedTotal, agent);

        emit CycleStarted(cycleCount, block.timestamp);
        return cycleCount;
    }

    function completeCycle(
        uint256 cycleId,
        externalEuint64 encryptedTotal,
        bytes calldata inputProof
    ) external onlyAgent {
        require(cycleId > 0 && cycleId <= cycleCount, "AgentVault: invalid cycle");
        require(!cycles[cycleId].completed, "AgentVault: cycle already complete");

        euint64 total = FHE.fromExternal(encryptedTotal, inputProof);
        cycles[cycleId].encryptedTotal = total;
        cycles[cycleId].completed = true;

        FHE.allowThis(total);
        FHE.allow(total, owner);
        FHE.allow(total, agent);

        emit CycleCompleted(cycleId, block.timestamp);
    }

    /// @notice Marks budget/spent handles publicly decryptable for a relayer-sdk publicDecrypt call.
    function requestBudgetDecryption()
        external
        onlyOwner
        returns (bytes32 budgetHandle, bytes32 spentHandle)
    {
        FHE.makePubliclyDecryptable(encryptedBudget);
        FHE.makePubliclyDecryptable(encryptedSpent);

        budgetHandle = FHE.toBytes32(encryptedBudget);
        spentHandle = FHE.toBytes32(encryptedSpent);

        decryptionRequests.push(block.timestamp);
        uint256 requestId = decryptionRequests.length;

        emit DecryptionRequested(requestId, msg.sender);
        emit BudgetHandlesPublished(budgetHandle, spentHandle);
    }

    /// @notice Verifies relayer public decryption proof and stores clear audit totals.
    function finalizeBudgetDecryption(
        uint64 budget,
        uint64 spent,
        bytes calldata publicDecryptionProof
    ) external onlyOwner {
        bytes32[] memory handles = new bytes32[](2);
        handles[0] = FHE.toBytes32(encryptedBudget);
        handles[1] = FHE.toBytes32(encryptedSpent);

        FHE.checkSignatures(handles, abi.encode(budget, spent), publicDecryptionProof);

        lastDecryptedBudget = budget;
        lastDecryptedSpent = spent;

        emit BudgetDecryptionFinalized(budget, spent, msg.sender);
    }

    function getEncryptedBudget() external view returns (euint64) {
        return encryptedBudget;
    }

    function getEncryptedSpent() external view returns (euint64) {
        return encryptedSpent;
    }

    function getServiceSpend(uint256 cycleId, uint8 serviceId) external view returns (euint64) {
        return serviceSpend[cycleId][serviceId];
    }

    function getCycle(uint256 cycleId)
        external
        view
        returns (uint256 id, uint256 timestamp, bytes32 rosterHash, bool completed)
    {
        PayrollCycle storage c = cycles[cycleId];
        return (c.cycleId, c.timestamp, c.rosterHash, c.completed);
    }
}
