import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

await import("./roster-api/index.js");
await import("./compliance-api/index.js");
await import("./disburse-api/index.js");
await import("./agent-api/index.js");

const app = express();
const PORT = Number(process.env.PORT || 8080);

const targets = [
  { prefix: "/api/roster", target: "http://127.0.0.1:3001", service: "RosterAPI" },
  { prefix: "/api/compliance", target: "http://127.0.0.1:3002", service: "ComplianceAPI" },
  { prefix: "/api/disburse", target: "http://127.0.0.1:3003", service: "DisbursAPI" },
  { prefix: "/api/agent", target: "http://127.0.0.1:3004", service: "PayrollAgent" },
];

app.use(cors({ origin: "*" }));
app.use(express.raw({ type: "*/*", limit: "10mb" }));

app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "GhostPay services gateway",
    routes: targets.map(({ prefix, service }) => ({ prefix, service })),
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "GhostPay services gateway",
    status: "online",
    routes: targets.map(({ prefix, service }) => ({ prefix, service })),
  });
});

function copyResponseHeaders(source, res) {
  source.headers.forEach((value, key) => {
    if (["connection", "content-encoding", "transfer-encoding"].includes(key.toLowerCase())) return;
    res.setHeader(key, value);
  });
}

function createForwardHeaders(req) {
  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (["host", "connection", "content-length"].includes(key.toLowerCase())) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else if (value) {
      headers.set(key, value);
    }
  }

  return headers;
}

function mountProxy({ prefix, target, service }) {
  app.use(prefix, async (req, res) => {
    const forwardedPath = req.originalUrl.slice(prefix.length) || "/";
    const targetUrl = `${target}${forwardedPath.startsWith("/") ? forwardedPath : `/${forwardedPath}`}`;

    try {
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: createForwardHeaders(req),
        body: ["GET", "HEAD"].includes(req.method) ? undefined : req.body,
      });

      copyResponseHeaders(response, res);
      res.status(response.status);

      const body = Buffer.from(await response.arrayBuffer());
      res.send(body);
    } catch (err) {
      res.status(502).json({
        ok: false,
        service: "GhostPay services gateway",
        upstream: service,
        error: err.message,
      });
    }
  });
}

targets.forEach(mountProxy);

app.listen(PORT, () => {
  console.log("");
  console.log("[Gateway] ----------------------------------------");
  console.log(`[Gateway] Running on Render port ${PORT}`);
  for (const { prefix, service } of targets) {
    console.log(`[Gateway] ${prefix.padEnd(16)} -> ${service}`);
  }
  console.log("[Gateway] ----------------------------------------");
  console.log("");
});
