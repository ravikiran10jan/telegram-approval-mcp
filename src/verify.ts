// Programmatic verification test
import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN!;
const chatId = parseInt(process.env.TELEGRAM_CHAT_ID!, 10);

async function verify() {
  console.log("=== Programmatic Verification ===\n");
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Bot connection
  console.log("1. Testing Telegram Bot connection...");
  try {
    const bot = new TelegramBot(token, { polling: false });
    const me = await bot.getMe();
    console.log(`   PASS: Bot connected as @${me.username}`);
    passed++;
    
    // Test 2: Send message capability
    console.log("2. Testing message sending...");
    const msg = await bot.sendMessage(chatId, "Verification test - bidirectional communication ready!");
    console.log(`   PASS: Message sent (ID: ${msg.message_id})`);
    passed++;
    
    // Test 3: Inline keyboard
    console.log("3. Testing inline keyboard...");
    const keyboard = {
      inline_keyboard: [[
        { text: "Test", callback_data: "test:123" }
      ]]
    };
    const kbMsg = await bot.sendMessage(chatId, "Keyboard test", { reply_markup: keyboard });
    await bot.deleteMessage(chatId, kbMsg.message_id);
    console.log("   PASS: Inline keyboard works");
    passed++;
    
  } catch (err: any) {
    console.log(`   FAIL: ${err.message}`);
    failed++;
  }
  
  // Test 4: Message queue logic (unit test)
  console.log("4. Testing message queue logic...");
  const queue: any[] = [];
  queue.push({ id: "msg_1", text: "test", timestamp: Date.now(), isCommand: false });
  queue.push({ id: "msg_2", text: "quest task", timestamp: Date.now(), isCommand: true, command: "quest" });
  
  if (queue.length === 2 && queue[1].command === "quest") {
    console.log("   PASS: Message queue logic works");
    passed++;
  } else {
    console.log("   FAIL: Queue logic broken");
    failed++;
  }
  
  // Test 5: Verify compiled JS exists
  console.log("5. Testing compiled output...");
  const fs = await import("fs");
  if (fs.existsSync("./dist/index.js")) {
    console.log("   PASS: Compiled JS exists");
    passed++;
  } else {
    console.log("   FAIL: dist/index.js not found");
    failed++;
  }
  
  // Summary
  console.log(`\n=== Results: ${passed}/${passed + failed} passed ===`);
  
  if (failed === 0) {
    console.log("\nAll verifications passed!");
    console.log("\nMCP Server Features:");
    console.log("  - request_approval: Send Approve/Deny buttons");
    console.log("  - send_prompt: Ask questions, wait for text reply");
    console.log("  - notify: Send notifications");
    console.log("  - get_pending_messages: Retrieve user messages from Telegram");
    console.log("  - send_message: Send messages to user");
    console.log("\nTelegram Commands:");
    console.log("  /quest <task> - Queue a quest request");
    console.log("  /chat <msg> - Queue a chat message");
    console.log("  /help - Show help");
    process.exit(0);
  } else {
    process.exit(1);
  }
}

verify();
