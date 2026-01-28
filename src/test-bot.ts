// Quick test to verify Telegram bot connection
import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = process.env.TELEGRAM_CHAT_ID!;

if (!token || !chatId) {
  console.error("Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: false });
const targetChatId = parseInt(chatId, 10);

async function test() {
  console.log("Testing Telegram bot connection...");
  
  try {
    const me = await bot.getMe();
    console.log("Bot info:", me);
    
    // Send test message
    const msg = await bot.sendMessage(
      targetChatId,
      "Test message from Telegram Approval MCP Server!\n\nIf you see this, the bot is working correctly."
    );
    console.log("Message sent successfully! Message ID:", msg.message_id);
    
    // Test inline keyboard
    const keyboard = {
      inline_keyboard: [
        [
          { text: "Test Button 1", callback_data: "test:1" },
          { text: "Test Button 2", callback_data: "test:2" },
        ],
      ],
    };
    
    await bot.sendMessage(
      targetChatId,
      "Testing inline keyboard (you can ignore this):",
      { reply_markup: keyboard }
    );
    console.log("Inline keyboard test sent!");
    
    console.log("\n SUCCESS: Bot is configured correctly!");
    process.exit(0);
  } catch (err: any) {
    console.error("Error:", err.message);
    process.exit(1);
  }
}

test();
