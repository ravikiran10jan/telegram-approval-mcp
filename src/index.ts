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
const TRANSPORT_MODE = process.env.TRANSPORT_MODE || "stdio"; // "stdio" or "http"

if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error("Error: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID must be set");
  process.exit(1);
}

// Initialize Telegram bot with polling
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true });
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

// Handle callback queries (button clicks)
bot.on("callback_query", async (query) => {
  if (!query.data || !query.message) return;

  const [action, requestId] = query.data.split(":");
  const pending = pendingRequests.get(requestId);

  if (pending && pending.type === "approval") {
    const response = action === "approve" ? "APPROVED" : "DENIED";
    pending.resolve(response);
    pendingRequests.delete(requestId);

    // Update the message to show the result
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

// Handle text messages (for prompt responses and user-initiated messages)
bot.on("message", async (msg) => {
  if (msg.chat.id.toString() !== chatId) return;
  if (!msg.text) return;

  const text = msg.text.trim();
  
  // Handle commands
  if (text.startsWith("/")) {
    const parts = text.split(" ");
    // Remove @botusername suffix from command (e.g., /help@MyBot -> /help)
    const command = parts[0].toLowerCase().split("@")[0];
    const content = parts.slice(1).join(" ");
    
    if (command === "/quest" || command === "/q") {
      // Queue as a new quest request
      messageQueue.push({
        id: `msg_${Date.now()}`,
        text: content || "New Quest requested",
        timestamp: Date.now(),
        isCommand: true,
        command: "quest",
      });
      await bot.sendMessage(chatId, `Quest request queued. Qoder will pick it up when ready.`, {
        reply_to_message_id: msg.message_id,
      });
      return;
    }
    
    if (command === "/chat" || command === "/c") {
      // Queue as a chat message
      messageQueue.push({
        id: `msg_${Date.now()}`,
        text: content || "",
        timestamp: Date.now(),
        isCommand: true,
        command: "chat",
      });
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
        `/help - Show this help\n\n` +
        `You can also just type a message and it will be queued for Qoder.`,
        { parse_mode: "Markdown" }
      );
      return;
    }
    
    // Unknown command - ignore
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
  
  // If no pending prompt, queue the message for Qoder to pick up
  if (!handled) {
    messageQueue.push({
      id: `msg_${Date.now()}`,
      text: text,
      timestamp: Date.now(),
      isCommand: false,
    });
    await bot.sendMessage(chatId, `Message queued. Qoder will pick it up when ready.`, {
      reply_to_message_id: msg.message_id,
    });
  }
});

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
        title: {
          type: "string",
          description: "Short title for the approval request",
        },
        description: {
          type: "string",
          description: "Detailed description of what needs approval",
        },
        context: {
          type: "string",
          description: "Additional context or code snippet (optional)",
        },
      },
      required: ["title", "description"],
    },
  },
  {
    name: "send_prompt",
    description:
      "Send a prompt/question to the user via Telegram and wait for their text response.",
    inputSchema: {
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question or prompt to send to the user",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "Optional list of suggested options (user can still type freely)",
        },
      },
      required: ["question"],
    },
  },
  {
    name: "notify",
    description:
      "Send a notification to the user via Telegram (no response expected).",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The notification message to send",
        },
        priority: {
          type: "string",
          enum: ["low", "normal", "high"],
          description: "Priority level of the notification",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "get_pending_messages",
    description:
      "Get any pending messages sent by the user via Telegram. Use this to check if the user has sent any messages or commands from their phone. Returns queued messages and clears the queue.",
    inputSchema: {
      type: "object",
      properties: {
        peek: {
          type: "boolean",
          description: "If true, returns messages without clearing the queue (default: false)",
        },
      },
      required: [],
    },
  },
  {
    name: "send_message",
    description:
      "Send a message to the user via Telegram. Use this to respond to user messages or provide updates.",
    inputSchema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The message to send to the user",
        },
      },
      required: ["message"],
    },
  },
];

