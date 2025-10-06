import axios, { AxiosInstance } from "axios";
import { CONFIG } from "./config.js";

type JsonRpcRequest = {
  jsonrpc: "2.0";
  method: "call";
  params: any;
  id: number;
};

type JsonRpcResponse<T> = {
  jsonrpc: "2.0";
  id: number;
  result?: T;
  error?: { code: number; message: string; data?: any };
};

export class OdooClient {
  private http: AxiosInstance;
  private sid: string | null = null;

  constructor(private baseUrl: string, private db: string | null = null) {
    this.http = axios.create({
      baseURL: baseUrl,
      headers: { "Content-Type": "application/json" },
      // Keep cookies for session persistence
      withCredentials: true,
      validateStatus: () => true
    });
  }

  async authenticate(username: string, password: string) {
    // standard Odoo /web/session/authenticate call
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        db: this.db || undefined,
        login: username,
        password
      },
      id: Date.now()
    };

    const res = await this.http.post<JsonRpcResponse<any>>("/web/session/authenticate", payload);
    if (res.status !== 200 || res.data.error) {
      throw new Error(`Odoo auth failed: ${res.data.error?.message || res.statusText}`);
    }

    // Extract session cookie
    const setCookie = res.headers["set-cookie"] || [];
    const sessionCookie = setCookie.find((c: string) => /session_id=/.test(c));
    if (!sessionCookie) throw new Error("Missing Odoo session cookie");
    const m = sessionCookie.match(/session_id=([^;]+)/);
    if (!m) throw new Error("Unable to parse session cookie");
    this.sid = m[1];

    // include cookie for future calls
    this.http.defaults.headers.Cookie = `session_id=${this.sid}`;
  }

  private async callKw(model: string, method: string, args: any[], kwargs: any = {}) {
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      method: "call",
      params: {
        model,
        method,
        args,
        kwargs
      },
      id: Date.now()
    };
    const res = await this.http.post<JsonRpcResponse<any>>("/web/dataset/call_kw", payload);
    if (res.status !== 200 || res.data.error) {
      const msg = res.data.error?.message || res.statusText;
      throw new Error(`Odoo call_kw ${model}.${method} failed: ${msg}`);
    }
    return res.data.result;
  }

  // ===== HELPERS FOR HELP DESK =====

  async listTickets({
    limit = 20,
    offset = 0,
    domain = []
  }: {
    limit?: number;
    offset?: number;
    domain?: any[];
  }) {
    // model name may vary by Odoo version: commonly 'helpdesk.ticket'
    return this.callKw("helpdesk.ticket", "search_read", [[...domain], ["id","name","stage_id","team_id","ticket_category","partner_id","email","description","create_date","write_date"], {limit, offset, order: "create_date desc"}]);
  }

  async getTicket(id: number) {
    const res = await this.callKw("helpdesk.ticket", "read", [[id], ["id","name","stage_id","team_id","ticket_category","partner_id","email","description","create_date","write_date","message_ids"]]);
    return res?.[0] || null;
  }

  async createTicket({
    name,
    description,
    email,
    partner_id,
    ticket_category,
    stage_id,
    team_id
  }: {
    name: string;
    description?: string;
    email?: string;
    partner_id?: number;
    ticket_category?: string;
    stage_id?: number;
    team_id: number;
  }) {
    const vals: any = { name, team_id: team_id };
    if (description) vals.description = description;
    if (email) vals.email = email;
    if (partner_id) vals.partner_id = partner_id;
    if (ticket_category) vals.ticket_category = ticket_category;
    if (stage_id) vals.stage_id = stage_id;

    const id = await this.callKw("helpdesk.ticket", "create", [[vals]]);
    return id;
  }

  async updateTicket(id: number, updates: Record<string, any>) {
    const ok = await this.callKw("helpdesk.ticket", "write", [[id], updates]);
    return !!ok;
  }

  async addMessage(id: number, bodyHtml: string) {
    // post a message on the ticket (chatter)
    return this.callKw("mail.thread", "message_post", [[["helpdesk.ticket", id]], {
      body: bodyHtml,
      message_type: "comment",
      subtype_xmlid: "mail.mt_comment"
    }]);
  }
}

// factory
export async function getOdoo(): Promise<OdooClient> {
  const client = new OdooClient(CONFIG.ODOO_URL, CONFIG.ODOO_DB || null);
  await client.authenticate(CONFIG.ODOO_USERNAME, CONFIG.ODOO_PASSWORD);
  return client;
}
