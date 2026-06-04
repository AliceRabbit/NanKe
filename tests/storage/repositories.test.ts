import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createConversation } from '$lib/schemas/conversation';
import { createMessage } from '$lib/schemas/message';
import { createUserPersona } from '$lib/schemas/user-persona';
import { initializeDatabase } from '$lib/storage/db';
import { ConversationRepository, UserPersonaRepository } from '$lib/storage/repositories';
import * as schema from '$lib/storage/schema';

describe('storage repositories', () => {
  it('persists conversations and messages in sqlite', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const personas = new UserPersonaRepository(db);
    const repository = new ConversationRepository(db, sqlite);

    const persona = personas.save(createUserPersona({ name: 'Mira', description: 'Careful archivist.', isDefault: true }));
    const conversation = repository.save(createConversation({ title: 'Test chat', personaId: persona.id }));
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Hello' }));

    const loaded = repository.getWithMessages(conversation.id);
    expect(loaded?.title).toBe('Test chat');
    expect(loaded?.personaId).toBe(persona.id);
    expect(loaded?.messages[0].content).toBe('Hello');
    expect(personas.getDefault()?.name).toBe('Mira');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('stores assistant alternatives as sibling nodes on the active path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Branching chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Try again.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'First answer.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Second answer.' }), user.id);

    let loaded = repository.getWithMessages(conversation.id);
    expect(loaded?.activeLeafId).toBe(second.id);
    expect(loaded?.branchCount).toBe(1);
    expect(loaded?.messages.at(-1)?.content).toBe('Second answer.');
    expect(loaded?.messages.at(-1)?.branch?.current).toBe(2);
    expect(loaded?.messages.at(-1)?.branch?.total).toBe(2);

    loaded = repository.switchSibling(first.id, 'left');
    expect(loaded?.activeLeafId).toBe(first.id);
    expect(loaded?.messages.at(-1)?.content).toBe('First answer.');
    expect(loaded?.messages.at(-1)?.branch?.current).toBe(1);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('renames, archives, restores, and deletes conversations', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Original', characterId: 'char-a' }));
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Hello' }));

    const renamed = repository.rename(conversation.id, 'Renamed');
    expect(renamed?.title).toBe('Renamed');

    const archived = repository.archive(conversation.id, true);
    expect(archived?.archivedAt).toEqual(expect.any(Number));
    expect(repository.list()).toHaveLength(0);
    expect(repository.list({ includeArchived: true })).toHaveLength(1);
    expect(repository.list({ includeArchived: true, characterId: 'char-a' })[0]?.title).toBe('Renamed');

    const restored = repository.archive(conversation.id, false);
    expect(restored?.archivedAt).toBeUndefined();
    expect(repository.list()).toHaveLength(1);

    expect(repository.delete(conversation.id)).toBe(true);
    expect(repository.get(conversation.id)).toBeUndefined();
    expect(repository.getWithMessages(conversation.id)).toBeUndefined();
    expect(repository.delete(conversation.id)).toBe(false);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
