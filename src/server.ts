import express from "express";
import cors from "cors";
import { CONFIG } from "./config.js";
import { tools } from "./tools.js";
import { SSEServer } from "@modelcontextprotocol/sdk/server/sse";
import { z } from "zod";

/**
 * We expose MCP over Server-Sent Events (SSE) at /sse, protected by a simple Bearer token.
 * Most MCP clients (Claude Desktop, ChatGPT MCP) can connect to this URL.
 */

const app = express();
app.use(cors());
app.use(express.json());

// health
app.get("/", (_req, res) => res.json({ ok: true, service: "mcp-odoo-helpdesk" }));

// optional: require bearer token on SSE
function authCheck(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!CONFIG.AUTH_TOKEN) return next();
  const h = req.header("authorization") || "";
  if (h === `Bearer ${CONFIG.AUTH_TOKEN}`) return next();
  res.status(401).json({ error: "unauthorized" });
}

const server = new SSEServer({
  name: "odoo-helpdesk-mcp",
  version: "1.0.0",
  // advertise the tools
  tools: tools.map(t => ({
    name: t.name,
    description: t.description,
    inputSchema: zodToJsonSchema(t.inputSchema)
  })),
  // how to run a tool call
  onCallTool: async ({ name, arguments: args }) => {
    const tool = tools.find(t => t.name === name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    const parsed = tool.inputSchema.parse(args || {});
    const result = await tool.handler(parsed);
    return { content: [{ type: "json", data: result }] };
  }
});

// SSE endpoint
app.get("/sse", authCheck, async (req, res) => {
  await server.handle(req, res);
});

app.listen(CONFIG.PORT, () => {
  console.log(`[mcp] listening on :${CONFIG.PORT} at /sse`);
});

/** helper to turn zod schema into JSON schema the MCP SDK expects */
function zodToJsonSchema(schema: z.ZodTypeAny): any {
  // very light conversion: MCP SDK accepts a subset; for full fidelity consider zod-to-json-schema pkg.
  // Here we rely on the SDK accepting Zod object via schema introspection. If needed, you can swap in:
  //   import z2j from "zod-to-json-schema"
  //   return z2j(schema, "InputSchema")
  // But to keep deps minimal, we'll just return a placeholder and the SDK will use Zod validation.
  return schema; // SDK accepts zod in recent versions
}
