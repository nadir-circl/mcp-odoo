import { z } from "zod";
import { getOdoo } from "./odoo.js";
import { CONFIG } from "./config.js";
import { STAGES, toCategoryDbValue } from "./mappings.js";

export const tools = [
  {
    name: "helpdesk_list_tickets",
    description: "List recent helpdesk tickets. Optional filters by stage_id, category db value, email, or search by name.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(100).default(20).optional(),
      offset: z.number().int().min(0).default(0).optional(),
      stage_id: z.number().int().optional(),
      category_name: z.string().optional(),
      email: z.string().optional(),
      name_search: z.string().optional()
    }),
    handler: async (input: any) => {
      const odoo = await getOdoo();
      const domain: any[] = [["team_id", "=", CONFIG.TEAM_ID]];
      if (input.stage_id) domain.push(["stage_id", "=", input.stage_id]);
      if (input.category_name) {
        const dbv = toCategoryDbValue(input.category_name);
        if (!dbv) throw new Error("Unknown category_name");
        domain.push(["ticket_category", "=", dbv]);
      }
      if (input.email) domain.push(["email", "ilike", input.email]);
      if (input.name_search) domain.push(["name", "ilike", input.name_search]);

      const recs = await odoo.listTickets({ limit: input.limit, offset: input.offset, domain });
      return recs;
    }
  },
  {
    name: "helpdesk_get_ticket",
    description: "Get a single helpdesk ticket by id.",
    inputSchema: z.object({ id: z.number().int() }),
    handler: async ({ id }: { id: number }) => {
      const odoo = await getOdoo();
      const rec = await odoo.getTicket(id);
      if (!rec) throw new Error(`Ticket ${id} not found`);
      return rec;
    }
  },
  {
    name: "helpdesk_create_ticket",
    description: "Create a helpdesk ticket in team 17. Category name must be one of the five official names.",
    inputSchema: z.object({
      name: z.string(),
      description: z.string().optional(),
      email: z.string().email().optional(),
      partner_id: z.number().int().optional(),
      category_name: z.string().optional(),
      stage: z.enum(["New","In Progress","Waiting on Customer","Solved"]).optional()
    }),
    handler: async (input: any) => {
      const odoo = await getOdoo();
      const ticket_category = input.category_name ? toCategoryDbValue(input.category_name) : undefined;
      const stage_id = input.stage ? ({
        "New": STAGES.NEW,
        "In Progress": STAGES.IN_PROGRESS,
        "Waiting on Customer": STAGES.WAITING_ON_CUSTOMER,
        "Solved": STAGES.SOLVED
      } as const)[input.stage] : undefined;

      const id = await odoo.createTicket({
        name: input.name,
        description: input.description,
        email: input.email,
        partner_id: input.partner_id,
        ticket_category,
        stage_id,
        team_id: CONFIG.TEAM_ID
      });
      return { id };
    }
  },
  {
    name: "helpdesk_update_ticket",
    description: "Update fields on a ticket: stage, category (by name), description, email, etc.",
    inputSchema: z.object({
      id: z.number().int(),
      stage: z.enum(["New","In Progress","Waiting on Customer","Solved"]).optional(),
      category_name: z.string().optional(),
      description: z.string().optional(),
      email: z.string().email().optional(),
      name: z.string().optional()
    }),
    handler: async (input: any) => {
      const odoo = await getOdoo();
      const updates: Record<string, any> = {};
      if (input.stage) {
        updates.stage_id = ({
          "New": STAGES.NEW,
          "In Progress": STAGES.IN_PROGRESS,
          "Waiting on Customer": STAGES.WAITING_ON_CUSTOMER,
          "Solved": STAGES.SOLVED
        } as const)[input.stage];
      }
      if (input.category_name) {
        const dbv = toCategoryDbValue(input.category_name);
        if (!dbv) throw new Error("Unknown category_name");
        updates.ticket_category = dbv;
      }
      if (typeof input.description === "string") updates.description = input.description;
      if (typeof input.email === "string") updates.email = input.email;
      if (typeof input.name === "string") updates.name = input.name;

      const ok = await odoo.updateTicket(input.id, updates);
      return { success: ok };
    }
  },
  {
    name: "helpdesk_add_message",
    description: "Add a comment to the chatter of a ticket (HTML allowed).",
    inputSchema: z.object({
      id: z.number().int(),
      bodyHtml: z.string()
    }),
    handler: async ({ id, bodyHtml }: any) => {
      const odoo = await getOdoo();
      const r = await odoo.addMessage(id, bodyHtml);
      return r;
    }
  }
];
