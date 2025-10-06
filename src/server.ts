import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { z } from "zod";

import { CONFIG } from "./config.js";
import { tools } from "./tools.js";

// ✅ Official SDK server + HTTP transport
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const mcp = new McpServer({
  name: "odoo-helpdesk-mcp",
  version: "1.0.0"
});

// Register our tools with the MCP server
for (const t of tools) {
  // Ensure we have a ZodObject and extract its shape (what the SDK typing wants)
  const schemaObj = t.inputSchema as z.ZodObject<any>;
  const inputShape = schemaObj.shape;

  mcp.registerTool(
    t.name,
    {
      title: t.name,
      description: t.description,
      // SDK typing expects a ZodRawShape (the object "shape"), not a full Zod schema
      inputSchema: inputShape
    },
    // SDK expects (args, extra) or (extra). Provide both to satisfy the type.
    async (args: Record<string, any>, _extra: any) => {
      // Rebuild a ZodObject from the shape and validate inputs
      const parsed = z.object(inputShape).parse(args ?? {});
      // Treat every handler uniformly as (any) => any to avoid union narrowing issues
      const result = await (t.handler as (input: any) => any)(parsed);

      // Return text content + structured JSON. Cast to "any" to satisfy the content union type.
      return {
        content: [
          { type: "text", text: JSON.stringify(result, null, 2) } as any
        ] as any,
        structuredContent: result
      } as any;
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

// Simple auth gate (works even if AUTH_TOKEN is empty/disabled)
function authCheck(req: Request, res: Response, next: NextFunction) {
  if (!CONFIG.AUTH_TOKEN) return next(); // no auth
  const hdr = req.header("authorization") || "";
  const qp = (req.query?.token as string) || "";
  const ok = hdr === `Bearer ${CONFIG.AUTH_TOKEN}` || qp === CONFIG.AUTH_TOKEN;
  if (ok) return next();
  res.status(401).json({ error: "unauthorized" });
}

// CORS preflight for the endpoints
app.options(["/mcp", "/sse"], cors());

// ✅ Official Streamable HTTP endpoint: POST /mcp
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

// 🔁 Backwards-compat alias: allow clients pointing at /sse to work too
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
