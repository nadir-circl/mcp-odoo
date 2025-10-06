import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

import { CONFIG } from "./config.js";
import { getOdoo } from "./odoo.js";
import { fromCategoryDbValue } from "./mappings.js";

type Many2OneTuple = [number, string];

type TicketRecord = {
  id: number;
  name: string;
  stage_id?: Many2OneTuple;
  ticket_category?: string | Many2OneTuple | null;
  email?: string | null;
  create_date?: string;
  write_date?: string;
};

function summarizeTicket(ticket: TicketRecord): string {
  const stageName = Array.isArray(ticket.stage_id) ? ticket.stage_id[1] : null;
  const rawCategory = Array.isArray(ticket.ticket_category)
    ? ticket.ticket_category[1]
    : ticket.ticket_category;
  const categoryName =
    fromCategoryDbValue(rawCategory) ?? rawCategory ?? "Uncategorized";
  const parts = [
    stageName ? `Stage: ${stageName}` : null,
    categoryName ? `Category: ${categoryName}` : null,
    ticket.email ? `Email: ${ticket.email}` : null,
    ticket.create_date ? `Created: ${ticket.create_date}` : null,
    ticket.write_date ? `Updated: ${ticket.write_date}` : null
  ].filter((part): part is string => Boolean(part));

  return [`Ticket #${ticket.id}: ${ticket.name}`, ...parts].join("\n");
}

export function registerResources(server: McpServer) {
  const ticketTemplate = new ResourceTemplate("helpdesk://tickets/{ticketId}", {
    list: async () => {
      const odoo = await getOdoo();
      const tickets = await odoo.listTickets({
        limit: 20,
        domain: [["team_id", "=", CONFIG.TEAM_ID]]
      });

      return {
        resources: tickets.map((ticket: TicketRecord) => ({
          uri: `helpdesk://tickets/${ticket.id}`,
          name: `Ticket #${ticket.id}`,
          description: summarizeTicket(ticket)
        }))
      };
    },
    complete: {
      ticketId: async (value: string) => {
        const trimmed = value.trim();
        const odoo = await getOdoo();
        const domain: any[] = [["team_id", "=", CONFIG.TEAM_ID]];

        if (trimmed && Number.isNaN(Number(trimmed))) {
          domain.push(["name", "ilike", trimmed]);
        } else if (trimmed) {
          const id = Number.parseInt(trimmed, 10);
          if (!Number.isNaN(id)) {
            domain.push(["id", "=", id]);
          }
        }

        const tickets = await odoo.listTickets({ limit: 5, domain });
        return tickets.map((ticket: TicketRecord) => String(ticket.id));
      }
    }
  });

  server.registerResource(
    "tickets",
    ticketTemplate,
    {
      title: "Helpdesk Tickets",
      description: "Browse recent helpdesk tickets and inspect individual ticket details."
    },
    async (uri, variables) => {
      const ticketIdRaw = variables.ticketId;
      const ticketId = Number.parseInt(String(ticketIdRaw), 10);

      if (!Number.isFinite(ticketId)) {
        throw new Error(`Invalid ticket id: ${ticketIdRaw}`);
      }

      const odoo = await getOdoo();
      const ticket = await odoo.getTicket(ticketId);

      if (!ticket) {
        throw new Error(`Ticket ${ticketId} not found`);
      }

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(ticket, null, 2)
          },
          {
            uri: `${uri.href}#summary`,
            text: summarizeTicket(ticket as TicketRecord)
          }
        ]
      };
    }
  );
}