import type Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { conversationSchema, type Conversation, type ConversationWithMessages } from '$lib/schemas/conversation';
import {
  createMessageNode,
  createRootMessageNode,
  messageFromNode,
  messageNodeSchema,
  type MessageNode,
  type NankeMessage
} from '$lib/schemas/message';
import { conversations, messageNodes } from '../schema';
import { getDatabase, getDatabaseHandle } from '../db';

type DrizzleDatabase = ReturnType<typeof getDatabase>;

type ConversationRow = typeof conversations.$inferSelect;

type ConversationSqlRow = {
  id: string;
  title: string;
  character_id: string | null;
  persona_id: string | null;
  profile_id: string | null;
  root_node_id: string | null;
  active_leaf_id: string | null;
  node_count: number;
  branch_count: number;
  active_depth: number;
  last_preview: string | null;
  revision: number;
  archived_at: number | null;
  data: string;
  created_at: number;
  updated_at: number;
};

type MessageNodeRow = {
  id: string;
  conversation_id: string;
  parent_id: string | null;
  kind: string;
  role: string | null;
  speaker_id: string | null;
  speaker_name: string | null;
  speaker_avatar_asset_id: string | null;
  content: string;
  thinking: string | null;
  sibling_order: number;
  depth: number;
  status: string;
  last_active_leaf_id: string | null;
  token_estimate: number | null;
  data: string;
  created_at: number;
  updated_at: number;
};

export type SwitchSiblingDirection = 'left' | 'right';

export type ConversationListOptions = {
  includeArchived?: boolean;
  characterId?: string;
};

export type ActiveLeafOptions = {
  restoreSubtree?: boolean;
};

export class ConversationRepository {
  constructor(
    private readonly db: DrizzleDatabase = getDatabase(),
    private readonly sqlite: Database.Database = getDatabaseHandle().sqlite
  ) {}

  list(options: ConversationListOptions = {}): Conversation[] {
    const where: string[] = [];
    const params: Record<string, string> = {};
    if (!options.includeArchived) where.push('archived_at IS NULL');
    if (options.characterId) {
      where.push('character_id = @characterId');
      params.characterId = options.characterId;
    }

    const rows = this.sqlite
      .prepare(
        `
        SELECT *
        FROM conversations
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC
      `
      )
      .all(params) as ConversationSqlRow[];
    return rows.map((row) => this.hydrateConversationSql(row));
  }

  get(id: string): Conversation | undefined {
    const row = this.db.select().from(conversations).where(eq(conversations.id, id)).get();
    return row ? this.hydrateConversation(row) : undefined;
  }

  getWithMessages(id: string): ConversationWithMessages | undefined {
    const conversation = this.get(id);
    if (!conversation) return undefined;
    return { ...conversation, messages: this.listMessages(id) };
  }

  save(conversation: Conversation): Conversation {
    const rootNodeId = conversation.rootNodeId ?? crypto.randomUUID();
    const activeLeafId = conversation.activeLeafId ?? rootNodeId;
    const updated = conversationSchema.parse({
      ...conversation,
      rootNodeId,
      activeLeafId,
      updatedAt: Date.now()
    });

    const transaction = this.sqlite.transaction(() => {
      this.persistConversation(updated);
      this.ensureRootNode(updated);
    });
    transaction();

    return updated;
  }

  rename(id: string, title: string): Conversation | undefined {
    const conversation = this.get(id);
    const trimmed = title.trim();
    if (!conversation || !trimmed) return undefined;
    return this.save({
      ...conversation,
      title: trimmed,
      revision: conversation.revision + 1
    });
  }

  archive(id: string, archived = true): Conversation | undefined {
    const conversation = this.get(id);
    if (!conversation) return undefined;
    const updated = conversationSchema.parse({
      ...conversation,
      archivedAt: archived ? Date.now() : undefined,
      revision: conversation.revision + 1,
      updatedAt: Date.now()
    });
    this.persistConversation(updated);
    return updated;
  }

  delete(id: string): boolean {
    const remove = this.sqlite.transaction(() => {
      this.sqlite
        .prepare(
          `DELETE FROM message_assets
           WHERE message_node_id IN (SELECT id FROM message_nodes WHERE conversation_id = ?)`
        )
        .run(id);
      this.sqlite.prepare(`DELETE FROM message_nodes WHERE conversation_id = ?`).run(id);
      this.sqlite.prepare(`DELETE FROM messages WHERE conversation_id = ?`).run(id);
      return this.sqlite.prepare(`DELETE FROM conversations WHERE id = ?`).run(id).changes > 0;
    });
    return remove();
  }

