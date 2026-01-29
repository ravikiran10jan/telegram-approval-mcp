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

## Approval Workflow

When an action needs user approval (destructive operations, deployments, etc.):

1. **Request approval with details:**
```
mcp__telegram-approval__request_approval({
  title: "Action requiring approval",
  description: "What will happen and why approval is needed",
  context: "Relevant code or details (optional)"
})
```

2. **Wait for response** - tool returns when user taps Approve/Deny

3. **On APPROVED:** Continue with the action immediately

4. **On DENIED:** Stop and ask for alternative approach

Example:
```
mcp__telegram-approval__request_approval({
  title: "Deploy to Production",
  description: "Push latest changes to production server. This will affect live users.",
  context: "Files changed: api/routes.ts, db/migrations/001.sql"
})
```

## Polling for Messages

At response start, check for pending messages:
```
mcp__telegram-approval__get_pending_messages()
```

Act on any pending quests or messages proactively.
