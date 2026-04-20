/**
 * Tool definitions for the support chatbot. These are shipped verbatim to
 * the Anthropic API as the `tools` array. Keeping them in one module so the
 * route and the handlers can both reference the same source of truth.
 */
import type Anthropic from "@anthropic-ai/sdk";

export const SUPPORT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "get_user_context",
    description:
      "Get the current user's role, org name, org ID, what page they are on, and whether they're in an impersonation session. Call this first if any user-specific or page-specific context would help answer the question.",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_invoice",
    description:
      "Fetch details of a specific invoice by UUID or invoice number. Returns vendor, amount, status, allocations, and job context. Use when the user mentions an invoice by number or when they're on an invoice detail page.",
    input_schema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Invoice UUID or invoice_number",
        },
      },
      required: ["identifier"],
    },
  },
  {
    name: "get_job",
    description:
      "Fetch details of a specific job by UUID or name. Returns name, address, contract value, approved change orders, billed to date, percent complete, and active invoice count. Use when the user mentions a specific job.",
    input_schema: {
      type: "object",
      properties: {
        identifier: {
          type: "string",
          description: "Job UUID or partial name match",
        },
      },
      required: ["identifier"],
    },
  },
  {
    name: "search_recent_activity",
    description:
      "Search the user's recent activity (last N actions, default 10). Use when the user asks 'what did I just do' or 'I changed something and now X is wrong'.",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Number of recent actions to return. Default 10, max 25.",
        },
      },
      required: [],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate this conversation to human support. Use when the user explicitly asks for a human, OR when you cannot help after a genuine attempt (billing disputes, data corruption, missing features).",
    input_schema: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Short reason why we're escalating — one sentence is fine.",
        },
      },
      required: ["reason"],
    },
  },
];

export type ToolName = (typeof SUPPORT_TOOLS)[number]["name"];
