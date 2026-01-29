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

Example:
```
quest done

Task: Add unit tests for handlers
Done: Created 47 tests across 3 files
Files: handlers.test.ts, tools.test.ts, endpoints.test.ts
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
