import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { z } from "zod";

import { CONFIG } from "./config.js";
import { tools } from "./tools.js";

// ✅ Official SDK server + HTTP transport (no separate SSE package!)
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

// Create one MCP server instance
const mcp = new McpServer({
  name: "odoo-helpdesk-mcp",
  version: "1.0.0"
});

// Register our tools with the MCP server
// Register our tools with the MCP server
for (const t of tools) {
  // Ensure we have a ZodObject and extract its shape (what the SDK typing expects)
  const schemaObj = t.inputSchema as z.ZodObject<any>;
  const inputShape = schemaObj.shape;

  mcp.registerTool(
    t.name,
    {
      title: t.name,
      description: t.description,
      // <-- pass the shape instead of the whole Zod schema
      inputSchema: inputShape
    },
    async (args: any) => {
      // Rebuild a ZodObject from the shape to validate inputs
      const parsed = z.object(inputShape).parse(args || {});
      const result = await t.handler(parsed);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result
      };
    }
  );
}


const app = express();
app.use(cors());
app.use(express.json());

// Health
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "mcp-odoo-helpdesk" });
});

// Simple auth gate (kept, even if AUTH_TOKEN is empty)
function authCheck(req: Request, res: Response, next: NextFunction) {
  if (!CONFIG.AUTH_TOKEN) return next(); // no auth
  const hdr = req.header("authorization") || "";
  const qp = (req.query?.token as string) || "";
  const ok = hdr === `Bearer ${CONFIG.AUTH_TOKEN}` || qp === CONFIG.AUTH_TOKEN;
  if (ok) return next();
  res.status(401).json({ error: "unauthorized" });
}

// CORS preflight for the endpoint
app.options(["/mcp", "/sse"], cors());

// ✅ Streamable HTTP endpoint (official): POST /mcp
app.post("/mcp", authCheck, async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

// 🔁 Backwards-compat alias: allow clients that point at /sse to work too
app.post("/sse", authCheck, async (req: Request, res: Response) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await mcp.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("Error handling MCP request:", err);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null
      });
    }
  }
});

app.listen(CONFIG.PORT, () => {
  console.log(`[mcp] listening on :${CONFIG.PORT} at POST /mcp (and /sse alias)`);
});
