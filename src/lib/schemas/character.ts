import { z } from 'zod';
import { worldBookSchema } from './worldbook';

export const characterDepthPromptSchema = z.object({
  prompt: z.string().default(''),
  depth: z.number().default(4),
  role: z.enum(['system', 'user', 'assistant']).default('system')
});

export const characterWorldBookBindingSchema = z.object({
  worldBookId: z.string(),
  enabled: z.boolean().default(true),
  primary: z.boolean().default(false)
});

export type CharacterWorldBookBinding = z.infer<typeof characterWorldBookBindingSchema>;

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
  worldBookIds: z.array(z.string()).default([]),
  worldBookBindings: z.array(characterWorldBookBindingSchema).optional(),
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

export function normalizeWorldBookBindings(input: {
  worldBookIds?: string[];
  worldBookBindings?: CharacterWorldBookBinding[];
  characterBook?: { id: string };
}): CharacterWorldBookBinding[] {
  const hasExplicitBindings = input.worldBookBindings !== undefined;
  const bindings = new Map<string, CharacterWorldBookBinding>();
  for (const id of input.worldBookIds ?? []) {
    if (!id || bindings.has(id)) continue;
    bindings.set(id, { worldBookId: id, enabled: true, primary: false });
  }
  for (const binding of input.worldBookBindings ?? []) {
    if (!binding.worldBookId) continue;
    bindings.set(binding.worldBookId, {
      worldBookId: binding.worldBookId,
      enabled: binding.enabled !== false,
      primary: binding.primary === true
    });
  }
  if (input.characterBook?.id && !bindings.has(input.characterBook.id) && !hasExplicitBindings) {
    bindings.set(input.characterBook.id, {
      worldBookId: input.characterBook.id,
      enabled: true,
      primary: true
    });
  }
  return [...bindings.values()];
}

export function createCharacter(input: Partial<Character> & Pick<Character, 'name'>): Character {
  const now = Date.now();
  const worldBookBindings = normalizeWorldBookBindings(input);
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
    worldBookIds: worldBookBindings.map((binding) => binding.worldBookId),
    worldBookBindings,
    characterBook: input.characterBook,
    depthPrompt: input.depthPrompt,
    avatarAssetId: input.avatarAssetId,
    legacy: input.legacy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
