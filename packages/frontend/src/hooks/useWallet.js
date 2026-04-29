import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from "wagmi";
import { sepolia } from "wagmi/chains";
import { SEPOLIA_CHAIN_ID } from "@/constants";

export function useWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const isCorrectChain = chainId === SEPOLIA_CHAIN_ID;

  function connectWallet() {
    const connector = connectors.find((c) => c.id === "metaMask") || connectors[0];
    if (connector) connect({ connector });
  }

  function switchToSepolia() {
    switchChain({ chainId: sepolia.id });
  }

  return {
    address,
    isConnected,
    isConnecting: isConnecting || isPending,
    isCorrectChain,
    chainId,
    connect: connectWallet,
    disconnect,
    switchToSepolia,
    connectors,
  };
}
