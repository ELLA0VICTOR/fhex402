const { expect } = require("chai");
const { ethers } = require("hardhat");

function isLocalFheRuntimeError(error) {
  const message = String(error && error.message ? error.message : error);
  return (
    message.includes("trivialEncrypt") ||
    message.includes("unexpected amount of data")
  );
}

async function deployAgentVaultOrSkip(ctx, agentAddress) {
  const AgentVault = await ethers.getContractFactory("AgentVault");

  try {
    return await AgentVault.deploy(agentAddress);
  } catch (error) {
    if (isLocalFheRuntimeError(error)) {
      ctx.skip();
    }
    throw error;
  }
}

async function deployGhostPayrollTokenOrSkip(ctx, agentAddress) {
  const GhostPayrollToken = await ethers.getContractFactory("GhostPayrollToken");

  try {
    return await GhostPayrollToken.deploy(agentAddress);
  } catch (error) {
    if (isLocalFheRuntimeError(error)) {
      ctx.skip();
    }
    throw error;
  }
}

describe("fhex402", function () {
  let owner, agent, employee1;

  beforeEach(async function () {
    [owner, agent, employee1] = await ethers.getSigners();
  });

  describe("fhex402Registry", function () {
    let registry;

    beforeEach(async function () {
      const Registry = await ethers.getContractFactory("fhex402Registry");
      registry = await Registry.deploy();
    });

    it("Should deploy with three seeded services", async function () {
      const count = await registry.getServiceCount();
      expect(count).to.equal(3);
    });

    it("Should register an agent", async function () {
      await registry.registerAgent(agent.address, owner.address, "AcmeCorp");
      expect(await registry.isAgentAuthorized(agent.address)).to.be.true;
    });

    it("Should register additional services", async function () {
      await registry.registerService(
        "TestService",
        "http://localhost:9999/test",
        "A test service",
        50000,
        owner.address
      );
      expect(await registry.getServiceCount()).to.equal(4);
    });
  });

  describe("AgentVault", function () {
    let agentVault;

    beforeEach(async function () {
      agentVault = await deployAgentVaultOrSkip(this, agent.address);
    });

    it("Should have correct owner and agent", async function () {
      expect(await agentVault.owner()).to.equal(owner.address);
      expect(await agentVault.agent()).to.equal(agent.address);
    });

    it("Should start with agentActive = false", async function () {
      expect(await agentVault.agentActive()).to.be.false;
    });

    it("Should start with cycleCount = 0", async function () {
      expect(await agentVault.cycleCount()).to.equal(0);
    });

    it("Should allow owner to set agent", async function () {
      await agentVault.setAgent(employee1.address);
      expect(await agentVault.agent()).to.equal(employee1.address);
    });

    it("Should reject non-owner setAgent", async function () {
      await expect(
        agentVault.connect(agent).setAgent(employee1.address)
      ).to.be.revertedWith("AgentVault: not owner");
    });

    it("Should reject non-agent startCycle", async function () {
      await expect(agentVault.startCycle(ethers.ZeroHash)).to.be.revertedWith(
        "AgentVault: not agent"
      );
    });

    it("Should reject non-owner requestBudgetDecryption", async function () {
      await expect(
        agentVault.connect(agent).requestBudgetDecryption()
      ).to.be.revertedWith("AgentVault: not owner");
    });
  });

  describe("ConfidentialPayroll", function () {
    let agentVault, payroll;

    beforeEach(async function () {
      agentVault = await deployAgentVaultOrSkip(this, agent.address);

      const ConfidentialPayroll = await ethers.getContractFactory(
        "ConfidentialPayroll"
      );
      payroll = await ConfidentialPayroll.deploy(await agentVault.getAddress(), agent.address);
    });

    it("Should have correct employer and agentVault", async function () {
      expect(await payroll.employer()).to.equal(owner.address);
      expect(await payroll.agentVault()).to.equal(await agentVault.getAddress());
      expect(await payroll.agent()).to.equal(agent.address);
    });

    it("Should start with zero employees", async function () {
      expect(await payroll.getEmployeeCount()).to.equal(0);
    });

    it("Should reject non-employer employee deactivation", async function () {
      await expect(
        payroll.connect(agent).deactivateEmployee(employee1.address)
      ).to.be.revertedWith("ConfidentialPayroll: not employer");
    });

    it("Should report unknown employees as inactive", async function () {
      expect(await payroll.isActive(employee1.address)).to.be.false;
    });

    it("Should allow employer to configure settlement token", async function () {
      await payroll.setSettlementToken(employee1.address);
      expect(await payroll.settlementToken()).to.equal(employee1.address);
    });
  });

  describe("GhostPayrollToken", function () {
    let token;

    beforeEach(async function () {
      token = await deployGhostPayrollTokenOrSkip(this, agent.address);
    });

    it("Should have confidential payroll token metadata", async function () {
      expect(await token.name()).to.equal("Ghost Confidential USD");
      expect(await token.symbol()).to.equal("gcUSDT");
      expect(await token.decimals()).to.equal(6);
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.agent()).to.equal(agent.address);
    });

    it("Should allow owner to configure payroll contract", async function () {
      await token.setPayrollContract(employee1.address);
      expect(await token.payrollContract()).to.equal(employee1.address);
    });
  });
});
