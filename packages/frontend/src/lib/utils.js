import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Format an Ethereum address for display
export function formatAddress(address, chars = 6) {
  if (!address) return "";
  return `${address.slice(0, chars)}...${address.slice(-4)}`;
}

// Format a number as USDC
export function formatUSDC(microUnits) {
  if (microUnits === undefined || microUnits === null) return "—";
  const value = Number(microUnits) / 1_000_000;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

// Format timestamp to relative time
export function formatRelativeTime(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

// Truncate ciphertext for display
export function truncateHex(hex, chars = 8) {
  if (!hex) return "0x...";
  const clean = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (clean.length <= chars * 2 + 2) return clean;
  return `${clean.slice(0, chars + 2)}...${clean.slice(-6)}`;
}

// Sleep helper
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
