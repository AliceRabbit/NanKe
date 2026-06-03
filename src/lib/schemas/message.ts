import { z } from 'zod';

export const messageRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);
export type MessageRole = z.infer<typeof messageRoleSchema>;

export const nankeMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string().optional(),
  role: messageRoleSchema,
  name: z.string().optional(),
  content: z.string(),
  createdAt: z.number(),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export type NankeMessage = z.infer<typeof nankeMessageSchema>;

export function createMessage(input: Omit<NankeMessage, 'id' | 'createdAt' | 'metadata'> & Partial<Pick<NankeMessage, 'id' | 'createdAt' | 'metadata'>>): NankeMessage {
  return {
    id: input.id ?? crypto.randomUUID(),
    conversationId: input.conversationId,
    role: input.role,
    name: input.name,
    content: input.content,
    createdAt: input.createdAt ?? Date.now(),
    metadata: input.metadata ?? {}
  };
}
