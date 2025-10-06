import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { tools } from "./tools.js";
import { SSEServer } from "@modelcontextprotocol/sdk/server/sse";
import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "mcp-odoo-helpdesk" });
});

// auth gate for SSE (optional but recommended)
function authCheck(req: Request, res: Response, next: NextFunction) {
  if (!CONFIG.AUTH_TOKEN) return next();
  const h = req.header("authorization") || "";
  if (h === `Bearer ${CONFIG.AUTH_TOKEN}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

const server = new SSEServer({
  name: "odoo-helpdesk-mcp",
  version: "1.0.0",
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema as z.ZodTypeAny)
  })),
  onCallTool: async ({ name, arguments: args }: any) => {
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    const parsed = (tool.inputSchema as z.ZodTypeAny).parse(args || {});
    const result = await tool.handler(parsed as any);
    return { content: [{ type: "json", data: result }] };
  }
});

// SSE endpoint
app.get("/sse", authCheck, async (req: Request, res: Response) => {
  await server.handle(req, res);
});

app.listen(CONFIG.PORT, () => {
  console.log(`[mcp] listening on :${CONFIG.PORT} at /sse`);
});
