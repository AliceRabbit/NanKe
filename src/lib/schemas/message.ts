import { z } from 'zod';

export const messageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const messageNodeKindSchema = z.enum(['root', 'message']);
export type MessageNodeKind = z.infer<typeof messageNodeKindSchema>;

export const messageNodeStatusSchema = z.enum(['active', 'archived', 'deleted', 'interrupted']);
export type MessageNodeStatus = z.infer<typeof messageNodeStatusSchema>;

export const messageBranchSchema = z.object({
  nodeId: z.string(),
  parentId: z.string().nullable(),
  current: z.number().int().positive(),
  total: z.number().int().positive(),
  siblingNodeIds: z.array(z.string()).default([]),
  isLatest: z.boolean().default(false)
});

export const nankeMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional(),
  role: messageRoleSchema,
  speakerId: z.string().optional(),
  name: z.string().optional(),
  speakerAvatarAssetId: z.string().optional(),
  content: z.string(),
  thinking: z.string().optional(),
  createdAt: z.number(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  branch: messageBranchSchema.optional()
});

export type NankeMessage = z.infer<typeof nankeMessageSchema>;

export const messageNodeSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  parentId: z.string().nullable(),
  kind: messageNodeKindSchema,
  role: messageRoleSchema.optional(),
  speakerId: z.string().optional(),
  speakerName: z.string().optional(),
  speakerAvatarAssetId: z.string().optional(),
  content: z.string().default(''),
  thinking: z.string().optional(),
  siblingOrder: z.number().int().nonnegative(),
  depth: z.number().int().nonnegative(),
  status: messageNodeStatusSchema.default('active'),
  lastActiveLeafId: z.string().optional(),
  tokenEstimate: z.number().int().nonnegative().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type MessageNode = z.infer<typeof messageNodeSchema>;

export function createMessage(
  input: Omit<NankeMessage, 'id' | 'createdAt' | 'metadata'> & Partial<Pick<NankeMessage, 'id' | 'createdAt' | 'metadata' | 'thinking' | 'branch'>>
): NankeMessage {
  return {
    id: input.id ?? crypto.randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    speakerId: input.speakerId,
    name: input.name,
    speakerAvatarAssetId: input.speakerAvatarAssetId,
    content: input.content,
    thinking: input.thinking,
    createdAt: input.createdAt ?? Date.now(),
    metadata: input.metadata ?? {},
    branch: input.branch
  };
}

export function createRootMessageNode(conversationId: string, id: string = crypto.randomUUID()): MessageNode {
  const now = Date.now();
  return messageNodeSchema.parse({
    id,
    conversationId,
    parentId: null,
    kind: 'root',
    content: '',
    siblingOrder: 0,
    depth: 0,
    status: 'active',
    metadata: {},
    createdAt: now,
    updatedAt: now
  });
}

export function createMessageNode(
  input: Omit<MessageNode, 'id' | 'kind' | 'status' | 'createdAt' | 'updatedAt' | 'metadata'> &
    Partial<Pick<MessageNode, 'id' | 'kind' | 'status' | 'createdAt' | 'updatedAt' | 'metadata'>>
): MessageNode {
  const now = Date.now();
  return messageNodeSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    conversationId: input.conversationId,
    parentId: input.parentId,
    kind: input.kind ?? 'message',
    role: input.role,
    speakerId: input.speakerId,
    speakerName: input.speakerName,
    speakerAvatarAssetId: input.speakerAvatarAssetId,
    content: input.content,
    thinking: input.thinking,
    siblingOrder: input.siblingOrder,
    depth: input.depth,
    status: input.status ?? 'active',
    lastActiveLeafId: input.lastActiveLeafId,
    tokenEstimate: input.tokenEstimate,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}

export function messageFromNode(node: MessageNode, branch?: z.infer<typeof messageBranchSchema>): NankeMessage {
  if (node.kind !== 'message' || !node.role) {
    throw new Error('Cannot convert a non-message node into a chat message.');
  }

  return createMessage({
    id: node.id,
    conversationId: node.conversationId,
    role: node.role,
    speakerId: node.speakerId,
    name: node.speakerName,
    speakerAvatarAssetId: node.speakerAvatarAssetId,
    content: node.content,
    thinking: node.thinking,
    createdAt: node.createdAt,
    metadata: {
      ...node.metadata,
      node: {
        parentId: node.parentId,
        depth: node.depth,
        siblingOrder: node.siblingOrder,
        status: node.status,
        speakerId: node.speakerId,
        speakerAvatarAssetId: node.speakerAvatarAssetId,
        tokenEstimate: node.tokenEstimate
      }
    },
    branch
  });
}
