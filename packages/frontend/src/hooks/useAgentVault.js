import {
  usePublicClient,
  useReadContract,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { useState } from "react";
import { CONTRACTS } from "@/lib/contracts";
import { getPublicClearValue, publicDecryptHandles } from "@/lib/fhevm";

export function useAgentVault() {
  const [txHash, setTxHash] = useState(null);
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const contractConfig = {
    address: CONTRACTS.AgentVault.address,
    abi: CONTRACTS.AgentVault.abi,
  };

  const { data: cycleCount, refetch: refetchCycleCount } = useReadContract({
    ...contractConfig,
    functionName: "cycleCount",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { data: agentActive, refetch: refetchAgentActive } = useReadContract({
    ...contractConfig,
    functionName: "agentActive",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { data: lastDecryptedBudget, refetch: refetchBudget } = useReadContract({
    ...contractConfig,
    functionName: "lastDecryptedBudget",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { data: lastDecryptedSpent, refetch: refetchSpent } = useReadContract({
    ...contractConfig,
    functionName: "lastDecryptedSpent",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { data: ownerAddress } = useReadContract({
    ...contractConfig,
    functionName: "owner",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { data: agentAddress } = useReadContract({
    ...contractConfig,
    functionName: "agent",
    query: { enabled: !!CONTRACTS.AgentVault.address },
  });

  const { isLoading: txPending, isSuccess: txSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    query: { enabled: !!txHash },
  });

  async function depositBudget(encryptedAmount, inputProof) {
    const hash = await writeContractAsync({
      ...contractConfig,
      functionName: "depositBudget",
      args: [encryptedAmount, inputProof],
    });
    setTxHash(hash);
    return hash;
  }

  async function startCycle(rosterHash) {
    const hash = await writeContractAsync({
      ...contractConfig,
      functionName: "startCycle",
      args: [rosterHash],
    });
    setTxHash(hash);
    return hash;
  }

  async function completeCycle(cycleId, encryptedTotal, inputProof) {
    const hash = await writeContractAsync({
      ...contractConfig,
      functionName: "completeCycle",
      args: [BigInt(cycleId), encryptedTotal, inputProof],
    });
    setTxHash(hash);
    return hash;
  }

  async function authorizeServicePayment(encryptedAmount, inputProof, cycleId, serviceId) {
    const hash = await writeContractAsync({
      ...contractConfig,
      functionName: "authorizeServicePayment",
      args: [encryptedAmount, inputProof, BigInt(cycleId), serviceId],
    });
    setTxHash(hash);
    return hash;
  }

  async function publishBudgetHandles() {
    const hash = await writeContractAsync({
      ...contractConfig,
      functionName: "requestBudgetDecryption",
      args: [],
    });
    setTxHash(hash);
    return hash;
  }

  async function requestBudgetDecryption() {
    if (!publicClient) {
      throw new Error("Wallet RPC client is not ready yet");
    }

    const publishHash = await publishBudgetHandles();
    await publicClient.waitForTransactionReceipt({ hash: publishHash });

    const [budgetHandle, spentHandle] = await Promise.all([
      publicClient.readContract({
        ...contractConfig,
        functionName: "getEncryptedBudget",
      }),
      publicClient.readContract({
        ...contractConfig,
        functionName: "getEncryptedSpent",
      }),
    ]);

    const decryption = await publicDecryptHandles([budgetHandle, spentHandle]);
    const budget = BigInt(getPublicClearValue(decryption, budgetHandle));
    const spent = BigInt(getPublicClearValue(decryption, spentHandle));

    const finalizeHash = await writeContractAsync({
      ...contractConfig,
      functionName: "finalizeBudgetDecryption",
      args: [budget, spent, decryption.decryptionProof],
    });

    setTxHash(finalizeHash);
    await publicClient.waitForTransactionReceipt({ hash: finalizeHash });

    return {
      publishHash,
      finalizeHash,
      budget,
      spent,
    };
  }

  async function refetchAll() {
    await Promise.all([
      refetchCycleCount(),
      refetchAgentActive(),
      refetchBudget(),
      refetchSpent(),
    ]);
  }

  return {
    cycleCount,
    agentActive,
    lastDecryptedBudget,
    lastDecryptedSpent,
    ownerAddress,
    agentAddress,
    txHash,
    txPending,
    txSuccess,
    depositBudget,
    startCycle,
    completeCycle,
    authorizeServicePayment,
    publishBudgetHandles,
    requestBudgetDecryption,
    refetchAll,
    utilizationPct:
      lastDecryptedBudget && lastDecryptedSpent && lastDecryptedBudget > 0n
        ? Number((lastDecryptedSpent * 100n) / lastDecryptedBudget)
        : 0,
    hasContract: !!CONTRACTS.AgentVault.address,
  };
}
