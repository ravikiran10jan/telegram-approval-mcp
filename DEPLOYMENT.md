# Deployment Guide

## Prerequisites
- GitHub account
- Render account (https://render.com)

## Step 1: Push to GitHub

```bash
cd /Users/ravikiranreddygajula/telegram-approval-mcp
git add .
git commit -m "Add Render deployment config"
git remote add origin https://github.com/ravikiran10jan/telegram-approval-mcp.git
git push -u origin main
```

## Step 2: Deploy to Render

### Option A: Using Render Blueprint (Recommended)
1. Go to https://dashboard.render.com
2. Click "New" > "Blueprint"
3. Connect your GitHub repo: `ravikiran10jan/telegram-approval-mcp`
4. Render will detect `render.yaml` and configure automatically
5. Set the secret environment variables when prompted:
   - `TELEGRAM_BOT_TOKEN`: Your bot token
   - `TELEGRAM_CHAT_ID`: Your chat ID

### Option B: Manual Setup
1. Go to https://dashboard.render.com
2. Click "New" > "Web Service"
3. Connect your GitHub repo
4. Configure:
   - **Name**: telegram-approval-mcp
   - **Runtime**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Add environment variables:
   - `TRANSPORT_MODE`: http
   - `PORT`: 3000
   - `TELEGRAM_BOT_TOKEN`: (your token)
   - `TELEGRAM_CHAT_ID`: (your chat ID)

## Step 3: Verify Deployment

Once deployed, verify:
1. Health check: `https://your-app.onrender.com/health`
2. Send `/help` in Telegram - bot should respond

## Step 4: Configure MCP Clients

Add to your MCP client config (e.g., `mcp.json`):

```json
{
  "mcpServers": {
    "telegram-approval": {
      "url": "https://your-app.onrender.com/sse",
      "transport": "sse"
    }
  }
}
```

## Service URL

After deployment, your service will be available at:
- SSE endpoint: `https://telegram-approval-mcp.onrender.com/sse`
- Messages endpoint: `https://telegram-approval-mcp.onrender.com/messages`
- Health check: `https://telegram-approval-mcp.onrender.com/health`
