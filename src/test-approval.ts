// Interactive approval test
import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = parseInt(process.env.TELEGRAM_CHAT_ID!, 10);

const bot = new TelegramBot(token, { polling: true });

async function testApproval() {
  console.log("Sending approval request to Telegram...");
  console.log("Waiting for your response (Approve or Deny)...\n");

  const requestId = `test_${Date.now()}`;
  
  const keyboard = {
    inline_keyboard: [
      [
        { text: "Approve", callback_data: `approve:${requestId}` },
        { text: "Deny", callback_data: `deny:${requestId}` },
      ],
    ],
  };

  await bot.sendMessage(
    chatId,
    "**Test Approval Request**\n\nThis is a test from your Telegram Approval MCP Server.\n\nPlease tap Approve or Deny below:",
    { parse_mode: "Markdown", reply_markup: keyboard }
  );

  // Wait for callback
  return new Promise<void>((resolve) => {
    bot.on("callback_query", async (query) => {
      if (!query.data || !query.message) return;
      
      const [action, reqId] = query.data.split(":");
      if (reqId !== requestId) return;

      const response = action === "approve" ? "APPROVED" : "DENIED";
      
      console.log(`\nReceived response: ${response}`);
      
      await bot.editMessageText(
        `**Test Approval Request**\n\n**Response: ${response}**`,
        {
          chat_id: query.message.chat.id,
          message_id: query.message.message_id,
          parse_mode: "Markdown",
        }
      );
      
      await bot.answerCallbackQuery(query.id, { text: response });
      
      console.log("Test completed successfully!");
      console.log("\nThe approval flow is working. Restart Qoder to use the MCP tools.");
      
      bot.stopPolling();
      resolve();
    });
  });
}

testApproval().then(() => process.exit(0)).catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
