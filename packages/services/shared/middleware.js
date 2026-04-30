import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";
import { isLiveMode } from "./env.js";

const X402_NETWORK = process.env.X402_NETWORK || "eip155:84532";
const X402_FACILITATOR_URL =
  process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

export const publicClient = createPublicClient({
  chain: sepolia,
  transport: http(process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org"),
});

export function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...data,
  });
}

export function error(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    ok: false,
    error: message,
    timestamp: new Date().toISOString(),
  });
}

function decodeDemoPayment(header) {
  try {
    return JSON.parse(Buffer.from(header, "base64").toString("utf8"));
  } catch {
    return { raw: header };
  }
}

export function createX402Middleware({
  method,
  path,
  price,
  payTo,
  description,
  serviceName,
  port,
}) {
  if (isLiveMode()) {
    const facilitator = new HTTPFacilitatorClient({ url: X402_FACILITATOR_URL });
    const resourceServer = new x402ResourceServer(facilitator).register(
      X402_NETWORK,
      new ExactEvmScheme(),
    );

    return paymentMiddleware(
      {
        [`${method.toUpperCase()} ${path}`]: {
          accepts: {
            scheme: "exact",
            price,
            network: X402_NETWORK,
            payTo,
          },
          description,
        },
      },
      resourceServer,
    );
  }

  return (req, res, next) => {
    const paymentHeader =
      req.headers["payment-signature"] ||
      req.headers["PAYMENT-SIGNATURE"] ||
      req.headers["x-payment"];

    if (!paymentHeader) {
      return res.status(402).json({
        error: "Payment Required",
        x402Version: 2,
        accepts: [
          {
            scheme: "exact",
            price,
            network: X402_NETWORK,
            payTo,
            resource: `http://localhost:${port}${req.originalUrl || req.path}`,
            description,
            mimeType: "application/json",
            maxTimeoutSeconds: 300,
            extra: {
              service: serviceName,
              demoMode: true,
            },
          },
        ],
      });
    }

    req.paymentVerified = true;
    req.payment = decodeDemoPayment(paymentHeader);
    next();
  };
}

export function paymentSummary(amount, price) {
  return {
    paid: true,
    x402Version: 2,
    network: X402_NETWORK,
    amount,
    price,
    currency: "USDC",
    mode: isLiveMode() ? "live" : "demo",
  };
}

export function requestLogger(serviceName) {
  return (req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      const hasPayment =
        req.headers["payment-signature"] ||
        req.headers["PAYMENT-SIGNATURE"] ||
        req.headers["x-payment"];
      const payment = hasPayment ? "$ PAID" : "      ";
      console.log(
        `[${serviceName}] ${payment} ${req.method} ${req.path} -> ${res.statusCode} (${duration}ms)`,
      );
    });
    next();
  };
}

export function isValidAddress(addr) {
  return addr && /^0x[0-9a-fA-F]{40}$/.test(addr);
}
