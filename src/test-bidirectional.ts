// Test bidirectional communication
import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = parseInt(process.env.TELEGRAM_CHAT_ID!, 10);

const bot = new TelegramBot(token, { polling: true });

// Simple message queue for testing
const messageQueue: any[] = [];

async function test() {
  console.log("Testing bidirectional communication...");
  console.log("Send a message or command to the bot on Telegram.\n");
  console.log("Commands:");
  console.log("  /quest <task> - Queue a quest request");
  console.log("  /chat <msg>   - Queue a chat message");
  console.log("  /help         - Show help");
  console.log("  /stop         - Stop this test\n");
  console.log("Or just type any message to queue it.\n");

  // Send instructions
  await bot.sendMessage(
    chatId,
    "**Test Mode Active**\n\nSend me a message or use commands:\n" +
    "- `/quest <task>` - Queue a quest\n" +
    "- `/chat <msg>` - Queue a message\n" +
    "- `/stop` - Stop test\n\n" +
    "Or just type any message!",
    { parse_mode: "Markdown" }
  );

  bot.on("message", async (msg) => {
    if (msg.chat.id !== chatId) return;
    if (!msg.text) return;

    const text = msg.text.trim();

    if (text === "/stop") {
      console.log("\nStopping test...");
      console.log(`\nQueued messages (${messageQueue.length}):`);
      messageQueue.forEach((m, i) => {
        console.log(`  ${i + 1}. [${m.type}] ${m.text}`);
      });
      await bot.sendMessage(chatId, "Test stopped. Queued messages shown in console.");
      bot.stopPolling();
      process.exit(0);
    }

    if (text.startsWith("/")) {
      const parts = text.split(" ");
      const command = parts[0].toLowerCase();
      const content = parts.slice(1).join(" ");

      if (command === "/quest" || command === "/q") {
        messageQueue.push({ type: "quest", text: content || "New Quest" });
        console.log(`Queued QUEST: ${content || "New Quest"}`);
        await bot.sendMessage(chatId, `Quest queued: "${content || "New Quest"}"`, {
          reply_to_message_id: msg.message_id,
        });
      } else if (command === "/chat" || command === "/c") {
        messageQueue.push({ type: "chat", text: content });
        console.log(`Queued CHAT: ${content}`);
        await bot.sendMessage(chatId, `Chat message queued.`, {
          reply_to_message_id: msg.message_id,
        });
      } else if (command === "/help") {
        await bot.sendMessage(chatId, "Use /quest, /chat, or /stop");
      }
    } else {
      messageQueue.push({ type: "message", text: text });
      console.log(`Queued MESSAGE: ${text}`);
      await bot.sendMessage(chatId, `Message queued.`, {
        reply_to_message_id: msg.message_id,
      });
    }
  });
}

test().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
