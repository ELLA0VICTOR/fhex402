export function isLiveMode() {
  return process.env.DEMO_MODE === "false" || process.env.X402_LIVE === "true";
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

export function requireAddress(name) {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed EVM address`);
  }
  return value;
}

export function requirePrivateKey(name) {
  const value = requireEnv(name);
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed 32-byte private key`);
  }
  return value;
}

export function optionalAddress(name, fallback) {
  const value = process.env[name]?.trim() || fallback;
  if (!value) return value;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) {
    throw new Error(`${name} must be a 0x-prefixed EVM address`);
  }
  return value;
}
