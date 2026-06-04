import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';

export function resolveDataDir(): string {
  return process.env.NANKE_DATA_DIR ?? path.join(process.cwd(), '.nanke');
}

export function resolveDatabasePath(): string {
  return process.env.NANKE_DB_PATH ?? path.join(resolveDataDir(), 'nanke.db');
}

let cached: { sqlite: Database.Database; db: ReturnType<typeof drizzle<typeof schema>> } | undefined;

export function getDatabaseHandle() {
  if (cached) return cached;
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  const sqlite = new Database(resolveDatabasePath());
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  cached = { sqlite, db };
  initializeDatabase(sqlite);
  return cached;
}

export function getDatabase() {
  return getDatabaseHandle().db;
}

export function initializeDatabase(sqlite: Database.Database = getDatabaseHandle().sqlite): void {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      character_id TEXT,
      persona_id TEXT,
      profile_id TEXT,
      root_node_id TEXT,
      active_leaf_id TEXT,
      node_count INTEGER NOT NULL DEFAULT 0,
      branch_count INTEGER NOT NULL DEFAULT 0,
      active_depth INTEGER NOT NULL DEFAULT 0,
      last_preview TEXT,
      revision INTEGER NOT NULL DEFAULT 0,
      archived_at INTEGER,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS conversations_updated_idx
      ON conversations (updated_at DESC);

    CREATE INDEX IF NOT EXISTS conversations_archive_updated_idx
      ON conversations (archived_at, updated_at DESC);

    CREATE INDEX IF NOT EXISTS conversations_character_updated_idx
      ON conversations (character_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS conversations_updated_cursor_idx
      ON conversations (updated_at DESC, id DESC);

    CREATE INDEX IF NOT EXISTS conversations_archive_cursor_idx
      ON conversations (archived_at, updated_at DESC, id DESC);

    CREATE INDEX IF NOT EXISTS conversations_character_cursor_idx
      ON conversations (character_id, updated_at DESC, id DESC);

    CREATE TABLE IF NOT EXISTS message_nodes (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      parent_id TEXT,
      kind TEXT NOT NULL,
      role TEXT,
      speaker_id TEXT,
      speaker_name TEXT,
      speaker_avatar_asset_id TEXT,
      content TEXT NOT NULL DEFAULT '',
      thinking TEXT,
      sibling_order INTEGER NOT NULL,
      depth INTEGER NOT NULL,
      status TEXT NOT NULL,
      last_active_leaf_id TEXT,
      token_estimate INTEGER,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES message_nodes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS message_nodes_conversation_parent_order_idx
      ON message_nodes (conversation_id, parent_id, sibling_order);

    CREATE INDEX IF NOT EXISTS message_nodes_parent_idx
      ON message_nodes (parent_id);

    CREATE INDEX IF NOT EXISTS message_nodes_conversation_depth_idx
      ON message_nodes (conversation_id, depth);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
      ON messages (conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS message_assets (
      id TEXT PRIMARY KEY,
      message_node_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (message_node_id) REFERENCES message_nodes(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS message_assets_message_order_idx
      ON message_assets (message_node_id, sort_order);

    CREATE TABLE IF NOT EXISTS world_books (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_personas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_reports (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);

  const conversationColumns = sqlite.prepare(`PRAGMA table_info(conversations)`).all() as Array<{ name: string }>;
  if (!conversationColumns.some((column) => column.name === 'persona_id')) {
    sqlite.exec(`ALTER TABLE conversations ADD COLUMN persona_id TEXT;`);
  }
  addColumnIfMissing(sqlite, conversationColumns, 'root_node_id', `ALTER TABLE conversations ADD COLUMN root_node_id TEXT;`);
  addColumnIfMissing(sqlite, conversationColumns, 'active_leaf_id', `ALTER TABLE conversations ADD COLUMN active_leaf_id TEXT;`);
  addColumnIfMissing(sqlite, conversationColumns, 'node_count', `ALTER TABLE conversations ADD COLUMN node_count INTEGER NOT NULL DEFAULT 0;`);
  addColumnIfMissing(sqlite, conversationColumns, 'branch_count', `ALTER TABLE conversations ADD COLUMN branch_count INTEGER NOT NULL DEFAULT 0;`);
  addColumnIfMissing(sqlite, conversationColumns, 'active_depth', `ALTER TABLE conversations ADD COLUMN active_depth INTEGER NOT NULL DEFAULT 0;`);
  addColumnIfMissing(sqlite, conversationColumns, 'last_preview', `ALTER TABLE conversations ADD COLUMN last_preview TEXT;`);
  addColumnIfMissing(sqlite, conversationColumns, 'revision', `ALTER TABLE conversations ADD COLUMN revision INTEGER NOT NULL DEFAULT 0;`);
  addColumnIfMissing(sqlite, conversationColumns, 'archived_at', `ALTER TABLE conversations ADD COLUMN archived_at INTEGER;`);

  migrateLinearMessagesToNodes(sqlite);
}

function addColumnIfMissing(sqlite: Database.Database, columns: Array<{ name: string }>, name: string, sql: string): void {
  if (!columns.some((column) => column.name === name)) {
    sqlite.exec(sql);
    columns.push({ name });
  }
}

type ConversationRow = {
  id: string;
  title: string;
  character_id?: string | null;
  persona_id?: string | null;
  profile_id?: string | null;
  root_node_id?: string | null;
  active_leaf_id?: string | null;
  data: string;
  created_at: number;
  updated_at: number;
};

type LegacyMessageRow = {
  id: string;
  role: string;
  data: string;
  created_at: number;
};

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function migrateLinearMessagesToNodes(sqlite: Database.Database): void {
  const conversations = sqlite
    .prepare(
      `SELECT id, title, character_id, persona_id, profile_id, root_node_id, active_leaf_id, data, created_at, updated_at
       FROM conversations`
    )
    .all() as ConversationRow[];

  const countNodes = sqlite.prepare(`SELECT COUNT(*) AS count FROM message_nodes WHERE conversation_id = ?`);
  const legacyMessages = sqlite.prepare(`SELECT id, role, data, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC`);
  const insertNode = sqlite.prepare(`
    INSERT OR IGNORE INTO message_nodes (
      id, conversation_id, parent_id, kind, role, speaker_id, speaker_name, speaker_avatar_asset_id,
      content, thinking, sibling_order, depth, status, last_active_leaf_id, token_estimate, data, created_at, updated_at
    )
    VALUES (
      @id, @conversation_id, @parent_id, @kind, @role, @speaker_id, @speaker_name, @speaker_avatar_asset_id,
      @content, @thinking, @sibling_order, @depth, @status, @last_active_leaf_id, @token_estimate, @data, @created_at, @updated_at
    )
  `);
  const updateConversation = sqlite.prepare(`
    UPDATE conversations
    SET root_node_id = @root_node_id,
        active_leaf_id = @active_leaf_id,
        node_count = @node_count,
        branch_count = @branch_count,
        active_depth = @active_depth,
        last_preview = @last_preview,
        revision = COALESCE(revision, 0),
        data = @data,
        updated_at = @updated_at
    WHERE id = @id
  `);

  const migrate = sqlite.transaction(() => {
    for (const row of conversations) {
      const existingNodeCount = (countNodes.get(row.id) as { count: number }).count;
      const data = parseJsonObject(row.data);
      const rootNodeId = row.root_node_id || (typeof data.rootNodeId === 'string' ? data.rootNodeId : randomUUID());
      let activeLeafId = row.active_leaf_id || (typeof data.activeLeafId === 'string' ? data.activeLeafId : rootNodeId);
      let nodeCount = typeof data.nodeCount === 'number' ? data.nodeCount : 0;
      let activeDepth = typeof data.activeDepth === 'number' ? data.activeDepth : 0;
      let lastPreview = typeof data.lastPreview === 'string' ? data.lastPreview : undefined;

      if (existingNodeCount === 0) {
        const root = {
          id: rootNodeId,
          conversationId: row.id,
          parentId: null,
          kind: 'root',
          content: '',
          siblingOrder: 0,
          depth: 0,
          status: 'active',
          metadata: {},
          createdAt: row.created_at,
          updatedAt: row.updated_at
        };
        insertNode.run({
          id: root.id,
          conversation_id: row.id,
          parent_id: null,
          kind: 'root',
          role: null,
          speaker_id: null,
          speaker_name: null,
          speaker_avatar_asset_id: null,
          content: '',
          thinking: null,
          sibling_order: 0,
          depth: 0,
          status: 'active',
          last_active_leaf_id: null,
          token_estimate: null,
          data: JSON.stringify(root),
          created_at: root.createdAt,
          updated_at: root.updatedAt
        });

        let parentId = rootNodeId;
        let depth = 0;
        nodeCount = 0;
        for (const messageRow of legacyMessages.all(row.id) as LegacyMessageRow[]) {
          const message = parseJsonObject(messageRow.data);
          depth += 1;
          nodeCount += 1;
          const node = {
            id: messageRow.id,
            conversationId: row.id,
            parentId,
            kind: 'message',
            role: typeof message.role === 'string' ? message.role : messageRow.role,
            speakerName: typeof message.name === 'string' ? message.name : undefined,
            content: typeof message.content === 'string' ? message.content : '',
            thinking: typeof message.thinking === 'string' ? message.thinking : undefined,
            siblingOrder: 0,
            depth,
            status: 'active',
            metadata: typeof message.metadata === 'object' && message.metadata ? message.metadata : {},
            createdAt: messageRow.created_at,
            updatedAt: messageRow.created_at
          };
          insertNode.run({
            id: node.id,
            conversation_id: row.id,
            parent_id: parentId,
            kind: 'message',
            role: node.role,
            speaker_id: null,
            speaker_name: node.speakerName ?? null,
            speaker_avatar_asset_id: null,
            content: node.content,
            thinking: node.thinking ?? null,
            sibling_order: 0,
            depth,
            status: 'active',
            last_active_leaf_id: null,
            token_estimate: null,
            data: JSON.stringify(node),
            created_at: node.createdAt,
            updated_at: node.updatedAt
          });
          parentId = node.id;
          activeLeafId = node.id;
          activeDepth = depth;
          lastPreview = node.content.slice(0, 160);
        }
      }

      updateConversation.run({
        id: row.id,
        root_node_id: rootNodeId,
        active_leaf_id: activeLeafId,
        node_count: nodeCount,
        branch_count: typeof data.branchCount === 'number' ? data.branchCount : 0,
        active_depth: activeDepth,
        last_preview: lastPreview ?? null,
        data: JSON.stringify({
          ...data,
          id: row.id,
          title: typeof data.title === 'string' ? data.title : row.title,
          characterId: typeof data.characterId === 'string' ? data.characterId : row.character_id ?? undefined,
          personaId: typeof data.personaId === 'string' ? data.personaId : row.persona_id ?? undefined,
          profileId: typeof data.profileId === 'string' ? data.profileId : row.profile_id ?? undefined,
          rootNodeId,
          activeLeafId,
          nodeCount,
          branchCount: typeof data.branchCount === 'number' ? data.branchCount : 0,
          activeDepth,
          lastPreview,
          revision: typeof data.revision === 'number' ? data.revision : 0,
          metadata: data.metadata && typeof data.metadata === 'object' ? data.metadata : {},
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : row.created_at,
          updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : row.updated_at
        }),
        updated_at: row.updated_at
      });
    }
  });

  migrate();
}
