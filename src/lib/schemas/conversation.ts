import { z } from 'zod';
import { nankeMessageSchema } from './message';

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  characterId: z.string().optional(),
  personaId: z.string().optional(),
  worldBookIds: z.array(z.string()).default([]),
  profileId: z.string().optional(),
  rootNodeId: z.string().optional(),
  activeLeafId: z.string().optional(),
  nodeCount: z.number().int().nonnegative().default(0),
  branchCount: z.number().int().nonnegative().default(0),
  activeDepth: z.number().int().nonnegative().default(0),
  lastPreview: z.string().optional(),
  revision: z.number().int().nonnegative().default(0),
  archivedAt: z.number().optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type Conversation = z.infer<typeof conversationSchema>;

export const conversationWithMessagesSchema = conversationSchema.extend({
  messages: z.array(nankeMessageSchema)
});

export type ConversationWithMessages = z.infer<typeof conversationWithMessagesSchema>;

export function createConversation(input: Partial<Conversation> & Pick<Conversation, 'title'>): Conversation {
  const now = Date.now();
  const id = input.id ?? crypto.randomUUID();
  const rootNodeId = input.rootNodeId ?? crypto.randomUUID();
  return conversationSchema.parse({
    id,
    title: input.title,
    characterId: input.characterId,
    personaId: input.personaId,
    worldBookIds: input.worldBookIds ?? [],
    profileId: input.profileId,
    rootNodeId,
    activeLeafId: input.activeLeafId ?? rootNodeId,
    nodeCount: input.nodeCount ?? 0,
    branchCount: input.branchCount ?? 0,
    activeDepth: input.activeDepth ?? 0,
    lastPreview: input.lastPreview,
    revision: input.revision ?? 0,
    archivedAt: input.archivedAt,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