  listMessages(conversationId: string): NankeMessage[] {
    const conversation = this.get(conversationId);
    if (!conversation) return [];
    const leafId = conversation.activeLeafId ?? conversation.rootNodeId;
    if (!leafId) return [];
    return this.pathMessages(conversationId, leafId);
  }

  getActivePathNodes(conversationId: string): MessageNode[] {
    const conversation = this.get(conversationId);
    if (!conversation?.activeLeafId) return [];
    return this.pathNodes(conversationId, conversation.activeLeafId).filter((node) => node.kind === 'message' && node.status !== 'deleted');
  }

  getPathNodesTo(conversationId: string, nodeId: string): MessageNode[] {
    return this.pathNodes(conversationId, nodeId).filter((node) => node.kind === 'message' && node.status !== 'deleted');
  }

  getMessageNode(id: string): MessageNode | undefined {
    const row = this.sqlite.prepare(`SELECT * FROM message_nodes WHERE id = ?`).get(id) as MessageNodeRow | undefined;
    return row ? this.hydrateMessageNode(row) : undefined;
  }

  appendMessage(message: NankeMessage, parentId?: string): NankeMessage {
    if (!message.conversationId) throw new Error('Message requires conversationId before persistence.');
    const conversation = this.get(message.conversationId);
    if (!conversation) throw new Error(`Conversation not found: ${message.conversationId}`);
    const resolvedParentId = parentId ?? conversation.activeLeafId ?? conversation.rootNodeId;
    if (!resolvedParentId) throw new Error(`Conversation has no root node: ${conversation.id}`);
    const parent = this.getMessageNode(resolvedParentId);
    if (!parent || parent.conversationId !== conversation.id) {
      throw new Error(`Parent node not found in conversation: ${resolvedParentId}`);
    }

    const now = Date.now();
    const siblingOrder = this.nextSiblingOrder(conversation.id, parent.id);
    const node = createMessageNode({
      id: message.id,
      conversationId: conversation.id,
      parentId: parent.id,
      role: message.role,
      speakerName: message.name,
      content: message.content,
      thinking: message.thinking,
      siblingOrder,
      depth: parent.depth + 1,
      tokenEstimate: estimateStoredTokens(message),
      metadata: message.metadata,
      createdAt: message.createdAt,
      updatedAt: now
    });
    const updatedConversation = this.conversationAfterAppend(conversation, node, siblingOrder);

    const transaction = this.sqlite.transaction(() => {
      this.insertNode(node);
      this.updateAncestorsLastLeaf(parent.id, node.id, now);
      this.persistConversation(updatedConversation);
    });
    transaction();

    return this.toMessage(node, true);
  }

  setActiveLeaf(conversationId: string, leafId: string, options: ActiveLeafOptions = {}): ConversationWithMessages | undefined {
    const conversation = this.get(conversationId);
    const node = this.getMessageNode(leafId);
    if (!conversation || !node || node.conversationId !== conversationId) return undefined;

    const leaf = options.restoreSubtree === false ? node : this.resolveRestoredLeaf(node) ?? node;
    const updated = conversationSchema.parse({
      ...conversation,
      activeLeafId: leaf.id,
      activeDepth: leaf.depth,
      lastPreview: previewText(leaf.content),
      revision: conversation.revision + 1,
      updatedAt: Date.now()
    });

    const transaction = this.sqlite.transaction(() => {
      if (node.parentId) this.updateAncestorsLastLeaf(node.parentId, leaf.id, updated.updatedAt);
      this.persistConversation(updated);
    });
    transaction();

    return this.getWithMessages(conversationId);
  }

  switchSibling(messageId: string, direction: SwitchSiblingDirection): ConversationWithMessages | undefined {
    const node = this.getMessageNode(messageId);
    if (!node || node.kind !== 'message' || !node.parentId) return undefined;
    const siblings = this.siblingRows(node.conversationId, node.parentId);
    const currentIndex = siblings.findIndex((sibling) => sibling.id === node.id);
    if (currentIndex < 0) return undefined;
    const nextIndex = direction === 'left' ? Math.max(0, currentIndex - 1) : Math.min(siblings.length - 1, currentIndex + 1);
    const target = siblings[nextIndex];
    if (!target) return undefined;
    return this.setActiveLeaf(node.conversationId, target.id);
  }

