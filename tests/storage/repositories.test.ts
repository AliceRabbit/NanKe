import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';
import { createCharacter } from '$lib/schemas/character';
import { createConversation } from '$lib/schemas/conversation';
import { createMessage } from '$lib/schemas/message';
import { createUserPersona } from '$lib/schemas/user-persona';
import { createWorldBook } from '$lib/schemas/worldbook';
import { initializeDatabase } from '$lib/storage/db';
import { CharacterRepository, ConversationRepository, UserPersonaRepository, WorldBookRepository } from '$lib/storage/repositories';
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

  it('edits a message in place without creating a sibling branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Inline edit chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Original wording.' }));
    const assistant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Reply stays.' }));

    const loaded = repository.editMessage(conversation.id, user.id, 'Edited wording.');
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Edited wording.', 'Reply stays.']);
    expect(loaded?.branchCount).toBe(0);
    expect(loaded?.nodeCount).toBe(2);
    expect(loaded?.activeLeafId).toBe(assistant.id);
    expect(repository.getMessageNode(user.id)?.content).toBe('Edited wording.');
    expect(repository.getMessageNode(assistant.id)?.content).toBe('Reply stays.');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('continues an assistant message by appending to the active leaf', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Continue chat' }));
    repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Keep going.' }));
    const assistant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'First part' }));

    const loaded = repository.appendToMessage(conversation.id, assistant.id, ' and second part.', 'thoughts');
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Keep going.', 'First part and second part.']);
    expect(loaded?.messages.at(-1)?.thinking).toBe('thoughts');
    expect(loaded?.nodeCount).toBe(2);
    expect(loaded?.branchCount).toBe(0);
    expect(loaded?.activeLeafId).toBe(assistant.id);
    expect(repository.getMessageNode(assistant.id)?.content).toBe('First part and second part.');

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

  it('exports a native conversation snapshot with the full active graph', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Snapshot chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Pick one.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Option A.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Option B.' }), user.id);

    const snapshot = repository.exportSnapshot(conversation.id);
    expect(snapshot?.format).toBe('nanke.conversation.snapshot');
    expect(snapshot?.version).toBe(1);
    expect(snapshot?.conversation.id).toBe(conversation.id);
    expect(snapshot?.nodes.map((node) => node.id)).toContain(conversation.rootNodeId);
    expect(snapshot?.nodes.map((node) => node.id)).toContain(first.id);
    expect(snapshot?.nodes.map((node) => node.id)).toContain(second.id);
    expect(snapshot?.activePathNodeIds).toEqual([conversation.rootNodeId, user.id, second.id]);
    expect(snapshot?.nodes.find((node) => node.id === first.id)?.content).toBe('Option A.');
    expect(snapshot?.assets).toEqual([]);

    if (!snapshot) throw new Error('Snapshot was not created.');
    const imported = repository.importSnapshot(snapshot, { title: 'Restored snapshot' });
    expect(imported.id).not.toBe(conversation.id);
    expect(imported.title).toBe('Restored snapshot');
    expect(imported.messages.map((message) => message.content)).toEqual(['Pick one.', 'Option B.']);
    expect(imported.branchCount).toBe(1);

    const importedSnapshot = repository.exportSnapshot(imported.id);
    expect(importedSnapshot?.nodes.find((node) => node.content === 'Option A.')).toBeDefined();
    expect(importedSnapshot?.nodes.find((node) => node.id === first.id)).toBeUndefined();

    const cloned = repository.clone(conversation.id);
    expect(cloned?.id).not.toBe(conversation.id);
    expect(cloned?.title).toBe('Copy of Snapshot chat');
    expect(cloned?.messages.map((message) => message.content)).toEqual(['Pick one.', 'Option B.']);
    expect(cloned?.branchCount).toBe(1);

    const clonedSnapshot = cloned ? repository.exportSnapshot(cloned.id) : undefined;
    expect(clonedSnapshot?.nodes.find((node) => node.content === 'Option A.')).toBeDefined();
    expect(clonedSnapshot?.conversation.metadata.clonedFrom).toMatchObject({
      conversationId: conversation.id,
      format: 'nanke.conversation.snapshot',
      version: 1
    });
    expect(clonedSnapshot?.nodes.find((node) => node.id === second.id)).toBeUndefined();

    const forked = repository.forkPathToConversation(conversation.id, first.id);
    expect(forked?.id).not.toBe(conversation.id);
    expect(forked?.title).toBe('Fork of Snapshot chat');
    expect(forked?.messages.map((message) => message.content)).toEqual(['Pick one.', 'Option A.']);
    expect(forked?.branchCount).toBe(0);
    expect(forked?.metadata.forkedFrom).toMatchObject({ conversationId: conversation.id, nodeId: first.id });

    const forkedSnapshot = forked ? repository.exportSnapshot(forked.id) : undefined;
    expect(forkedSnapshot?.nodes.find((node) => node.content === 'Option B.')).toBeUndefined();
    expect(forkedSnapshot?.nodes.find((node) => node.id === first.id)).toBeUndefined();

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('deletes a node subtree and falls back from an active deleted branch', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Pruned chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Choose.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Keep me.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Delete me.' }), user.id);
    const descendant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Delete this descendant too.' }));

    const loaded = repository.deleteNodeSubtree(conversation.id, second.id);
    expect(loaded?.activeLeafId).toBe(first.id);
    expect(loaded?.nodeCount).toBe(2);
    expect(loaded?.branchCount).toBe(0);
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Choose.', 'Keep me.']);

    const summary = repository.getTree(conversation.id);
    expect(summary?.nodes.map((node) => node.id)).toEqual([user.id, first.id]);
    expect(repository.getMessageNode(second.id)).toBeUndefined();
    expect(repository.getMessageNode(descendant.id)).toBeUndefined();

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('deletes one node by splicing its descendants back into the tree', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Spliced chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Start.' }));
    const middle = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Remove only me.' }));
    const descendant = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Keep this descendant.' }));

    const loaded = repository.deleteNode(conversation.id, middle.id);
    expect(loaded?.messages.map((message) => message.content)).toEqual(['Start.', 'Keep this descendant.']);
    expect(loaded?.activeLeafId).toBe(descendant.id);
    expect(loaded?.nodeCount).toBe(2);
    expect(loaded?.branchCount).toBe(0);

    const deleted = repository.getMessageNode(middle.id);
    const preserved = repository.getMessageNode(descendant.id);
    expect(deleted).toBeUndefined();
    expect(preserved?.parentId).toBe(user.id);
    expect(preserved?.depth).toBe(2);

    const summary = repository.getTree(conversation.id);
    expect(summary?.nodes.map((node) => node.id)).toEqual([user.id, descendant.id]);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('purges deleted tombstones left by older delete semantics', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Tombstone cleanup chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Keep.' }));
    const stale = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Old deleted row.' }));
    sqlite.prepare(`UPDATE message_nodes SET status = 'deleted' WHERE id = @id`).run({ id: stale.id });

    expect(repository.purgeDeletedNodes(conversation.id)).toBe(1);
    expect(repository.getMessageNode(stale.id)).toBeUndefined();
    expect(repository.getMessageNode(user.id)?.content).toBe('Keep.');

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('repairs derived conversation state from the message tree', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const conversation = repository.save(createConversation({ title: 'Repairable chat' }));
    const user = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'user', content: 'Choose.' }));
    const first = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'First path.' }));
    const second = repository.appendMessage(createMessage({ conversationId: conversation.id, role: 'assistant', content: 'Second path.' }), user.id);
    const beforeRepair = repository.get(conversation.id);

    sqlite
      .prepare(
        `
        UPDATE conversations
        SET active_leaf_id = 'missing-node',
            node_count = 999,
            branch_count = 999,
            active_depth = 999,
            last_preview = 'stale preview'
        WHERE id = @id
      `
      )
      .run({ id: conversation.id });
    sqlite.prepare(`UPDATE message_nodes SET last_active_leaf_id = @leafId WHERE id = @id`).run({ id: user.id, leafId: first.id });

    const repaired = repository.repairDerivedState(conversation.id);
    expect(repaired?.activeLeafId).toBe(second.id);
    expect(repaired?.nodeCount).toBe(3);
    expect(repaired?.branchCount).toBe(1);
    expect(repaired?.activeDepth).toBe(2);
    expect(repaired?.lastPreview).toBe('Second path.');
    expect(repaired?.revision).toBe(beforeRepair?.revision);
    expect(repaired?.updatedAt).toBe(beforeRepair?.updatedAt);
    expect(repository.getMessageNode(user.id)?.lastActiveLeafId).toBe(second.id);
    expect(repository.getWithMessages(conversation.id)?.messages.map((message) => message.content)).toEqual(['Choose.', 'Second path.']);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('filters and pages conversation lists on the server side', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const repository = new ConversationRepository(db, sqlite);

    const alpha = repository.save(createConversation({ title: 'Alpha route', characterId: 'char-alpha' }));
    repository.appendMessage(createMessage({ conversationId: alpha.id, role: 'user', content: 'Hello.' }));
    const beta = repository.save(createConversation({ title: 'Beta route', characterId: 'char-beta' }));
    repository.appendMessage(createMessage({ conversationId: beta.id, role: 'user', content: 'The preview has a needle.' }));
    const archived = repository.save(createConversation({ title: 'Archived needle', characterId: 'char-archived' }));
    repository.archive(archived.id, true);
    const literal = repository.save(createConversation({ title: '100% literal', characterId: 'char-literal' }));

    expect(repository.list({ query: 'needle' }).map((conversation) => conversation.id)).toEqual([beta.id]);
    expect(repository.list({ includeArchived: true, query: 'needle' }).map((conversation) => conversation.id)).toContain(archived.id);
    expect(repository.list({ query: 'mira', queryCharacterIds: ['char-alpha'] }).map((conversation) => conversation.id)).toEqual([alpha.id]);
    expect(repository.list({ query: '100%' }).map((conversation) => conversation.id)).toEqual([literal.id]);
    expect(repository.list({ includeArchived: true, limit: 2 })).toHaveLength(2);
    expect(repository.list({ includeArchived: true, limit: 2, offset: 2 })).toHaveLength(2);

    const touch = sqlite.prepare(`UPDATE conversations SET updated_at = @updatedAt WHERE id = @id`);
    touch.run({ id: alpha.id, updatedAt: 400 });
    touch.run({ id: beta.id, updatedAt: 300 });
    touch.run({ id: archived.id, updatedAt: 200 });
    touch.run({ id: literal.id, updatedAt: 100 });
    const firstPage = repository.list({ includeArchived: true, limit: 2 });
    const cursor = firstPage.at(-1);
    const secondPage = repository.list({ includeArchived: true, limit: 2, beforeUpdatedAt: cursor?.updatedAt, beforeId: cursor?.id });
    expect(firstPage.map((conversation) => conversation.id)).toEqual([alpha.id, beta.id]);
    expect(secondPage.map((conversation) => conversation.id)).toEqual([archived.id, literal.id]);

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

  it('deletes world books and detaches character bindings', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanke-test-'));
    const sqlite = new Database(path.join(dir, 'test.db'));
    initializeDatabase(sqlite);
    const db = drizzle(sqlite, { schema });
    const characters = new CharacterRepository(db);
    const worldBooks = new WorldBookRepository(db);

    const lore = worldBooks.save(createWorldBook({ id: 'lore', name: 'Lore' }));
    const embedded = createWorldBook({ id: 'embedded-lore', name: 'Embedded Lore' });
    const character = characters.save(
      createCharacter({
        name: 'Mira',
        worldBookIds: [lore.id, 'shared-lore'],
        worldBookBindings: [
          { worldBookId: lore.id, enabled: true, primary: false },
          { worldBookId: 'shared-lore', enabled: false, primary: false }
        ],
        characterBook: embedded
      })
    );

    const deleted = worldBooks.delete(lore.id);
    expect(deleted.deleted).toBe(true);
    expect(deleted.affectedCharacterIds).toEqual([character.id]);
    expect(worldBooks.get(lore.id)).toBeUndefined();
    expect(characters.get(character.id)?.worldBookIds).toEqual(['shared-lore']);
    expect(characters.get(character.id)?.worldBookBindings).toEqual([{ worldBookId: 'shared-lore', enabled: false, primary: false }]);

    const embeddedDeleted = worldBooks.delete(embedded.id);
    expect(embeddedDeleted.deleted).toBe(true);
    expect(embeddedDeleted.removedEmbeddedCharacterBooks).toBe(1);
    expect(worldBooks.get(embedded.id)).toBeUndefined();
    expect(characters.get(character.id)?.characterBook).toBeUndefined();
    expect(worldBooks.delete('missing-lore').deleted).toBe(false);

    sqlite.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
