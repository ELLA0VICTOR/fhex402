import { useState, useEffect } from "react";
import { getFhevmInstance, encryptUint64, isFhevmAvailable } from "@/lib/fhevm";

export function useFhevm() {
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function init() {
      try {
        const inst = await getFhevmInstance();
        if (mounted) {
          setInstance(inst);
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.warn("[useFhevm] FHEVM not available:", err.message);
          setError(err.message);
          setLoading(false);
        }
      }
    }
    init();
    return () => { mounted = false; };
  }, []);

  const encrypt64 = async (value, contractAddress, userAddress) => {
    if (!instance) throw new Error("FHEVM not initialized");
    return encryptUint64(value, contractAddress, userAddress);
  };

  return {
    instance,
    loading,
    error,
    available: !!instance,
    encrypt64,
  };
}