  private hydrateConversation(row: ConversationRow): Conversation {
    const data = conversationSchema.parse(row.data);
    return conversationSchema.parse({
      ...data,
      id: row.id,
      title: row.title,
      characterId: row.characterId ?? data.characterId,
      personaId: row.personaId ?? data.personaId,
      profileId: row.profileId ?? data.profileId,
      rootNodeId: row.rootNodeId ?? data.rootNodeId,
      activeLeafId: row.activeLeafId ?? data.activeLeafId,
      nodeCount: row.nodeCount ?? data.nodeCount,
      branchCount: row.branchCount ?? data.branchCount,
      activeDepth: row.activeDepth ?? data.activeDepth,
      lastPreview: row.lastPreview ?? data.lastPreview,
      revision: row.revision ?? data.revision,
      archivedAt: row.archivedAt ?? data.archivedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    });
  }

  private hydrateConversationSql(row: ConversationSqlRow): Conversation {
    const data = conversationSchema.parse(JSON.parse(row.data));
    return conversationSchema.parse({
      ...data,
      id: row.id,
      title: row.title,
      characterId: row.character_id ?? data.characterId,
      personaId: row.persona_id ?? data.personaId,
      profileId: row.profile_id ?? data.profileId,
      rootNodeId: row.root_node_id ?? data.rootNodeId,
      activeLeafId: row.active_leaf_id ?? data.activeLeafId,
      nodeCount: row.node_count ?? data.nodeCount,
      branchCount: row.branch_count ?? data.branchCount,
      activeDepth: row.active_depth ?? data.activeDepth,
      lastPreview: row.last_preview ?? data.lastPreview,
      revision: row.revision ?? data.revision,
      archivedAt: row.archived_at ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  private persistConversation(conversation: Conversation): void {
    this.db
      .insert(conversations)
      .values({
        id: conversation.id,
        title: conversation.title,
        characterId: conversation.characterId,
        personaId: conversation.personaId,
        profileId: conversation.profileId,
        rootNodeId: conversation.rootNodeId,
        activeLeafId: conversation.activeLeafId,
        nodeCount: conversation.nodeCount,
        branchCount: conversation.branchCount,
        activeDepth: conversation.activeDepth,
        lastPreview: conversation.lastPreview,
        revision: conversation.revision,
        archivedAt: conversation.archivedAt ?? null,
        data: conversation,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          title: conversation.title,
          characterId: conversation.characterId,
          personaId: conversation.personaId,
          profileId: conversation.profileId,
          rootNodeId: conversation.rootNodeId,
          activeLeafId: conversation.activeLeafId,
          nodeCount: conversation.nodeCount,
          branchCount: conversation.branchCount,
          activeDepth: conversation.activeDepth,
          lastPreview: conversation.lastPreview,
          revision: conversation.revision,
          archivedAt: conversation.archivedAt ?? null,
          data: conversation,
          updatedAt: conversation.updatedAt
        }
      })
      .run();
  }

  private ensureRootNode(conversation: Conversation): void {
    if (!conversation.rootNodeId) return;
    const existing = this.getMessageNode(conversation.rootNodeId);
    if (existing) return;
    this.insertNode(createRootMessageNode(conversation.id, conversation.rootNodeId));
  }

  private pathMessages(conversationId: string, leafId: string): NankeMessage[] {
    const nodes = this.pathNodes(conversationId, leafId).filter((node) => node.kind === 'message' && node.status !== 'deleted');
    const latestNodeId = nodes.at(-1)?.id;
    return nodes.map((node) => this.toMessage(node, node.id === latestNodeId));
  }

  private pathNodes(conversationId: string, leafId: string): MessageNode[] {
    const rows = this.sqlite
      .prepare(
        `
        WITH RECURSIVE path AS (
          SELECT *
          FROM message_nodes
          WHERE id = @leafId AND conversation_id = @conversationId
          UNION ALL
          SELECT parent.*
          FROM message_nodes parent
          JOIN path child ON child.parent_id = parent.id
          WHERE parent.conversation_id = @conversationId
        )
        SELECT *
        FROM path
        ORDER BY depth ASC, created_at ASC
      `
      )
      .all({ conversationId, leafId }) as MessageNodeRow[];

    return rows.map((row) => this.hydrateMessageNode(row));
  }

  private hydrateMessageNode(row: MessageNodeRow): MessageNode {
    const parsed = JSON.parse(row.data) as Record<string, unknown>;
    return messageNodeSchema.parse({
      ...parsed,
      id: row.id,
      conversationId: row.conversation_id,
      parentId: row.parent_id,
      kind: row.kind,
      role: row.role ?? undefined,
      speakerId: row.speaker_id ?? undefined,
      speakerName: row.speaker_name ?? undefined,
      speakerAvatarAssetId: row.speaker_avatar_asset_id ?? undefined,
      content: row.content,
      thinking: row.thinking ?? undefined,
      siblingOrder: row.sibling_order,
      depth: row.depth,
      status: row.status,
      lastActiveLeafId: row.last_active_leaf_id ?? undefined,
      tokenEstimate: row.token_estimate ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    });
  }

  private insertNode(node: MessageNode): void {
    this.db
      .insert(messageNodes)
      .values({
        id: node.id,
        conversationId: node.conversationId,
        parentId: node.parentId,
        kind: node.kind,
        role: node.role,
        speakerId: node.speakerId,
        speakerName: node.speakerName,
        speakerAvatarAssetId: node.speakerAvatarAssetId,
        content: node.content,
        thinking: node.thinking,
        siblingOrder: node.siblingOrder,
        depth: node.depth,
        status: node.status,
        lastActiveLeafId: node.lastActiveLeafId,
        tokenEstimate: node.tokenEstimate,
        data: node,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt
      })
      .onConflictDoUpdate({
        target: messageNodes.id,
        set: {
          content: node.content,
          thinking: node.thinking,
          status: node.status,
          lastActiveLeafId: node.lastActiveLeafId,
          tokenEstimate: node.tokenEstimate,
          data: node,
          updatedAt: node.updatedAt
        }
      })
      .run();
  }

  private nextSiblingOrder(conversationId: string, parentId: string): number {
    const row = this.sqlite
      .prepare(
        `SELECT COALESCE(MAX(sibling_order), -1) + 1 AS next
         FROM message_nodes
         WHERE conversation_id = ? AND parent_id = ? AND status != 'deleted'`
      )
      .get(conversationId, parentId) as { next: number };
    return row.next;
  }

  private siblingRows(conversationId: string, parentId: string): Array<{ id: string; last_active_leaf_id: string | null }> {
    return this.sqlite
      .prepare(
        `SELECT id, last_active_leaf_id
         FROM message_nodes
         WHERE conversation_id = ? AND parent_id = ? AND kind = 'message' AND status != 'deleted'
         ORDER BY sibling_order ASC, created_at ASC`
      )
      .all(conversationId, parentId) as Array<{ id: string; last_active_leaf_id: string | null }>;
  }

  private updateAncestorsLastLeaf(parentId: string, leafId: string, updatedAt: number): void {
    this.sqlite
      .prepare(
        `
        WITH RECURSIVE ancestors(id) AS (
          SELECT id FROM message_nodes WHERE id = @parentId
          UNION ALL
          SELECT parent.id
          FROM message_nodes parent
          JOIN message_nodes child ON child.parent_id = parent.id
          JOIN ancestors ON ancestors.id = child.id
        )
        UPDATE message_nodes
        SET last_active_leaf_id = @leafId,
            updated_at = @updatedAt
        WHERE id IN (SELECT id FROM ancestors)
      `
      )
      .run({ parentId, leafId, updatedAt });
  }

  private resolveRestoredLeaf(node: MessageNode): MessageNode | undefined {
    if (!node.lastActiveLeafId) return undefined;
    const leaf = this.getMessageNode(node.lastActiveLeafId);
    return leaf?.conversationId === node.conversationId ? leaf : undefined;
  }

  private conversationAfterAppend(conversation: Conversation, node: MessageNode, siblingOrder: number): Conversation {
    return conversationSchema.parse({
      ...conversation,
      activeLeafId: node.id,
      nodeCount: conversation.nodeCount + 1,
      branchCount: conversation.branchCount + (siblingOrder > 0 ? 1 : 0),
      activeDepth: node.depth,
      lastPreview: previewText(node.content),
      revision: conversation.revision + 1,
      updatedAt: Date.now()
    });
  }

  private toMessage(node: MessageNode, isLatest: boolean): NankeMessage {
    const siblings = node.parentId ? this.siblingRows(node.conversationId, node.parentId) : [{ id: node.id, last_active_leaf_id: null }];
    const currentIndex = Math.max(
      0,
      siblings.findIndex((sibling) => sibling.id === node.id)
    );
    return messageFromNode(node, {
      nodeId: node.id,
      parentId: node.parentId,
      current: currentIndex + 1,
      total: Math.max(1, siblings.length),
      siblingNodeIds: siblings.map((sibling) => sibling.id),
      isLatest
    });
  }
}

function estimateStoredTokens(message: NankeMessage): number {
  const contentLength = `${message.thinking ?? ''}${message.content}`.length;
  return Math.max(1, Math.ceil(contentLength / 4));
}

function previewText(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 160);
}
