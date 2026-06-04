import { z } from 'zod';
import { nankeMessageSchema } from './message';

export const providerRequestSchema = z.object({
  messages: z.array(nankeMessageSchema.pick({ role: true, name: true, content: true })),
  stop: z.array(z.string()).default([]),
  maxTokens: z.number().positive().optional(),
  temperature: z.number().optional(),
  topP: z.number().optional(),
  topK: z.number().optional(),
  topA: z.number().optional(),
  minP: z.number().optional(),
  frequencyPenalty: z.number().optional(),
  presencePenalty: z.number().optional(),
  repetitionPenalty: z.number().optional(),
  seed: z.number().int().optional(),
  n: z.number().int().positive().optional(),
  stream: z.boolean().optional()
});

export type ProviderRequest = z.infer<typeof providerRequestSchema>;

export const generationChunkSchema = z.object({
  type: z.enum(['text', 'thinking', 'done', 'error']),
  text: z.string().default(''),
  raw: z.unknown().optional()
});

export type GenerationChunk = z.infer<typeof generationChunkSchema>;
