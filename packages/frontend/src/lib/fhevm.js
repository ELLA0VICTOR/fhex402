import { isHex, toHex } from "viem";

let fhevmInstance = null;
let initPromise = null;
let sdkReady = false;
let relayerSdk = null;

async function getRelayerSdk() {
  if (!relayerSdk) {
    relayerSdk = await import("@zama-fhe/relayer-sdk/web");
  }
  return relayerSdk;
}

function getNetworkProvider() {
  if (typeof window !== "undefined" && window.ethereum) {
    return window.ethereum;
  }

  return import.meta.env.VITE_SEPOLIA_RPC_URL || "https://rpc.sepolia.org";
}

export function toHexValue(value) {
  if (!value) return value;

  if (typeof value === "string") {
    return isHex(value) ? value : `0x${value}`;
  }

  if (value instanceof Uint8Array) {
    return toHex(value);
  }

  if (value instanceof ArrayBuffer) {
    return toHex(new Uint8Array(value));
  }

  if (Array.isArray(value)) {
    return toHex(new Uint8Array(value));
  }

  return value;
}

async function ensureSdkReady() {
  if (sdkReady) return;
  const { initSDK } = await getRelayerSdk();
  sdkReady = await initSDK();
}

export async function getFhevmInstance() {
  if (fhevmInstance) return fhevmInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await ensureSdkReady();
    const { createInstance, SepoliaConfig } = await getRelayerSdk();

    fhevmInstance = await createInstance({
      ...SepoliaConfig,
      network: getNetworkProvider(),
    });

    console.log("[fhevm] Relayer SDK instance initialized");
    return fhevmInstance;
  })();

  return initPromise;
}

export async function encryptUint64(value, contractAddress, userAddress) {
  const instance = await getFhevmInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add64(BigInt(value));

  const encrypted = await input.encrypt();
  return {
    handles: encrypted.handles.map(toHexValue),
    inputProof: toHexValue(encrypted.inputProof),
  };
}

export async function encryptUint32(value, contractAddress, userAddress) {
  const instance = await getFhevmInstance();
  const input = instance.createEncryptedInput(contractAddress, userAddress);
  input.add32(Number(value));

  const encrypted = await input.encrypt();
  return {
    handles: encrypted.handles.map(toHexValue),
    inputProof: toHexValue(encrypted.inputProof),
  };
}

export async function publicDecryptHandles(handles) {
  const instance = await getFhevmInstance();
  return instance.publicDecrypt(handles.map(toHexValue));
}

export function getPublicClearValue(decryptionResult, handle) {
  const clearValues = decryptionResult?.clearValues || {};
  const target = String(toHexValue(handle)).toLowerCase();
  const match = Object.entries(clearValues).find(
    ([candidate]) => candidate.toLowerCase() === target,
  );

  if (!match) {
    throw new Error(`Public decrypt result missing handle ${formatCiphertext(handle)}`);
  }

  return match[1];
}

export function formatCiphertext(ciphertext) {
  if (!ciphertext) return "0x...";
  const clean = String(toHexValue(ciphertext));
  if (clean.length <= 16) return clean;
  return `${clean.slice(0, 10)}...${clean.slice(-6)}`;
}

export function demoEncryptedValue(seed) {
  const chars = "0123456789abcdef";
  let result = "0x";
  const seedHash = seed
    .split("")
    .reduce((acc, c) => acc + c.charCodeAt(0), 0);

  for (let i = 0; i < 64; i++) {
    result += chars[(seedHash * (i + 1) * 31337) % 16];
  }

  return result;
}

export async function isFhevmAvailable() {
  try {
    await getFhevmInstance();
    return true;
  } catch {
    return false;
  }
}
