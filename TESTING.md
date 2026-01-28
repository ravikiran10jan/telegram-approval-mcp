# Testing Guide

## Pre-requisites
- Service deployed on Render
- Telegram bot running (startup message received)

## Test 1: Health Check

```bash
curl https://telegram-approval-mcp.onrender.com/health
```

**Expected Response:**
```json
{"status":"ok","transport":"http"}
```

## Test 2: Telegram /help Command

1. Open Telegram
2. Go to your bot chat
3. Send: `/help`

**Expected Response:**
```
**Available Commands**

/quest <task> or /q <task> - Create a new Quest
/chat <message> or /c <message> - Send message to Qoder
/help - Show this help

You can also just type a message and it will be queued for Qoder.
```

## Test 3: Telegram /help with Bot Username

1. Send: `/help@YourBotName`

**Expected Response:** Same as Test 2

## Test 4: SSE Connection

```bash
curl -N https://telegram-approval-mcp.onrender.com/sse
```

**Expected:** SSE stream opens, returns `endpoint` event with session ID

## Test 5: Startup Notification

When service starts, bot should send:
```
Telegram Approval MCP Server is now online!
Mode: HTTP
```

## Verification Checklist

- [ ] Health endpoint returns 200 OK
- [ ] `/help` command responds in Telegram
- [ ] `/help@BotName` command responds (@ suffix handled)
- [ ] SSE endpoint accepts connections
- [ ] Startup notification received in Telegram
