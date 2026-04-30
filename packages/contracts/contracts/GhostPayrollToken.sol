// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, ebool, euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title GhostPayrollToken
/// @notice ERC-7984-style confidential payroll token for demo salary settlement.
/// @dev Balances and transfer amounts are encrypted euint64 values.
contract GhostPayrollToken is ZamaEthereumConfig {
    string public constant name = "Ghost Confidential USD";
    string public constant symbol = "gcUSDT";
    uint8 public constant decimals = 6;

    address public owner;
    address public agent;
    address public payrollContract;

    euint64 private encryptedTotalSupply;
    euint64 private encryptedTotalSettled;

    mapping(address => euint64) private balances;
    mapping(address => bool) private balanceInitialized;

    struct ConfidentialReceipt {
        uint256 id;
        address from;
        address to;
        uint256 cycleId;
        uint256 timestamp;
        bytes32 encryptedAmountHandle;
        address operator;
    }

    uint256 public receiptCount;
    mapping(uint256 => ConfidentialReceipt) public receipts;

    event AgentConfigured(address indexed agent);
    event PayrollContractConfigured(address indexed payrollContract);
    event TreasuryFunded(bytes32 encryptedAmountHandle, uint256 timestamp);
    event ConfidentialTransfer(
        address indexed from,
        address indexed to,
        uint256 indexed cycleId,
        bytes32 encryptedAmountHandle,
        uint256 receiptId,
        address operator
    );

    constructor(address _agent) {
        owner = msg.sender;
        agent = _agent;

        encryptedTotalSupply = FHE.asEuint64(0);
        encryptedTotalSettled = FHE.asEuint64(0);
        FHE.allowThis(encryptedTotalSupply);
        FHE.allowThis(encryptedTotalSettled);
        FHE.allow(encryptedTotalSupply, owner);
        FHE.allow(encryptedTotalSettled, owner);

        _initializeBalance(owner);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "GhostPayrollToken: not owner");
        _;
    }

    modifier onlyOperator() {
        require(
            msg.sender == owner || msg.sender == agent || msg.sender == payrollContract,
            "GhostPayrollToken: not operator"
        );
        _;
    }

    function setAgent(address _agent) external onlyOwner {
        require(_agent != address(0), "GhostPayrollToken: zero agent");
        agent = _agent;
        _allowBalance(owner);
        emit AgentConfigured(_agent);
    }

    function setPayrollContract(address _payrollContract) external onlyOwner {
        require(_payrollContract != address(0), "GhostPayrollToken: zero payroll");
        payrollContract = _payrollContract;
        _allowBalance(owner);
        emit PayrollContractConfigured(_payrollContract);
    }

    /// @notice Privately funds the employer treasury balance.
    function fundTreasury(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (bytes32 encryptedAmountHandle) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);

        _initializeBalance(owner);
        balances[owner] = FHE.add(balances[owner], amount);
        encryptedTotalSupply = FHE.add(encryptedTotalSupply, amount);

        _allowBalance(owner);
        FHE.allowThis(encryptedTotalSupply);
        FHE.allow(encryptedTotalSupply, owner);
        FHE.allow(amount, owner);

        encryptedAmountHandle = FHE.toBytes32(amount);
        emit TreasuryFunded(encryptedAmountHandle, block.timestamp);
    }

    /// @notice Sends an encrypted payroll amount from employer treasury to an employee.
    /// @dev If the encrypted treasury check fails, balances are left unchanged. The check itself stays encrypted.
    function confidentialTransferFromTreasury(
        address to,
        externalEuint64 encryptedAmount,
        bytes calldata inputProof,
        uint256 cycleId
    ) external onlyOperator returns (bytes32 encryptedAmountHandle) {
        require(to != address(0), "GhostPayrollToken: zero recipient");

        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        _initializeBalance(owner);
        _initializeBalance(to);

        ebool canTransfer = FHE.le(amount, balances[owner]);
        euint64 treasuryAfter = FHE.sub(balances[owner], amount);
        euint64 recipientAfter = FHE.add(balances[to], amount);
        euint64 totalSettledAfter = FHE.add(encryptedTotalSettled, amount);

        balances[owner] = FHE.select(canTransfer, treasuryAfter, balances[owner]);
        balances[to] = FHE.select(canTransfer, recipientAfter, balances[to]);
        encryptedTotalSettled = FHE.select(canTransfer, totalSettledAfter, encryptedTotalSettled);

        _allowBalance(owner);
        _allowBalance(to);
        FHE.allowThis(encryptedTotalSettled);
        FHE.allow(encryptedTotalSettled, owner);
        FHE.allow(amount, owner);
        FHE.allow(amount, to);

        encryptedAmountHandle = FHE.toBytes32(amount);
        receiptCount++;
        receipts[receiptCount] = ConfidentialReceipt({
            id: receiptCount,
            from: owner,
            to: to,
            cycleId: cycleId,
            timestamp: block.timestamp,
            encryptedAmountHandle: encryptedAmountHandle,
            operator: msg.sender
        });

        emit ConfidentialTransfer(owner, to, cycleId, encryptedAmountHandle, receiptCount, msg.sender);
    }

    function getEncryptedBalance(address account) external view returns (euint64) {
        return balances[account];
    }

    function getEncryptedTotalSupply() external view returns (euint64) {
        return encryptedTotalSupply;
    }

    function getEncryptedTotalSettled() external view returns (euint64) {
        return encryptedTotalSettled;
    }

    function getReceipt(uint256 receiptId)
        external
        view
        returns (
            address from,
            address to,
            uint256 cycleId,
            uint256 timestamp,
            bytes32 encryptedAmountHandle,
            address operator
        )
    {
        ConfidentialReceipt storage receipt = receipts[receiptId];
        return (
            receipt.from,
            receipt.to,
            receipt.cycleId,
            receipt.timestamp,
            receipt.encryptedAmountHandle,
            receipt.operator
        );
    }

    function _initializeBalance(address account) internal {
        if (!balanceInitialized[account]) {
            balances[account] = FHE.asEuint64(0);
            balanceInitialized[account] = true;
            _allowBalance(account);
        }
    }

    function _allowBalance(address account) internal {
        FHE.allowThis(balances[account]);
        FHE.allow(balances[account], account);
        FHE.allow(balances[account], owner);

        if (agent != address(0)) {
            FHE.allow(balances[account], agent);
        }

        if (payrollContract != address(0)) {
            FHE.allow(balances[account], payrollContract);
        }
    }
}
