export const CONFIG = {
    PORT: parseInt(process.env.PORT || "3000", 10),
    ODOO_URL: process.env.ODOO_URL || "https://odoo.cycle.eco",
    ODOO_USERNAME: process.env.ODOO_USERNAME || "",
    ODOO_PASSWORD: process.env.ODOO_PASSWORD || "",
    ODOO_DB: process.env.ODOO_DB || "", // leave blank if single-db domain resolves automatically
    TEAM_ID: parseInt(process.env.TEAM_ID || "17", 10),
    // simple bearer token to restrict who can connect to your MCP over SSE
    AUTH_TOKEN: process.env.AUTH_TOKEN || ""
  };
  
  if (!CONFIG.ODOO_USERNAME || !CONFIG.ODOO_PASSWORD) {
    // we don't throw here; Railway will set them. tools will error gracefully if missing.
    console.warn("[warn] Odoo credentials not set yet (ODOO_USERNAME/ODOO_PASSWORD).");
  }
  