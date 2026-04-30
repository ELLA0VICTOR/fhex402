// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";

interface IConfidentialPayroll {
    event EmployeeAdded(address indexed employee, uint256 timestamp);
    event SalaryUpdated(address indexed employee, uint256 timestamp);
    event SettlementTokenConfigured(address indexed settlementToken, uint256 timestamp);
    event AgentConfigured(address indexed agent, uint256 timestamp);
    event PaymentDispatched(
        address indexed employee,
        uint256 indexed cycleId,
        bytes32 encryptedAmountHandle,
        uint256 timestamp
    );

    function addEmployee(
        address wallet,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof,
        string calldata department,
        string calldata jurisdiction
    ) external;

    function updateSalary(
        address wallet,
        externalEuint64 newEncryptedSalary,
        bytes calldata inputProof
    ) external;

    function markPaid(address wallet, uint256 cycleId) external;
    function settleEmployee(address wallet, uint256 cycleId) external returns (bytes32 encryptedAmountHandle);
    function setAgent(address agent) external;
    function setSettlementToken(address settlementToken) external;

    function getEmployeeCount() external view returns (uint256);
    function getEncryptedSalary(address wallet) external view returns (euint64);
}
