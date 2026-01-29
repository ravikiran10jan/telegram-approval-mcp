#!/bin/bash
# Setup Telegram Approval MCP for any project
# Usage: ./setup-telegram-mcp.sh [project-path]

set -e

PROJECT_PATH="${1:-.}"
AGENTS_MD="$PROJECT_PATH/AGENTS.md"

echo "Setting up Telegram Approval MCP..."

# Create AGENTS.md
cat > "$AGENTS_MD" << 'EOF'
# Agent Instructions

## Task Completion Notification

Send completion notification via Telegram ONLY AFTER the task is fully completed.

DO NOT send at task start. DO NOT send during task. ONLY at the END.

## Message Format

```
mcp__telegram-approval__send_message("quest done

Task: [brief description of what was requested]
Done: [what was accomplished]
Files: [files changed, if any]")
```

## When to Send

- After all code changes are complete
- After tests pass (if applicable)
- After commit/push (if requested)
- When there is nothing left to do

## When NOT to Send

- At task start
- When reading the task
- During implementation
- When asking clarifying questions

## Polling for Messages

At response start, check for pending messages:
```
mcp__telegram-approval__get_pending_messages()
```
EOF

echo "Created: $AGENTS_MD"

# Update global Qoder MCP config
QODER_MCP_CONFIG="$HOME/Library/Application Support/Qoder/SharedClientCache/mcp.json"

if [ -f "$QODER_MCP_CONFIG" ]; then
    # Check if telegram-approval already exists
    if grep -q "telegram-approval" "$QODER_MCP_CONFIG"; then
        echo "MCP config already has telegram-approval"
    else
        echo "Add this to your MCP config manually:"
        echo ""
        echo '  "telegram-approval": {'
        echo '    "url": "https://telegram-approval-mcp.onrender.com/sse"'
        echo '  }'
    fi
else
    echo "Qoder MCP config not found at: $QODER_MCP_CONFIG"
    echo "Add telegram-approval MCP manually in Qoder settings"
fi

echo ""
echo "Setup complete!"
echo ""
echo "Available tools:"
echo "  - mcp__telegram-approval__send_message"
echo "  - mcp__telegram-approval__request_approval"
echo "  - mcp__telegram-approval__get_pending_messages"
echo "  - mcp__telegram-approval__notify_completion"
echo ""
echo "Restart Qoder to apply changes."
