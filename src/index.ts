import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import TelegramBot from "node-telegram-bot-api";
import express, { Request, Response } from "express";

// Configuration from environment variables
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const PORT = parseInt(process.env.PORT || "3000", 10);
const TRANSPORT_MODE = process.env.TRANSPORT_MODE || "stdio";
const WEBHOOK_URL = process.env.WEBHOOK_URL; // e.g., https://telegram-approval-mcp.onrender.com

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  process.exit(1);
}

// Initialize Telegram bot - webhook mode if WEBHOOK_URL is set, otherwise polling
const useWebhook = TRANSPORT_MODE === "http" && WEBHOOK_URL;
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { 
  polling: !useWebhook 
});
const chatId = TELEGRAM_CHAT_ID;

// Store pending requests
interface PendingRequest {
  resolve: (value: string) => void;
  reject: (reason: Error) => void;
  type: "approval" | "prompt";
  messageId?: number;
}

const pendingRequests = new Map<string, PendingRequest>();

// Queue for incoming messages from user (when they initiate conversation)
interface QueuedMessage {
  id: string;
  text: string;
  timestamp: number;
  isCommand: boolean;
  command?: string;
}
const messageQueue: QueuedMessage[] = [];

// Store active MCP servers for notifications
const activeMcpServers: Set<Server> = new Set();

// Notify all connected MCP clients about new messages
function notifyClientsOfNewMessage(message: QueuedMessage) {
  console.log(`New message queued: ${message.text.substring(0, 50)}...`);
  console.log(`Active MCP servers: ${activeMcpServers.size}`);
  
  // MCP doesn't have built-in push, but we log for debugging
  // Clients should poll get_pending_messages
}

