# MCP Odoo Helpdesk (Railway)

An MCP server exposing Odoo Helpdesk tools over SSE for ChatGPT or Claude Desktop.

## Env Vars (set in Railway)

- `PORT` (Railway sets automatically)
- `ODOO_URL` = https://odoo.cycle.eco
- `ODOO_USERNAME` = (your Odoo login)
- `ODOO_PASSWORD` = (your Odoo password)
- `ODOO_DB` = (optional; leave blank if not needed)
- `TEAM_ID` = 17
- `AUTH_TOKEN` = (set any random long string; you’ll put same in the MCP client config)

## Build & Run locally

```bash
npm i
npm run build
PORT=3000 ODOO_URL=https://odoo.cycle.eco ODOO_USERNAME="..." ODOO_PASSWORD="..." TEAM_ID=17 AUTH_TOKEN="supersecret" npm start
