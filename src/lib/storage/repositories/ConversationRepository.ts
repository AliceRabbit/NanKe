import type Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import {
  createConversation,
  conversationSchema,
  conversationSnapshotSchema,
  type Conversation,
  type ConversationSnapshot,
  type ConversationSnapshotAsset,
  type ConversationWithMessages
} from '$lib/schemas/conversation';
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

type MessageAssetRow = {
  id: string;
  message_node_id: string;
  asset_id: string;
  kind: string;
  sort_order: number;
  data: string;
  created_at: number;
};

export type SwitchSiblingDirection = 'left' | 'right';

export type ConversationListOptions = {
  includeArchived?: boolean;
  characterId?: string;
  characterIds?: string[];
  queryCharacterIds?: string[];
  query?: string;
  limit?: number;
  offset?: number;
  beforeUpdatedAt?: number;
  beforeId?: string;
};

export type ActiveLeafOptions = {
  restoreSubtree?: boolean;
};

export type ConversationTreeNode = {
  id: string;
  parentId: string | null;
  role: string;
  speakerName?: string;
  preview: string;
  depth: number;
  siblingOrder: number;
  status: string;
  isActivePath: boolean;
  isActiveLeaf: boolean;
  childCount: number;
  branchCount: number;
  createdAt: number;
  updatedAt: number;
};

export type ConversationTreeSummary = {
  conversation: Conversation;
  nodes: ConversationTreeNode[];
};

export type ConversationSnapshotOptions = {
  includeDeleted?: boolean;
};

export type ConversationSnapshotImportOptions = {
  title?: string;
  source?: 'import' | 'clone';
};

export type ConversationPathForkOptions = {
  title?: string;
};

export class ConversationRepository {
  constructor(
    private readonly db: DrizzleDatabase = getDatabase(),
    private readonly sqlite: Database.Database = getDatabaseHandle().sqlite
  ) {}

