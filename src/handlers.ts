// Extracted handlers for testability

export interface QueuedMessage {
  id: string;
  text: string;
  timestamp: number;
  isCommand: boolean;
  command?: string;
}

export interface MessageQueue {
  messages: QueuedMessage[];
  push(msg: QueuedMessage): void;
  clear(): void;
  getAll(): QueuedMessage[];
}

export function createMessageQueue(): MessageQueue {
  const messages: QueuedMessage[] = [];
  return {
    messages,
    push(msg: QueuedMessage) {
      messages.push(msg);
    },
    clear() {
      messages.length = 0;
    },
    getAll() {
      return [...messages];
    },
  };
}

export interface ParsedCommand {
  isCommand: boolean;
  command: string | null;
  content: string;
}

export function parseCommand(text: string): ParsedCommand {
  const trimmed = text.trim();
  
  if (!trimmed.startsWith("/")) {
    return { isCommand: false, command: null, content: trimmed };
  }
  
  const parts = trimmed.split(" ");
  // Remove @botusername suffix from command (e.g., /help@MyBot -> /help)
  const command = parts[0].toLowerCase().split("@")[0];
  const content = parts.slice(1).join(" ");
  
  return { isCommand: true, command, content };
}

export type CommandType = "quest" | "chat" | "help" | "unknown";

export function getCommandType(command: string): CommandType {
  if (command === "/quest" || command === "/q") return "quest";
  if (command === "/chat" || command === "/c") return "chat";
  if (command === "/help") return "help";
  return "unknown";
}

export interface CommandResult {
  type: CommandType;
  shouldQueue: boolean;
  queuedMessage?: QueuedMessage;
  responseText?: string;
}

export function handleCommand(
  command: string,
  content: string,
  timestamp: number
): CommandResult {
  const commandType = getCommandType(command);
  
  switch (commandType) {
    case "quest":
      return {
        type: "quest",
        shouldQueue: true,
        queuedMessage: {
          id: `msg_${timestamp}`,
          text: content || "New Quest requested",
          timestamp,
          isCommand: true,
          command: "quest",
        },
        responseText: "Quest request queued. Qoder will pick it up when ready.",
      };
    
    case "chat":
      return {
        type: "chat",
        shouldQueue: true,
        queuedMessage: {
          id: `msg_${timestamp}`,
          text: content || "",
          timestamp,
          isCommand: true,
          command: "chat",
        },
        responseText: "Message queued for Qoder.",
      };
    
    case "help":
      return {
        type: "help",
        shouldQueue: false,
        responseText:
          `**Available Commands**\n\n` +
          `/quest <task> or /q <task> - Create a new Quest\n` +
          `/chat <message> or /c <message> - Send message to Qoder\n` +
          `/help - Show this help\n\n` +
          `You can also just type a message and it will be queued for Qoder.`,
      };
    
    default:
      return { type: "unknown", shouldQueue: false };
  }
}

export function createQueuedMessage(text: string, timestamp: number): QueuedMessage {
  return {
    id: `msg_${timestamp}`,
    text,
    timestamp,
    isCommand: false,
  };
}