// Process incoming Telegram message
async function processIncomingMessage(msg: TelegramBot.Message) {
  if (msg.chat.id.toString() !== chatId) return;
  if (!msg.text) return;

  const text = msg.text.trim();
  
  // Handle commands
  if (text.startsWith("/")) {
    const parts = text.split(" ");
    const command = parts[0].toLowerCase().split("@")[0];
    const content = parts.slice(1).join(" ");
    
    if (command === "/quest" || command === "/q") {
      const queuedMsg: QueuedMessage = {
        id: `msg_${Date.now()}`,
        text: content || "New Quest requested",
        timestamp: Date.now(),
        isCommand: true,
        command: "quest",
      };
      messageQueue.push(queuedMsg);
      notifyClientsOfNewMessage(queuedMsg);
      await bot.sendMessage(chatId, `Quest queued. Qoder will pick it up.`, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    
    if (command === "/chat" || command === "/c") {
      const queuedMsg: QueuedMessage = {
        id: `msg_${Date.now()}`,
        text: content || "",
        timestamp: Date.now(),
        isCommand: true,
        command: "chat",
      };
      messageQueue.push(queuedMsg);
      notifyClientsOfNewMessage(queuedMsg);
      await bot.sendMessage(chatId, `Message queued for Qoder.`, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    
    if (command === "/help") {
      await bot.sendMessage(chatId, 
        `**Available Commands**\n\n` +
        `/quest <task> or /q <task> - Create a new Quest\n` +
        `/chat <message> or /c <message> - Send message to Qoder\n` +
        `/status - Check queue status\n` +
        `/help - Show this help\n\n` +
        `You can also just type a message and it will be queued for Qoder.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    if (command === "/status") {
      await bot.sendMessage(chatId,
        `**Queue Status**\n\n` +
        `Pending messages: ${messageQueue.length}\n` +
        `Active MCP connections: ${activeMcpServers.size}\n` +
        `Mode: ${useWebhook ? 'Webhook' : 'Polling'}`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    return;
  }

  // Check if there's a pending prompt request
  let handled = false;
  for (const [requestId, pending] of pendingRequests) {
    if (pending.type === "prompt") {
      pending.resolve(text);
      pendingRequests.delete(requestId);
      await bot.sendMessage(chatId, `Received your response.`, {
        reply_to_message_id: msg.message_id,
      });
      handled = true;
      break;
    }
  }
  
  // If no pending prompt, queue the message
  if (!handled) {
    const queuedMsg: QueuedMessage = {
      id: `msg_${Date.now()}`,
      text: text,
      timestamp: Date.now(),
      isCommand: false,
    };
    messageQueue.push(queuedMsg);
    notifyClientsOfNewMessage(queuedMsg);
    await bot.sendMessage(chatId, `Message queued. Qoder will pick it up.`, {
      reply_to_message_id: msg.message_id,
    });
  }
}

// Handle callback queries (button clicks)
bot.on("callback_query", async (query) => {
  if (!query.data || !query.message) return;

  const [action, requestId] = query.data.split(":");
  const pending = pendingRequests.get(requestId);

  if (pending && pending.type === "approval") {
    const response = action === "approve" ? "APPROVED" : "DENIED";
    pending.resolve(response);
    pendingRequests.delete(requestId);

    await bot.editMessageText(
      `${query.message.text}\n\n**Response: ${response}**`,
      {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        parse_mode: "Markdown",
      }
    );

    await bot.answerCallbackQuery(query.id, { text: `${response}` });
  }
});

// Handle messages (polling mode)
bot.on("message", processIncomingMessage);

// Generate unique request ID
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Define MCP tools
const tools: Tool[] = [
  {
    name: "request_approval",
    description:
      "Request approval from the user via Telegram. Sends a message with Approve/Deny buttons and waits for response.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short title for the approval request" },
        description: { type: "string", description: "Detailed description of what needs approval" },
        context: { type: "string", description: "Additional context or code snippet (optional)" },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "send_prompt",
    description: "Send a prompt/question to the user via Telegram and wait for their text response.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "The question or prompt to send to the user" },
        options: { type: "array", items: { type: "string" }, description: "Optional list of suggested options" },
      },
      required: ["question"],
    },
  },
  {
    name: "notify",
    description: "Send a notification to the user via Telegram (no response expected).",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The notification message to send" },
        priority: { type: "string", enum: ["low", "normal", "high"], description: "Priority level" },
      },
      required: ["message"],
    },
  },
  {
    name: "get_pending_messages",
    description: "Get any pending messages sent by the user via Telegram. Returns queued messages and clears the queue.",
    inputSchema: {
      type: "object",
      properties: {
        peek: { type: "boolean", description: "If true, returns messages without clearing the queue (default: false)" },
      },
      required: [],
    },
  },
  {
    name: "send_message",
    description: "Send a message to the user via Telegram.",
    inputSchema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The message to send to the user" },
      },
      required: ["message"],
    },
  },
];

// Tool handler
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  switch (name) {
    case "request_approval": {
      const { title, description, context } = args as { title: string; description: string; context?: string };
      const requestId = generateRequestId();
      let messageText = `**Approval Request**\n\n**${title}**\n\n${description}`;
      if (context) messageText += `\n\n\`\`\`\n${context.substring(0, 500)}\n\`\`\``;

      const keyboard = {
        inline_keyboard: [[
          { text: "Approve", callback_data: `approve:${requestId}` },
          { text: "Deny", callback_data: `deny:${requestId}` },
        ]],
      };

      return new Promise((resolve) => {
        const timeoutMs = 5 * 60 * 1000;
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve({ content: [{ type: "text", text: JSON.stringify({ status: "timeout", message: "Approval request timed out" }) }] });
        }, timeoutMs);

        pendingRequests.set(requestId, {
          resolve: (response: string) => {
            clearTimeout(timeout);
            resolve({ content: [{ type: "text", text: JSON.stringify({ status: response.toLowerCase(), approved: response === "APPROVED", message: `Request was ${response}` }) }] });
          },
          reject: () => clearTimeout(timeout),
          type: "approval",
        });

        bot.sendMessage(chatId, messageText, { parse_mode: "Markdown", reply_markup: keyboard })
          .catch((err) => {
            clearTimeout(timeout);
            pendingRequests.delete(requestId);
            resolve({ content: [{ type: "text", text: JSON.stringify({ status: "error", message: err.message }) }] });
          });
      });
    }

    case "send_prompt": {
      const { question, options } = args as { question: string; options?: string[] };
      const requestId = generateRequestId();
      let messageText = `**Question from Qoder**\n\n${question}`;
      if (options?.length) messageText += `\n\n*Options:*\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
      messageText += `\n\n_Reply with your answer._`;

      return new Promise((resolve) => {
        const timeoutMs = 10 * 60 * 1000;
        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve({ content: [{ type: "text", text: JSON.stringify({ status: "timeout" }) }] });
        }, timeoutMs);

        pendingRequests.set(requestId, {
          resolve: (response: string) => {
            clearTimeout(timeout);
            resolve({ content: [{ type: "text", text: JSON.stringify({ status: "success", response }) }] });
          },
          reject: () => clearTimeout(timeout),
          type: "prompt",
        });

        bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" })
          .catch((err) => {
            clearTimeout(timeout);
            pendingRequests.delete(requestId);
            resolve({ content: [{ type: "text", text: JSON.stringify({ status: "error", message: err.message }) }] });
          });
      });
    }

    case "notify": {
      const { message, priority } = args as { message: string; priority?: string };
      const emoji = priority === "high" ? "!" : "";
      try {
        await bot.sendMessage(chatId, `${emoji} **Notification**\n\n${message}`, { parse_mode: "Markdown" });
        return { content: [{ type: "text", text: JSON.stringify({ status: "success" }) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: JSON.stringify({ status: "error", message: err.message }) }] };
      }
    }

    case "get_pending_messages": {
      const { peek } = args as { peek?: boolean };
      const messages = [...messageQueue];
      if (!peek) messageQueue.length = 0;
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            status: "success",
            count: messages.length,
            messages: messages.map(m => ({
              id: m.id,
              text: m.text,
              timestamp: m.timestamp,
              type: m.isCommand ? m.command : "message",
              age_seconds: Math.floor((Date.now() - m.timestamp) / 1000),
            })),
          }),
        }],
      };
    }

    case "send_message": {
      const { message } = args as { message: string };
      try {
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
        return { content: [{ type: "text", text: JSON.stringify({ status: "success" }) }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: JSON.stringify({ status: "error", message: err.message }) }] };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create MCP server
function createMcpServer(): Server {
  const server = new Server(
    { name: "telegram-approval-mcp", version: "1.0.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args as Record<string, unknown>);
  });

  activeMcpServers.add(server);
  return server;
}

// Store active SSE transports
const transports: Record<string, SSEServerTransport> = {};

// Start HTTP server
async function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      transport: "http",
      mode: useWebhook ? "webhook" : "polling",
      queue_size: messageQueue.length,
      active_connections: Object.keys(transports).length,
    });
  });

  // Telegram webhook endpoint
  app.post("/webhook", async (req: Request, res: Response) => {
    try {
      const update = req.body;
      // Process the update through the bot's internal handler
      bot.processUpdate(update);
      res.sendStatus(200);
    } catch (error) {
      console.error("Webhook error:", error);
      res.sendStatus(500);
    }
  });

  // SSE endpoint
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("New SSE connection");
    try {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      transport.onclose = () => {
        console.log(`SSE closed: ${sessionId}`);
        delete transports[sessionId];
      };

      const server = createMcpServer();
      await server.connect(transport);
      console.log(`SSE established: ${sessionId}`);
    } catch (error) {
      console.error("SSE error:", error);
      if (!res.headersSent) res.status(500).send("Error");
    }
  });

  // Messages endpoint
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.status(400).send("Missing sessionId");

    const transport = transports[sessionId];
    if (!transport) return res.status(404).send("Session not found");

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error("Message error:", error);
      if (!res.headersSent) res.status(500).send("Error");
    }
  });

  app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
    
    // Set up Telegram webhook if URL provided
    if (useWebhook && WEBHOOK_URL) {
      try {
        await bot.setWebHook(`${WEBHOOK_URL}/webhook`);
        console.log(`Webhook set: ${WEBHOOK_URL}/webhook`);
      } catch (err) {
        console.error("Failed to set webhook:", err);
      }
    }
  });
}

// Main
async function main() {
  console.error("Starting Telegram Approval MCP Server...");
  console.error(`Mode: ${TRANSPORT_MODE}, Webhook: ${useWebhook ? 'Yes' : 'No'}`);

  try {
    await bot.sendMessage(chatId, `MCP Server online!\nMode: ${useWebhook ? 'Webhook' : 'Polling'}`);
  } catch (err) {
    console.error("Startup message failed:", err);
  }

  if (TRANSPORT_MODE === "http") {
    await startHttpServer();
  } else {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP connected via stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  if (useWebhook) await bot.deleteWebHook();
  for (const id in transports) {
    await transports[id].close();
  }
  bot.stopPolling();
  process.exit(0);
});