  list(options: ConversationListOptions = {}): Conversation[] {
    const where: string[] = [];
    const params: Record<string, number | string> = {};
    if (!options.includeArchived) where.push('archived_at IS NULL');
    if (options.characterId) {
      where.push('character_id = @characterId');
      params.characterId = options.characterId;
    } else if (options.characterIds?.length) {
      where.push(`character_id IN (${options.characterIds.map((_, index) => `@characterId${index}`).join(', ')})`);
      for (const [index, id] of options.characterIds.entries()) params[`characterId${index}`] = id;
    }

    const query = options.query?.trim();
    if (query) {
      params.query = `%${escapeSqlLike(query)}%`;
      const queryClauses = [`title LIKE @query ESCAPE '\\'`, `COALESCE(last_preview, '') LIKE @query ESCAPE '\\'`];
      if (!options.characterId && options.queryCharacterIds?.length) {
        queryClauses.push(`character_id IN (${options.queryCharacterIds.map((_, index) => `@queryCharacterId${index}`).join(', ')})`);
        for (const [index, id] of options.queryCharacterIds.entries()) params[`queryCharacterId${index}`] = id;
      }
      where.push(`(${queryClauses.join(' OR ')})`);
    }

    const beforeUpdatedAt = options.beforeUpdatedAt;
    if (typeof beforeUpdatedAt === 'number' && Number.isFinite(beforeUpdatedAt) && options.beforeId) {
      where.push(`(updated_at < @beforeUpdatedAt OR (updated_at = @beforeUpdatedAt AND id < @beforeId))`);
      params.beforeUpdatedAt = Math.trunc(beforeUpdatedAt);
      params.beforeId = options.beforeId;
    }

    const limit = clampListLimit(options.limit);
    const offset = Math.max(0, Math.trunc(options.offset ?? 0));
    params.limit = limit;
    params.offset = offset;
    const rows = this.sqlite
      .prepare(
        `
        SELECT *
        FROM conversations
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY updated_at DESC, id DESC
        LIMIT @limit OFFSET @offset
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

  getTree(id: string): ConversationTreeSummary | undefined {
    const conversation = this.get(id);
    if (!conversation) return undefined;

    const rows = this.sqlite
      .prepare(
        `
        SELECT *
        FROM message_nodes
        WHERE conversation_id = ? AND kind = 'message' AND status != 'deleted'
        ORDER BY depth ASC, sibling_order ASC, created_at ASC
      `
      )
      .all(id) as MessageNodeRow[];
    const nodes = rows.map((row) => this.hydrateMessageNode(row));
    const childCounts = new Map<string, number>();
    for (const node of nodes) {
      if (!node.parentId) continue;
      childCounts.set(node.parentId, (childCounts.get(node.parentId) ?? 0) + 1);
    }

    const activePathIds = new Set(
      conversation.activeLeafId ? this.pathNodes(conversation.id, conversation.activeLeafId).map((node) => node.id) : []
    );

    return {
      conversation,
      nodes: nodes.map((node) => {
        const childCount = childCounts.get(node.id) ?? 0;
        return {
          id: node.id,
          parentId: node.parentId,
          role: node.role ?? 'system',
          speakerName: node.speakerName,
          preview: previewText(node.content || node.thinking || ''),
          depth: node.depth,
          siblingOrder: node.siblingOrder,
          status: node.status,
          isActivePath: activePathIds.has(node.id),
          isActiveLeaf: node.id === conversation.activeLeafId,
          childCount,
          branchCount: Math.max(0, childCount - 1),
          createdAt: node.createdAt,
          updatedAt: node.updatedAt
        };
      })
    };
  }

  exportSnapshot(id: string, options: ConversationSnapshotOptions = {}): ConversationSnapshot | undefined {
    const conversation = this.get(id);
    if (!conversation) return undefined;

    const rows = this.sqlite
      .prepare(
        `
        SELECT *
        FROM message_nodes
        WHERE conversation_id = @id
          ${options.includeDeleted ? '' : "AND status != 'deleted'"}
        ORDER BY depth ASC, sibling_order ASC, created_at ASC
      `
      )
      .all({ id }) as MessageNodeRow[];
    const nodes = rows.map((row) => this.hydrateMessageNode(row));
    const activePathNodeIds = conversation.activeLeafId
      ? this.pathNodes(conversation.id, conversation.activeLeafId)
          .filter((node) => options.includeDeleted || node.status !== 'deleted')
          .map((node) => node.id)
      : [];

    return {
      format: 'nanke.conversation.snapshot',
      version: 1,
      exportedAt: Date.now(),
      conversation,
      nodes,
      activePathNodeIds,
      assets: this.snapshotAssets(nodes.map((node) => node.id))
    };
  }

  importSnapshot(input: unknown, options: ConversationSnapshotImportOptions = {}): ConversationWithMessages {
    const snapshot = conversationSnapshotSchema.parse(input);
    const now = Date.now();
    const conversationId = crypto.randomUUID();
    const idMap = new Map(snapshot.nodes.map((node) => [node.id, crypto.randomUUID()]));
    const sourceRootNode = snapshot.nodes.find((node) => node.id === snapshot.conversation.rootNodeId) ?? snapshot.nodes.find((node) => node.kind === 'root');
    const rootNodeId = sourceRootNode ? idMap.get(sourceRootNode.id)! : crypto.randomUUID();
    const remappedNodes = snapshot.nodes.map((node) =>
      messageNodeSchema.parse({
        ...node,
        id: idMap.get(node.id),
        conversationId,
        parentId: node.parentId ? (idMap.get(node.parentId) ?? null) : null,
        lastActiveLeafId: node.lastActiveLeafId ? idMap.get(node.lastActiveLeafId) : undefined
      })
    );
    if (!sourceRootNode) {
      remappedNodes.unshift(createRootMessageNode(conversationId, rootNodeId));
    }

    const activeLeafId = this.importedActiveLeafId(snapshot, remappedNodes, idMap, rootNodeId);
    const title = options.title?.trim() || snapshot.conversation.title;
    const provenance = {
      format: snapshot.format,
      version: snapshot.version,
      conversationId: snapshot.conversation.id,
      exportedAt: snapshot.exportedAt,
      importedAt: now
    };
    const draftConversation = conversationSchema.parse({
      ...snapshot.conversation,
      id: conversationId,
      title,
      rootNodeId,
      activeLeafId,
      archivedAt: undefined,
      metadata: {
        ...snapshot.conversation.metadata,
        ...(options.source === 'clone' ? { clonedFrom: provenance } : { importedFrom: provenance })
      },
      createdAt: now,
      updatedAt: now
    });

    const transaction = this.sqlite.transaction(() => {
      this.persistConversation(draftConversation);
      for (const node of remappedNodes) this.insertNode(node);
      this.insertSnapshotAssets(snapshot.assets, idMap, now);
      const stats = this.conversationTreeStats(conversationId);
      const activeNode = this.getMessageNode(activeLeafId);
      this.persistConversation(
        conversationSchema.parse({
          ...draftConversation,
          nodeCount: stats.nodeCount,
          branchCount: stats.branchCount,
          activeDepth: activeNode?.depth ?? 0,
          lastPreview: activeNode?.kind === 'message' ? previewText(activeNode.content) : undefined,
          revision: 0,
          updatedAt: now
        })
      );
    });
    transaction();

    const imported = this.getWithMessages(conversationId);
    if (!imported) throw new Error(`Imported conversation could not be loaded: ${conversationId}`);
    return imported;
  }

  clone(id: string, title?: string): ConversationWithMessages | undefined {
    const snapshot = this.exportSnapshot(id);
    if (!snapshot) return undefined;
    return this.importSnapshot(snapshot, {
      title: title?.trim() || `Copy of ${snapshot.conversation.title}`,
      source: 'clone'
    });
  }

  forkPathToConversation(conversationId: string, nodeId: string, options: ConversationPathForkOptions = {}): ConversationWithMessages | undefined {
    const sourceConversation = this.get(conversationId);
    const sourceNode = this.getMessageNode(nodeId);
    if (!sourceConversation || !sourceNode || sourceNode.conversationId !== conversationId || sourceNode.kind !== 'message' || sourceNode.status === 'deleted') {
      return undefined;
    }

    const path = this.getPathNodesTo(conversationId, nodeId);
    if (!path.length) return undefined;

    const now = Date.now();
    const fork = createConversation({
      title: options.title?.trim() || `Fork of ${sourceConversation.title}`,
      characterId: sourceConversation.characterId,
      personaId: sourceConversation.personaId,
      profileId: sourceConversation.profileId,
      worldBookIds: sourceConversation.worldBookIds,
      metadata: {
        ...sourceConversation.metadata,
        forkedFrom: {
          conversationId: sourceConversation.id,
          nodeId,
          forkedAt: now
        }
      },
      createdAt: now,
      updatedAt: now
    });

    let parentId = fork.rootNodeId!;
    const forkNodes = path.map((node, index) => {
      const forkNode = createMessageNode({
        conversationId: fork.id,
        parentId,
        role: node.role,
        speakerId: node.speakerId,
        speakerName: node.speakerName,
        speakerAvatarAssetId: node.speakerAvatarAssetId,
        content: node.content,
        thinking: node.thinking,
        siblingOrder: 0,
        depth: index + 1,
        tokenEstimate: node.tokenEstimate ?? estimateStoredNodeTokens(node),
        metadata: {
          ...node.metadata,
          forkedFromNodeId: node.id
        },
        createdAt: node.createdAt,
        updatedAt: now
      });
      parentId = forkNode.id;
      return forkNode;
    });
    const activeLeaf = forkNodes.at(-1);
    if (!activeLeaf) return undefined;

    const transaction = this.sqlite.transaction(() => {
      this.persistConversation(fork);
      this.ensureRootNode(fork);
      for (const node of forkNodes) {
        this.insertNode(node);
        if (node.parentId) this.updateAncestorsLastLeaf(node.parentId, node.id, now);
      }
      this.persistConversation(
        conversationSchema.parse({
          ...fork,
          activeLeafId: activeLeaf.id,
          nodeCount: forkNodes.length,
          branchCount: 0,
          activeDepth: activeLeaf.depth,
          lastPreview: previewText(activeLeaf.content),
          revision: 0,
          updatedAt: now
        })
      );
    });
    transaction();

    return this.getWithMessages(fork.id);
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

  deleteNodeSubtree(conversationId: string, nodeId: string): ConversationWithMessages | undefined {
    const conversation = this.get(conversationId);
    const node = this.getMessageNode(nodeId);
    if (!conversation || !node || node.conversationId !== conversationId || node.kind !== 'message') return undefined;

    const subtreeIds = this.subtreeNodeIds(conversationId, nodeId);
    if (!subtreeIds.length) return undefined;

    const fallbackBase = node.parentId ? this.fallbackNodeAfterSubtreeDelete(conversationId, node.parentId, nodeId, subtreeIds) : undefined;
    const fallbackNode = fallbackBase ?? (conversation.rootNodeId ? this.getMessageNode(conversation.rootNodeId) : undefined);
    const activeLeafDeleted = conversation.activeLeafId ? subtreeIds.includes(conversation.activeLeafId) : false;
    const now = Date.now();

    const transaction = this.sqlite.transaction(() => {
      this.sqlite
        .prepare(
          `
          UPDATE message_nodes
          SET status = 'deleted',
              updated_at = @updatedAt
          WHERE conversation_id = @conversationId
            AND id IN (${subtreeIds.map((_, index) => `@id${index}`).join(', ')})
        `
        )
        .run(Object.fromEntries([['conversationId', conversationId], ['updatedAt', now], ...subtreeIds.map((id, index) => [`id${index}`, id])]));

      if (fallbackNode) {
        this.sqlite
          .prepare(
            `
            UPDATE message_nodes
            SET last_active_leaf_id = @fallbackId,
                updated_at = @updatedAt
            WHERE conversation_id = @conversationId
              AND last_active_leaf_id IN (${subtreeIds.map((_, index) => `@id${index}`).join(', ')})
          `
          )
          .run(Object.fromEntries([['conversationId', conversationId], ['fallbackId', fallbackNode.id], ['updatedAt', now], ...subtreeIds.map((id, index) => [`id${index}`, id])]));
      }

      const activeLeaf = activeLeafDeleted && fallbackNode ? this.resolveRestoredLeaf(fallbackNode) ?? fallbackNode : this.getMessageNode(conversation.activeLeafId ?? '');
      const stats = this.conversationTreeStats(conversationId);
      const updated = conversationSchema.parse({
        ...conversation,
        activeLeafId: activeLeaf?.id ?? conversation.rootNodeId,
        activeDepth: activeLeaf?.depth ?? 0,
        nodeCount: stats.nodeCount,
        branchCount: stats.branchCount,
        lastPreview: activeLeaf?.kind === 'message' ? previewText(activeLeaf.content) : undefined,
        revision: conversation.revision + 1,
        updatedAt: now
      });
      this.persistConversation(updated);
    });
    transaction();

    return this.getWithMessages(conversationId);
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

  editMessageAsSibling(conversationId: string, nodeId: string, content: string): ConversationWithMessages | undefined {
    const conversation = this.get(conversationId);
    const source = this.getMessageNode(nodeId);
    const trimmed = content.trim();
    if (
      !conversation ||
      !source ||
      source.conversationId !== conversationId ||
      source.kind !== 'message' ||
      source.status === 'deleted' ||
      !source.parentId ||
      !source.role ||
      !trimmed
    ) {
      return undefined;
    }

    const now = Date.now();
    const siblingOrder = this.nextSiblingOrder(conversation.id, source.parentId);
    const node = createMessageNode({
      conversationId: conversation.id,
      parentId: source.parentId,
      role: source.role,
      speakerId: source.speakerId,
      speakerName: source.speakerName,
      speakerAvatarAssetId: source.speakerAvatarAssetId,
      content: trimmed,
      siblingOrder,
      depth: source.depth,
      tokenEstimate: estimateStoredTokens({ ...this.toMessage(source, false), content: trimmed, thinking: undefined }),
      metadata: {
        ...source.metadata,
        editedFromNodeId: source.id,
        editedAt: now
      },
      createdAt: now,
      updatedAt: now
    });
    const updatedConversation = this.conversationAfterAppend(conversation, node, siblingOrder);

    const transaction = this.sqlite.transaction(() => {
      this.insertNode(node);
      this.updateAncestorsLastLeaf(source.parentId!, node.id, now);
      this.persistConversation(updatedConversation);
    });
    transaction();

    return this.getWithMessages(conversation.id);
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

  private snapshotAssets(messageNodeIds: string[]): ConversationSnapshotAsset[] {
    if (!messageNodeIds.length) return [];
    const params = Object.fromEntries(messageNodeIds.map((id, index) => [`id${index}`, id]));
    const rows = this.sqlite
      .prepare(
        `
        SELECT *
        FROM message_assets
        WHERE message_node_id IN (${messageNodeIds.map((_, index) => `@id${index}`).join(', ')})
        ORDER BY message_node_id ASC, sort_order ASC, created_at ASC
      `
      )
      .all(params) as MessageAssetRow[];
    return rows.map((row) => ({
      id: row.id,
      messageNodeId: row.message_node_id,
      assetId: row.asset_id,
      kind: row.kind,
      sortOrder: row.sort_order,
      data: JSON.parse(row.data) as Record<string, unknown>,
      createdAt: row.created_at
    }));
  }

  private importedActiveLeafId(snapshot: ConversationSnapshot, nodes: MessageNode[], idMap: Map<string, string>, rootNodeId: string): string {
    const nodesById = new Map(nodes.map((node) => [node.id, node]));
    const sourceActiveLeafId = snapshot.conversation.activeLeafId ? idMap.get(snapshot.conversation.activeLeafId) : undefined;
    if (sourceActiveLeafId && nodesById.get(sourceActiveLeafId)?.status !== 'deleted') return sourceActiveLeafId;

    for (const sourceNodeId of [...snapshot.activePathNodeIds].reverse()) {
      const nodeId = idMap.get(sourceNodeId);
      if (nodeId && nodesById.get(nodeId)?.status !== 'deleted') return nodeId;
    }

    return rootNodeId;
  }

  private insertSnapshotAssets(assets: ConversationSnapshotAsset[], idMap: Map<string, string>, importedAt: number): void {
    if (!assets.length) return;
    const insert = this.sqlite.prepare(
      `
      INSERT INTO message_assets (
        id,
        message_node_id,
        asset_id,
        kind,
        sort_order,
        data,
        created_at
      )
      VALUES (
        @id,
        @messageNodeId,
        @assetId,
        @kind,
        @sortOrder,
        @data,
        @createdAt
      )
    `
    );
    for (const asset of assets) {
      const messageNodeId = idMap.get(asset.messageNodeId);
      if (!messageNodeId) continue;
      insert.run({
        id: crypto.randomUUID(),
        messageNodeId,
        assetId: asset.assetId,
        kind: asset.kind,
        sortOrder: asset.sortOrder,
        data: JSON.stringify(asset.data ?? {}),
        createdAt: importedAt
      });
    }
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

  private subtreeNodeIds(conversationId: string, nodeId: string): string[] {
    return (
      this.sqlite
        .prepare(
          `
          WITH RECURSIVE subtree(id) AS (
            SELECT id
            FROM message_nodes
            WHERE id = @nodeId AND conversation_id = @conversationId AND kind = 'message' AND status != 'deleted'
            UNION ALL
            SELECT child.id
            FROM message_nodes child
            JOIN subtree parent ON child.parent_id = parent.id
            WHERE child.conversation_id = @conversationId AND child.kind = 'message' AND child.status != 'deleted'
          )
          SELECT id FROM subtree
        `
        )
        .all({ conversationId, nodeId }) as Array<{ id: string }>
    ).map((row) => row.id);
  }

  private fallbackNodeAfterSubtreeDelete(conversationId: string, parentId: string, nodeId: string, subtreeIds: string[]): MessageNode | undefined {
    const siblings = (
      this.sqlite
        .prepare(
          `
          SELECT id
          FROM message_nodes
          WHERE conversation_id = @conversationId
            AND parent_id = @parentId
            AND kind = 'message'
            AND status != 'deleted'
          ORDER BY sibling_order ASC, created_at ASC
        `
        )
        .all({ conversationId, parentId }) as Array<{ id: string }>
    ).map((row) => row.id);
    const currentIndex = Math.max(0, siblings.indexOf(nodeId));
    const remaining = siblings.filter((id) => !subtreeIds.includes(id));
    const siblingFallback = remaining[Math.min(currentIndex, remaining.length - 1)];
    return this.getMessageNode(siblingFallback ?? parentId);
  }

  private conversationTreeStats(conversationId: string): { nodeCount: number; branchCount: number } {
    const nodeCount = (
      this.sqlite
        .prepare(
          `
          SELECT COUNT(*) AS count
          FROM message_nodes
          WHERE conversation_id = ? AND kind = 'message' AND status != 'deleted'
        `
        )
        .get(conversationId) as { count: number }
    ).count;
    const branchCount = (
      this.sqlite
        .prepare(
          `
          SELECT COALESCE(SUM(extra), 0) AS count
          FROM (
            SELECT COUNT(*) - 1 AS extra
            FROM message_nodes
            WHERE conversation_id = ? AND kind = 'message' AND status != 'deleted'
            GROUP BY parent_id
            HAVING COUNT(*) > 1
          )
        `
        )
        .get(conversationId) as { count: number }
    ).count;
    return { nodeCount, branchCount };
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
    return leaf?.conversationId === node.conversationId && leaf.status !== 'deleted' ? leaf : undefined;
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

function estimateStoredNodeTokens(node: MessageNode): number {
  const contentLength = `${node.thinking ?? ''}${node.content}`.length;
  return Math.max(1, Math.ceil(contentLength / 4));
}

function clampListLimit(limit: number | undefined): number {
  if (!Number.isFinite(limit)) return 80;
  return Math.min(200, Math.max(1, Math.trunc(limit ?? 80)));
}

function escapeSqlLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

function previewText(content: string): string {
  return content.replace(/\s+/g, ' ').trim().slice(0, 160);
}