// Create tool handler function (shared between transports)
async function handleToolCall(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
  switch (name) {
    case "request_approval": {
      const { title, description, context } = args as {
        title: string;
        description: string;
        context?: string;
      };

      const requestId = generateRequestId();
      let messageText = `**Approval Request**\n\n**${title}**\n\n${description}`;
      if (context) {
        messageText += `\n\n\`\`\`\n${context.substring(0, 500)}\n\`\`\``;
      }

      const keyboard = {
        inline_keyboard: [
          [
            { text: "Approve", callback_data: `approve:${requestId}` },
            { text: "Deny", callback_data: `deny:${requestId}` },
          ],
        ],
      };

      return new Promise((resolve, reject) => {
        const timeoutMs = 5 * 60 * 1000; // 5 minute timeout

        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "timeout",
                  message: "Approval request timed out after 5 minutes",
                }),
              },
            ],
          });
        }, timeoutMs);

        pendingRequests.set(requestId, {
          resolve: (response: string) => {
            clearTimeout(timeout);
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: response.toLowerCase(),
                    approved: response === "APPROVED",
                    message: `Request was ${response}`,
                  }),
                },
              ],
            });
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
          type: "approval",
        });

        bot
          .sendMessage(chatId, messageText, {
            parse_mode: "Markdown",
            reply_markup: keyboard,
          })
          .then((sentMessage) => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
              pending.messageId = sentMessage.message_id;
            }
          })
          .catch((err) => {
            clearTimeout(timeout);
            pendingRequests.delete(requestId);
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "error",
                    message: `Failed to send Telegram message: ${err.message}`,
                  }),
                },
              ],
            });
          });
      });
    }

    case "send_prompt": {
      const { question, options } = args as {
        question: string;
        options?: string[];
      };

      const requestId = generateRequestId();
      let messageText = `**Question from Qoder**\n\n${question}`;

      if (options && options.length > 0) {
        messageText += `\n\n*Suggested options:*\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
      }
      messageText += `\n\n_Reply to this message with your answer._`;

      return new Promise((resolve, reject) => {
        const timeoutMs = 10 * 60 * 1000; // 10 minute timeout for prompts

        const timeout = setTimeout(() => {
          pendingRequests.delete(requestId);
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  status: "timeout",
                  message: "Prompt timed out after 10 minutes",
                }),
              },
            ],
          });
        }, timeoutMs);

        pendingRequests.set(requestId, {
          resolve: (response: string) => {
            clearTimeout(timeout);
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "success",
                    response: response,
                  }),
                },
              ],
            });
          },
          reject: (error: Error) => {
            clearTimeout(timeout);
            reject(error);
          },
          type: "prompt",
        });

        bot
          .sendMessage(chatId, messageText, { parse_mode: "Markdown" })
          .then((sentMessage) => {
            const pending = pendingRequests.get(requestId);
            if (pending) {
              pending.messageId = sentMessage.message_id;
            }
          })
          .catch((err) => {
            clearTimeout(timeout);
            pendingRequests.delete(requestId);
            resolve({
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    status: "error",
                    message: `Failed to send Telegram message: ${err.message}`,
                  }),
                },
              ],
            });
          });
      });
    }

    case "notify": {
      const { message, priority } = args as {
        message: string;
        priority?: string;
      };

      const emoji =
        priority === "high" ? "!" : priority === "low" ? "" : "";
      const messageText = `${emoji} **Notification from Qoder**\n\n${message}`;

      try {
        await bot.sendMessage(chatId, messageText, { parse_mode: "Markdown" });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                message: "Notification sent successfully",
              }),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "error",
                message: `Failed to send notification: ${err.message}`,
              }),
            },
          ],
        };
      }
    }

    case "get_pending_messages": {
      const { peek } = args as { peek?: boolean };
      
      const messages = [...messageQueue];
      
      if (!peek) {
        // Clear the queue
        messageQueue.length = 0;
      }
      
      return {
        content: [
          {
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
          },
        ],
      };
    }

    case "send_message": {
      const { message } = args as { message: string };

      try {
        await bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "success",
                message: "Message sent successfully",
              }),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                status: "error",
                message: `Failed to send message: ${err.message}`,
              }),
            },
          ],
        };
      }
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create MCP server factory (creates a new server instance for each connection)
function createMcpServer(): Server {
  const server = new Server(
    {
      name: "telegram-approval-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools };
  });

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(name, args as Record<string, unknown>);
  });

  return server;
}

// Store active SSE transports
const transports: Record<string, SSEServerTransport> = {};

// Start HTTP server for SSE transport
async function startHttpServer() {
  const app = express();
  app.use(express.json());

  // Health check endpoint
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", transport: "http" });
  });

  // SSE endpoint for establishing the stream
  app.get("/sse", async (req: Request, res: Response) => {
    console.log("Received GET request to /sse (establishing SSE stream)");
    try {
      const transport = new SSEServerTransport("/messages", res);
      const sessionId = transport.sessionId;
      transports[sessionId] = transport;

      transport.onclose = () => {
        console.log(`SSE transport closed for session ${sessionId}`);
        delete transports[sessionId];
      };

      const server = createMcpServer();
      await server.connect(transport);
      console.log(`Established SSE stream with session ID: ${sessionId}`);
    } catch (error) {
      console.error("Error establishing SSE stream:", error);
      if (!res.headersSent) {
        res.status(500).send("Error establishing SSE stream");
      }
    }
  });

  // Messages endpoint for receiving client JSON-RPC requests
  app.post("/messages", async (req: Request, res: Response) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).send("Missing sessionId parameter");
      return;
    }

    const transport = transports[sessionId];
    if (!transport) {
      res.status(404).send("Session not found");
      return;
    }

    try {
      await transport.handlePostMessage(req, res, req.body);
    } catch (error) {
      console.error("Error handling request:", error);
      if (!res.headersSent) {
        res.status(500).send("Error handling request");
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`HTTP MCP Server listening on port ${PORT}`);
    console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
    console.log(`Messages endpoint: http://localhost:${PORT}/messages`);
  });
}

// Start the server
async function main() {
  console.error("Starting Telegram Approval MCP Server...");
  console.error(`Bot connected, listening for messages from chat: ${chatId}`);
  console.error(`Transport mode: ${TRANSPORT_MODE}`);

  // Send startup notification
  try {
    await bot.sendMessage(
      chatId,
      `Telegram Approval MCP Server is now online!\nMode: ${TRANSPORT_MODE.toUpperCase()}`
    );
  } catch (err) {
    console.error("Failed to send startup message:", err);
  }

  if (TRANSPORT_MODE === "http") {
    await startHttpServer();
  } else {
    // Default: stdio transport
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP Server connected via stdio");
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Handle server shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down server...");
  for (const sessionId in transports) {
    try {
      await transports[sessionId].close();
      delete transports[sessionId];
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
  bot.stopPolling();
  process.exit(0);
});
