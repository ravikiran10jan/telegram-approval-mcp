// MCP Tool handlers extracted for testability

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
}

export function createSuccessResult(data: Record<string, unknown>): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }],
  };
}

export function createErrorResult(message: string): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ status: "error", message }) }],
  };
}

export interface PendingMessagesResult {
  status: string;
  count: number;
  messages: Array<{
    id: string;
    text: string;
    timestamp: number;
    type: string;
    age_seconds: number;
  }>;
}

export function formatPendingMessages(
  messages: Array<{ id: string; text: string; timestamp: number; isCommand: boolean; command?: string }>,
  now: number
): PendingMessagesResult {
  return {
    status: "success",
    count: messages.length,
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      timestamp: m.timestamp,
      type: m.isCommand ? m.command || "command" : "message",
      age_seconds: Math.floor((now - m.timestamp) / 1000),
    })),
  };
}

export function formatNotificationMessage(message: string, priority?: string): string {
  const emoji = priority === "high" ? "!" : priority === "low" ? "" : "";
  return `${emoji} **Notification from Qoder**\n\n${message}`;
}

export function formatApprovalMessage(title: string, description: string, context?: string): string {
  let messageText = `**Approval Request**\n\n**${title}**\n\n${description}`;
  if (context) {
    messageText += `\n\n\`\`\`\n${context.substring(0, 500)}\n\`\`\``;
  }
  return messageText;
}

export function formatPromptMessage(question: string, options?: string[]): string {
  let messageText = `**Question from Qoder**\n\n${question}`;
  if (options && options.length > 0) {
    messageText += `\n\n*Suggested options:*\n${options.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
  }
  messageText += `\n\n_Reply to this message with your answer._`;
  return messageText;
}

export function generateRequestId(timestamp: number = Date.now()): string {
  return `req_${timestamp}_${Math.random().toString(36).substring(2, 9)}`;
}
