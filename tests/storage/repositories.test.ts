import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createConversation } from '$lib/schemas/conversation';
import { createMessage } from '$lib/schemas/message';
import { initializeDatabase } from '$lib/storage/db';
import { ConversationRepository } from '$lib/storage/repositories';
import * as schema from '$lib/storage/schema';

describe('storage repositories', () => {
  it('persists conversations and messages in sqlite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db);

    const conversation = repository.save(createConversation({ title: 'Test chat' }));
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Hello' }));

    const loaded = repository.getWithMessages(conversation.id);
    expect(loaded?.title).toBe('Test chat');
    expect(loaded?.messages[0].content).toBe('Hello');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
