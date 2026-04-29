// x402 client for the browser demo payroll agent.
// The real x402 signer should run agent-side/server-side, where a private key is safe.

const X402_VERSION = 2;
const DEFAULT_NETWORK = "eip155:84532";

function base64Json(value) {
  const json = JSON.stringify(value);
  const bytes = new TextEncoder().encode(json);
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function buildDemoPaymentSignature(paymentInfo) {
  return base64Json({
    x402Version: X402_VERSION,
    scheme: paymentInfo.scheme || "exact",
    network: paymentInfo.network || DEFAULT_NETWORK,
    resource: paymentInfo.resource,
    payload: {
      demo: true,
      from: paymentInfo.from || "0x0000000000000000000000000000000000000000",
      to: paymentInfo.payTo,
      price: paymentInfo.price,
      validBefore: String(Math.floor(Date.now() / 1000) + 300),
      nonce: crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`,
    },
  });
}

export async function x402Fetch(url, options = {}, walletAddress) {
  const response = await fetch(url, options);

  if (response.status !== 402) {
    return response;
  }

  const paymentReq = await response.json();
  const accepts = paymentReq.accepts?.[0];

  if (!accepts) {
    throw new Error("x402: no payment requirements in 402 response");
  }

  console.log(
    `[x402] V2 402 received; paying ${accepts.price || accepts.maxAmountRequired} to ${accepts.payTo}`,
  );

  const paymentSignature = buildDemoPaymentSignature({
    from: walletAddress,
    payTo: accepts.payTo,
    price: accepts.price || accepts.maxAmountRequired,
    network: accepts.network,
    resource: accepts.resource || url,
    scheme: accepts.scheme,
  });

  const paidResponse = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      "PAYMENT-SIGNATURE": paymentSignature,
    },
  });

  console.log(`[x402] V2 payment signature sent; response: ${paidResponse.status}`);
  return paidResponse;
}

export const SERVICES = {
  roster: {
    id: 0,
    name: "RosterAPI",
    endpoint: "/api/roster/roster",
    healthEndpoint: "/api/roster/health",
    description: "Encrypted employee roster for current pay cycle",
    cost: "$0.10 USDC",
    costMicro: 100000,
    icon: "roster",
    port: 3001,
  },
  compliance: {
    id: 1,
    name: "ComplianceAPI",
    endpoint: "/api/compliance/check",
    healthEndpoint: "/api/compliance/health",
    description: "Jurisdiction, eligibility and tax band validation",
    cost: "$0.25 USDC",
    costMicro: 250000,
    icon: "compliance",
    port: 3002,
  },
  disburse: {
    id: 2,
    name: "DisbursAPI",
    endpoint: "/api/disburse/disburse",
    healthEndpoint: "/api/disburse/health",
    description: "Encrypted batch salary disbursement execution",
    cost: "$0.50 USDC",
    costMicro: 500000,
    icon: "disburse",
    port: 3003,
  },
};

export async function checkServicesHealth() {
  const results = {};

  for (const [key, service] of Object.entries(SERVICES)) {
    try {
      const res = await fetch(service.healthEndpoint, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      results[key] = {
        online: data.ok !== false && data.status === "online",
        ...data,
      };
    } catch (err) {
      results[key] = {
        online: false,
        error: err.message,
      };
    }
  }

  return results;
}
