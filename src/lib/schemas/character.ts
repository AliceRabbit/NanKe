import { z } from 'zod';
import { worldBookSchema } from './worldbook';

export const characterDepthPromptSchema = z.object({
  prompt: z.string().default(''),
  depth: z.number().default(4),
  role: z.enum(['system', 'user', 'assistant']).default('system')
});

export const characterSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  personality: z.string().default(''),
  scenario: z.string().default(''),
  firstMessage: z.string().default(''),
  exampleMessages: z.string().default(''),
  creatorNotes: z.string().default(''),
  systemPrompt: z.string().default(''),
  postHistoryInstructions: z.string().default(''),
  alternateGreetings: z.array(z.string()).default([]),
  groupOnlyGreetings: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  creator: z.string().default(''),
  creatorComment: z.string().default(''),
  characterVersion: z.string().default(''),
  talkativeness: z.number().optional(),
  favorite: z.boolean().default(false),
  extensions: z.record(z.string(), z.unknown()).default({}),
  characterBook: worldBookSchema.optional(),
  depthPrompt: characterDepthPromptSchema.optional(),
  avatarAssetId: z.string().optional(),
  legacy: z
    .object({
      source: z.literal('sillytavern'),
      raw: z.unknown(),
      report: z.unknown()
    })
    .optional(),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type Character = z.infer<typeof characterSchema>;

export function createCharacter(input: Partial<Character> & Pick<Character, 'name'>): Character {
  const now = Date.now();
  return characterSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    description: input.description ?? '',
    personality: input.personality ?? '',
    scenario: input.scenario ?? '',
    firstMessage: input.firstMessage ?? '',
    exampleMessages: input.exampleMessages ?? '',
    creatorNotes: input.creatorNotes ?? '',
    systemPrompt: input.systemPrompt ?? '',
    postHistoryInstructions: input.postHistoryInstructions ?? '',
    alternateGreetings: input.alternateGreetings ?? [],
    groupOnlyGreetings: input.groupOnlyGreetings ?? [],
    tags: input.tags ?? [],
    creator: input.creator ?? '',
    creatorComment: input.creatorComment ?? '',
    characterVersion: input.characterVersion ?? '',
    talkativeness: input.talkativeness,
    favorite: input.favorite ?? false,
    extensions: input.extensions ?? {},
    characterBook: input.characterBook,
    depthPrompt: input.depthPrompt,
    avatarAssetId: input.avatarAssetId,
    legacy: input.legacy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
