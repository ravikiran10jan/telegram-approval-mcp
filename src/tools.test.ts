import {
  createSuccessResult,
  createErrorResult,
  formatPendingMessages,
  formatNotificationMessage,
  formatApprovalMessage,
  formatPromptMessage,
  generateRequestId,
} from './tools';

describe('createSuccessResult', () => {
  it('should create result with JSON stringified data', () => {
    const result = createSuccessResult({ status: 'ok', count: 5 });
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual({ status: 'ok', count: 5 });
  });
});

describe('createErrorResult', () => {
  it('should create error result with message', () => {
    const result = createErrorResult('Something went wrong');
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe('error');
    expect(parsed.message).toBe('Something went wrong');
  });
});

describe('formatPendingMessages', () => {
  const now = 1700000000000;

  it('should format empty messages array', () => {
    const result = formatPendingMessages([], now);
    expect(result.status).toBe('success');
    expect(result.count).toBe(0);
    expect(result.messages).toEqual([]);
  });

  it('should format messages with correct age calculation', () => {
    const messages = [
      { id: 'msg_1', text: 'hello', timestamp: now - 60000, isCommand: false },
    ];
    const result = formatPendingMessages(messages, now);
    expect(result.count).toBe(1);
    expect(result.messages[0].age_seconds).toBe(60);
    expect(result.messages[0].type).toBe('message');
  });

  it('should format command messages with command type', () => {
    const messages = [
      { id: 'msg_1', text: 'task', timestamp: now - 30000, isCommand: true, command: 'quest' },
    ];
    const result = formatPendingMessages(messages, now);
    expect(result.messages[0].type).toBe('quest');
  });

  it('should handle multiple messages', () => {
    const messages = [
      { id: 'msg_1', text: 'first', timestamp: now - 120000, isCommand: false },
      { id: 'msg_2', text: 'second', timestamp: now - 60000, isCommand: true, command: 'chat' },
    ];
    const result = formatPendingMessages(messages, now);
    expect(result.count).toBe(2);
    expect(result.messages[0].age_seconds).toBe(120);
    expect(result.messages[1].age_seconds).toBe(60);
  });
});

describe('formatNotificationMessage', () => {
  it('should format basic notification', () => {
    const result = formatNotificationMessage('Task completed');
    expect(result).toContain('**Notification from Qoder**');
    expect(result).toContain('Task completed');
  });

  it('should add ! for high priority', () => {
    const result = formatNotificationMessage('Urgent!', 'high');
    expect(result).toContain('!');
  });

  it('should not add emoji for low priority', () => {
    const result = formatNotificationMessage('FYI', 'low');
    expect(result).toContain('**Notification from Qoder**');
    expect(result).toContain('FYI');
  });
});

describe('formatApprovalMessage', () => {
  it('should format approval without context', () => {
    const result = formatApprovalMessage('Deploy', 'Ready to deploy?');
    expect(result).toContain('**Approval Request**');
    expect(result).toContain('**Deploy**');
    expect(result).toContain('Ready to deploy?');
  });

  it('should format approval with context', () => {
    const result = formatApprovalMessage('Code Review', 'Review this code', 'const x = 1;');
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('should truncate long context to 500 chars', () => {
    const longContext = 'x'.repeat(1000);
    const result = formatApprovalMessage('Test', 'Desc', longContext);
    expect(result.length).toBeLessThan(600 + 100); // 500 context + message overhead
  });
});

describe('formatPromptMessage', () => {
  it('should format basic prompt', () => {
    const result = formatPromptMessage('What is your name?');
    expect(result).toContain('**Question from Qoder**');
    expect(result).toContain('What is your name?');
    expect(result).toContain('Reply to this message');
  });

  it('should include numbered options', () => {
    const result = formatPromptMessage('Choose:', ['Option A', 'Option B', 'Option C']);
    expect(result).toContain('*Suggested options:*');
    expect(result).toContain('1. Option A');
    expect(result).toContain('2. Option B');
    expect(result).toContain('3. Option C');
  });

  it('should handle empty options array', () => {
    const result = formatPromptMessage('Question?', []);
    expect(result).not.toContain('Suggested options');
  });
});

describe('generateRequestId', () => {
  it('should generate unique IDs', () => {
    const id1 = generateRequestId(1000);
    const id2 = generateRequestId(1000);
    expect(id1).not.toBe(id2); // Random suffix makes them unique
  });

  it('should start with req_ prefix', () => {
    const id = generateRequestId(1234567890);
    expect(id.startsWith('req_1234567890_')).toBe(true);
  });

  it('should have correct format', () => {
    const id = generateRequestId();
    expect(id).toMatch(/^req_\d+_[a-z0-9]+$/);
  });
});
