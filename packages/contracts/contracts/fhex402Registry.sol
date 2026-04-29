// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title fhex402Registry
/// @notice On-chain registry for x402 service endpoints and authorized agents.
///         Enables discovery and trust verification for fhex402 ecosystem participants.
contract fhex402Registry {
    // ─── State ────────────────────────────────────────────────────────────────
    address public owner;

    struct Service {
        bytes32 id;
        string name;
        string endpoint;
        string description;
        uint256 priceUSDC; // in micro-USDC (6 decimals)
        address payTo;
        bool active;
        uint256 registeredAt;
    }

    struct Agent {
        address agentAddress;
        address vaultAddress;
        string organizationName;
        bool authorized;
        uint256 registeredAt;
        uint256 cyclesRun;
    }

    mapping(bytes32 => Service) public services;
    bytes32[] public serviceIds;

    mapping(address => Agent) public agents;
    address[] public agentList;

    // ─── Events ───────────────────────────────────────────────────────────────
    event ServiceRegistered(bytes32 indexed id, string name, address payTo);
    event ServiceDeactivated(bytes32 indexed id);
    event AgentRegistered(address indexed agent, address vault, string organization);
    event AgentCycleRecorded(address indexed agent, uint256 totalCycles);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        _seedServices();
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Registry: not owner");
        _;
    }

    // ─── Service Management ───────────────────────────────────────────────────

    function registerService(
        string calldata name,
        string calldata endpoint,
        string calldata description,
        uint256 priceUSDC,
        address payTo
    ) external onlyOwner returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(name, payTo, block.timestamp));
        services[id] = Service({
            id: id,
            name: name,
            endpoint: endpoint,
            description: description,
            priceUSDC: priceUSDC,
            payTo: payTo,
            active: true,
            registeredAt: block.timestamp
        });
        serviceIds.push(id);
        emit ServiceRegistered(id, name, payTo);
        return id;
    }

    function deactivateService(bytes32 id) external onlyOwner {
        services[id].active = false;
        emit ServiceDeactivated(id);
    }

    // ─── Agent Management ─────────────────────────────────────────────────────

    function registerAgent(
        address agentAddress,
        address vaultAddress,
        string calldata organizationName
    ) external {
        require(agentAddress != address(0), "Registry: zero address");
        agents[agentAddress] = Agent({
            agentAddress: agentAddress,
            vaultAddress: vaultAddress,
            organizationName: organizationName,
            authorized: true,
            registeredAt: block.timestamp,
            cyclesRun: 0
        });
        agentList.push(agentAddress);
        emit AgentRegistered(agentAddress, vaultAddress, organizationName);
    }

    function recordCycle(address agentAddress) external {
        require(
            msg.sender == agents[agentAddress].vaultAddress || msg.sender == owner,
            "Registry: unauthorized"
        );
        agents[agentAddress].cyclesRun++;
        emit AgentCycleRecorded(agentAddress, agents[agentAddress].cyclesRun);
    }

    // ─── View ─────────────────────────────────────────────────────────────────

    function getServiceCount() external view returns (uint256) {
        return serviceIds.length;
    }

    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    function isAgentAuthorized(address agentAddress) external view returns (bool) {
        return agents[agentAddress].authorized;
    }

    // ─── Internal ─────────────────────────────────────────────────────────────

    /// @dev Seeds the three core fhex402 services on deployment.
    function _seedServices() internal {
        bytes32 id1 = keccak256(abi.encodePacked("RosterAPI", address(0), block.timestamp));
        services[id1] = Service({
            id: id1,
            name: "RosterAPI",
            endpoint: "http://localhost:3001/roster",
            description: "Encrypted employee roster for current pay cycle",
            priceUSDC: 100000, // $0.10
            payTo: address(0),
            active: true,
            registeredAt: block.timestamp
        });
        serviceIds.push(id1);

        bytes32 id2 = keccak256(abi.encodePacked("ComplianceAPI", address(0), block.timestamp + 1));
        services[id2] = Service({
            id: id2,
            name: "ComplianceAPI",
            endpoint: "http://localhost:3002/check",
            description: "Jurisdiction, eligibility and tax band validation",
            priceUSDC: 250000, // $0.25
            payTo: address(0),
            active: true,
            registeredAt: block.timestamp
        });
        serviceIds.push(id2);

        bytes32 id3 = keccak256(abi.encodePacked("DisbursAPI", address(0), block.timestamp + 2));
        services[id3] = Service({
            id: id3,
            name: "DisbursAPI",
            endpoint: "http://localhost:3003/disburse",
            description: "Encrypted batch salary disbursement execution",
            priceUSDC: 500000, // $0.50
            payTo: address(0),
            active: true,
            registeredAt: block.timestamp
        });
        serviceIds.push(id3);
    }
}
