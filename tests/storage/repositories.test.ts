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

  it('edits a message by creating a sibling branch without mutating the original node', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Edited branch chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Original wording.' }));
    const assistant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Reply to original.' }));

    const loaded = repository.editMessageAsSibling(conversation.id, user.id, 'Edited wording.');
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Edited wording.']);
    expect(loaded?.branchCount).toBe(1);
    expect(loaded?.activeLeafId).not.toBe(user.id);
    expect(repository.getMessageNode(user.id)?.content).toBe('Original wording.');

    const edited = loaded?.messages[0];
    expect(edited?.branch?.current).toBe(2);
    expect(edited?.branch?.total).toBe(2);
    expect(edited?.branch?.nodeId).not.toBe(user.id);

    const restored = repository.switchSibling(edited?.branch?.nodeId ?? '', 'left');
    expect(restored?.activeLeafId).toBe(assistant.id);
    expect(restored?.messages.map((message) => message.content)).toEqual(['Original wording.', 'Reply to original.']);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('can focus an exact historical node without restoring its subtree', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Deep branch chat' }));
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Start.' }));
    const assistant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Path A.' }));
    const followup = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Followup.' }));

    let loaded = repository.setActiveLeaf(conversation.id, assistant.id);
    expect(loaded?.activeLeafId).toBe(followup.id);
    expect(loaded?.messages.at(-1)?.content).toBe('Followup.');

    loaded = repository.setActiveLeaf(conversation.id, assistant.id, { restoreSubtree: false });
    expect(loaded?.activeLeafId).toBe(assistant.id);
    expect(loaded?.messages.at(-1)?.content).toBe('Path A.');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns a compact tree summary with active path markers', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Tree map chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Pick a route.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Route A.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Route B.' }), user.id);

    const summary = repository.getTree(conversation.id);
    expect(summary?.nodes).toHaveLength(3);
    expect(summary?.nodes.find((node) => node.id === user.id)?.childCount).toBe(2);
    expect(summary?.nodes.find((node) => node.id === first.id)?.isActivePath).toBe(false);
    expect(summary?.nodes.find((node) => node.id === second.id)?.isActiveLeaf).toBe(true);
    expect(summary?.nodes.find((node) => node.id === second.id)?.preview).toBe('Route B.');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('soft-deletes a node subtree and falls back from an active deleted branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Pruned chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Choose.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Keep me.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Delete me.' }), user.id);
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Delete this descendant too.' }));

    const loaded = repository.deleteNodeSubtree(conversation.id, second.id);
    expect(loaded?.activeLeafId).toBe(first.id);
    expect(loaded?.nodeCount).toBe(2);
    expect(loaded?.branchCount).toBe(0);
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Choose.', 'Keep me.']);

    const summary = repository.getTree(conversation.id);
    expect(summary?.nodes.map((node) => node.id)).toEqual([user.id, first.id]);
    expect(repository.getMessageNode(second.id)?.status).toBe('deleted');

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
