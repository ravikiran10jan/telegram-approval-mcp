import {
  parseCommand,
  getCommandType,
  handleCommand,
  createMessageQueue,
  createQueuedMessage,
} from './handlers';

describe('parseCommand', () => {
  it('should parse regular text as non-command', () => {
    const result = parseCommand('hello world');
    expect(result.isCommand).toBe(false);
    expect(result.command).toBeNull();
    expect(result.content).toBe('hello world');
  });

  it('should parse /help command', () => {
    const result = parseCommand('/help');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/help');
    expect(result.content).toBe('');
  });

  it('should parse /quest command with content', () => {
    const result = parseCommand('/quest build a new feature');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/quest');
    expect(result.content).toBe('build a new feature');
  });

  it('should strip @botusername from command', () => {
    const result = parseCommand('/help@MyBot');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/help');
  });

  it('should strip @botusername and preserve content', () => {
    const result = parseCommand('/quest@MyBot create tests');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/quest');
    expect(result.content).toBe('create tests');
  });

  it('should handle shorthand /q command', () => {
    const result = parseCommand('/q fix the bug');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/q');
    expect(result.content).toBe('fix the bug');
  });

  it('should handle shorthand /c command', () => {
    const result = parseCommand('/c hey there');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/c');
    expect(result.content).toBe('hey there');
  });

  it('should trim whitespace', () => {
    const result = parseCommand('  /help  ');
    expect(result.isCommand).toBe(true);
    expect(result.command).toBe('/help');
  });
});

describe('getCommandType', () => {
  it('should return quest for /quest', () => {
    expect(getCommandType('/quest')).toBe('quest');
  });

  it('should return quest for /q', () => {
    expect(getCommandType('/q')).toBe('quest');
  });

  it('should return chat for /chat', () => {
    expect(getCommandType('/chat')).toBe('chat');
  });

  it('should return chat for /c', () => {
    expect(getCommandType('/c')).toBe('chat');
  });

  it('should return help for /help', () => {
    expect(getCommandType('/help')).toBe('help');
  });

  it('should return unknown for unrecognized commands', () => {
    expect(getCommandType('/unknown')).toBe('unknown');
    expect(getCommandType('/start')).toBe('unknown');
  });
});

describe('handleCommand', () => {
  const timestamp = 1234567890;

  describe('/quest command', () => {
    it('should queue quest with content', () => {
      const result = handleCommand('/quest', 'build feature', timestamp);
      expect(result.type).toBe('quest');
      expect(result.shouldQueue).toBe(true);
      expect(result.queuedMessage).toEqual({
        id: `msg_${timestamp}`,
        text: 'build feature',
        timestamp,
        isCommand: true,
        command: 'quest',
      });
      expect(result.responseText).toContain('Quest request queued');
    });

    it('should queue quest with default text when empty', () => {
      const result = handleCommand('/quest', '', timestamp);
      expect(result.queuedMessage?.text).toBe('New Quest requested');
    });
  });

  describe('/chat command', () => {
    it('should queue chat message', () => {
      const result = handleCommand('/chat', 'hello', timestamp);
      expect(result.type).toBe('chat');
      expect(result.shouldQueue).toBe(true);
      expect(result.queuedMessage).toEqual({
        id: `msg_${timestamp}`,
        text: 'hello',
        timestamp,
        isCommand: true,
        command: 'chat',
      });
      expect(result.responseText).toContain('Message queued');
    });
  });

  describe('/help command', () => {
    it('should return help text without queuing', () => {
      const result = handleCommand('/help', '', timestamp);
      expect(result.type).toBe('help');
      expect(result.shouldQueue).toBe(false);
      expect(result.queuedMessage).toBeUndefined();
      expect(result.responseText).toContain('Available Commands');
      expect(result.responseText).toContain('/quest');
      expect(result.responseText).toContain('/chat');
    });
  });

  describe('unknown command', () => {
    it('should not queue unknown commands', () => {
      const result = handleCommand('/unknown', 'content', timestamp);
      expect(result.type).toBe('unknown');
      expect(result.shouldQueue).toBe(false);
    });
  });
});

describe('MessageQueue', () => {
  it('should start empty', () => {
    const queue = createMessageQueue();
    expect(queue.getAll()).toEqual([]);
  });

  it('should push messages', () => {
    const queue = createMessageQueue();
    const msg = createQueuedMessage('test', 123);
    queue.push(msg);
    expect(queue.getAll()).toHaveLength(1);
    expect(queue.getAll()[0].text).toBe('test');
  });

  it('should return copy of messages', () => {
    const queue = createMessageQueue();
    queue.push(createQueuedMessage('test', 123));
    const messages = queue.getAll();
    messages.push(createQueuedMessage('fake', 456));
    expect(queue.getAll()).toHaveLength(1);
  });

  it('should clear messages', () => {
    const queue = createMessageQueue();
    queue.push(createQueuedMessage('test1', 123));
    queue.push(createQueuedMessage('test2', 456));
    expect(queue.getAll()).toHaveLength(2);
    queue.clear();
    expect(queue.getAll()).toHaveLength(0);
  });
});

describe('createQueuedMessage', () => {
  it('should create message with correct structure', () => {
    const msg = createQueuedMessage('hello', 1234567890);
    expect(msg).toEqual({
      id: 'msg_1234567890',
      text: 'hello',
      timestamp: 1234567890,
      isCommand: false,
    });
  });
});
