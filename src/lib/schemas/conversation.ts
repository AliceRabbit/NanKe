import { z } from 'zod';
import { nankeMessageSchema } from './message';

export const conversationSchema = z.object({
  id: z.string(),
  title: z.string(),
  characterId: z.string().optional(),
  personaId: z.string().optional(),
  worldBookIds: z.array(z.string()).default([]),
  profileId: z.string().optional(),
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
  return conversationSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    title: input.title,
    characterId: input.characterId,
    personaId: input.personaId,
    worldBookIds: input.worldBookIds ?? [],
    profileId: input.profileId,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
