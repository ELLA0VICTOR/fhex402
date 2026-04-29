// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialPayroll
/// @notice Stores encrypted employee salary records.
contract ConfidentialPayroll is ZamaEthereumConfig {
    address public employer;
    address public agentVault;

    struct Employee {
        address wallet;
        euint64 encryptedSalary;
        bool active;
        uint256 lastPaidCycle;
        string department;
        string jurisdiction;
    }

    mapping(address => Employee) private employees;
    address[] public employeeList;

    event EmployeeAdded(address indexed employee, uint256 timestamp);
    event SalaryUpdated(address indexed employee, uint256 timestamp);
    event PaymentDispatched(address indexed employee, uint256 cycleId, uint256 timestamp);
    event EmployeeDeactivated(address indexed employee, uint256 timestamp);

    constructor(address _agentVault) {
        employer = msg.sender;
        agentVault = _agentVault;
    }

    modifier onlyEmployer() {
        require(msg.sender == employer, "ConfidentialPayroll: not employer");
        _;
    }

    modifier onlyAuthorized() {
        require(
            msg.sender == agentVault || msg.sender == employer,
            "ConfidentialPayroll: unauthorized"
        );
        _;
    }

    function addEmployee(
        address wallet,
        externalEuint64 encryptedSalary,
        bytes calldata inputProof,
        string calldata department,
        string calldata jurisdiction
    ) external onlyEmployer {
        require(wallet != address(0), "ConfidentialPayroll: zero address");
        require(!employees[wallet].active, "ConfidentialPayroll: already exists");

        euint64 salary = FHE.fromExternal(encryptedSalary, inputProof);

        FHE.allowThis(salary);
        FHE.allow(salary, employer);
        FHE.allow(salary, wallet);
        FHE.allow(salary, agentVault);

        employees[wallet] = Employee({
            wallet: wallet,
            encryptedSalary: salary,
            active: true,
            lastPaidCycle: 0,
            department: department,
            jurisdiction: jurisdiction
        });
        employeeList.push(wallet);

        emit EmployeeAdded(wallet, block.timestamp);
    }

    function updateSalary(
        address wallet,
        externalEuint64 newEncryptedSalary,
        bytes calldata inputProof
    ) external onlyEmployer {
        require(employees[wallet].active, "ConfidentialPayroll: not active");

        euint64 newSalary = FHE.fromExternal(newEncryptedSalary, inputProof);
        FHE.allowThis(newSalary);
        FHE.allow(newSalary, employer);
        FHE.allow(newSalary, wallet);
        FHE.allow(newSalary, agentVault);

        employees[wallet].encryptedSalary = newSalary;
        emit SalaryUpdated(wallet, block.timestamp);
    }

    function deactivateEmployee(address wallet) external onlyEmployer {
        require(employees[wallet].active, "ConfidentialPayroll: not active");
        employees[wallet].active = false;
        emit EmployeeDeactivated(wallet, block.timestamp);
    }

    function markPaid(address wallet, uint256 cycleId) external onlyAuthorized {
        employees[wallet].lastPaidCycle = cycleId;
        emit PaymentDispatched(wallet, cycleId, block.timestamp);
    }

    function getEmployeeCount() external view returns (uint256) {
        return employeeList.length;
    }

    function getEncryptedSalary(address wallet) external view returns (euint64) {
        return employees[wallet].encryptedSalary;
    }

    function isActive(address wallet) external view returns (bool) {
        return employees[wallet].active;
    }

    function getLastPaidCycle(address wallet) external view returns (uint256) {
        return employees[wallet].lastPaidCycle;
    }

    function getEmployeeMeta(address wallet)
        external
        view
        returns (
            bool active,
            uint256 lastPaidCycle,
            string memory department,
            string memory jurisdiction
        )
    {
        Employee storage emp = employees[wallet];
        return (emp.active, emp.lastPaidCycle, emp.department, emp.jurisdiction);
    }
}
