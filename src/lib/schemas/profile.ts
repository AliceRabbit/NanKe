import { z } from 'zod';

export const promptSlotSourceSchema = z.enum([
  'system',
  'character-description',
  'character-personality',
  'scenario',
  'persona',
  'worldbook-before',
  'worldbook-after',
  'examples',
  'history',
  'post-history',
  'custom'
]);

export const promptSlotSchema = z.object({
  id: z.string(),
  source: promptSlotSourceSchema,
  role: z.enum(['system', 'user', 'assistant']).default('system'),
  enabled: z.boolean().default(true),
  content: z.string().default(''),
  label: z.string().default('')
});

export type PromptSlot = z.infer<typeof promptSlotSchema>;

export const instructionTemplateSchema = z.object({
  inputSequence: z.string().default(''),
  outputSequence: z.string().default(''),
  systemSequence: z.string().default(''),
  stopSequence: z.string().default(''),
  wrap: z.boolean().default(true),
  inputSuffix: z.string().default('\n\n'),
  outputSuffix: z.string().default('\n\n'),
  systemSuffix: z.string().default('\n\n'),
  sequencesAsStopStrings: z.boolean().default(true)
});

export type InstructionTemplate = z.infer<typeof instructionTemplateSchema>;

export const providerProfileSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('openai-compatible'),
    model: z.string().min(1),
    endpoint: z.string().url().default('https://api.openai.com/v1'),
    apiKey: z.string().optional(),
    apiKeyEnv: z.string().default('OPENAI_API_KEY')
  }),
  z.object({
    type: z.literal('gemini'),
    model: z.string().min(1),
    endpoint: z.string().url().optional(),
    apiKey: z.string().optional(),
    apiKeyEnv: z.string().default('GEMINI_API_KEY'),
    vertex: z
      .object({
        projectId: z.string().min(1),
        location: z.string().min(1),
        accessToken: z.string().optional(),
        accessTokenEnv: z.string().default('GOOGLE_VERTEX_ACCESS_TOKEN')
      })
      .optional()
  })
]);

export type ProviderProfile = z.infer<typeof providerProfileSchema>;

export const samplerProfileSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(0).optional(),
  maxTokens: z.number().positive().optional(),
  contextTokens: z.number().positive().optional(),
  stop: z.array(z.string()).optional()
});

export type SamplerProfile = z.infer<typeof samplerProfileSchema>;

export const generationProfileSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  provider: providerProfileSchema,
  sampler: samplerProfileSchema.default({}),
  prompt: z.object({
    mode: z.enum(['chat', 'text']).default('chat'),
    slots: z.array(promptSlotSchema),
    instruct: instructionTemplateSchema.optional()
  }),
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

export type GenerationProfile = z.infer<typeof generationProfileSchema>;

export function createDefaultGenerationProfile(input: Partial<GenerationProfile> = {}): GenerationProfile {
  const now = Date.now();
  return generationProfileSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    name: input.name ?? 'OpenAI Compatible Default',
    provider: input.provider ?? {
      type: 'openai-compatible',
      model: 'gpt-4o-mini',
      endpoint: 'https://api.openai.com/v1',
      apiKeyEnv: 'OPENAI_API_KEY'
    },
    sampler: input.sampler ?? {
      temperature: 1,
      topP: 1,
      maxTokens: 512,
      contextTokens: 8192
    },
    prompt: input.prompt ?? {
      mode: 'chat',
      slots: [
        {
          id: 'main',
          source: 'system',
          role: 'system',
          label: 'Main Prompt',
          enabled: true,
          content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}."
        },
        { id: 'world-before', source: 'worldbook-before', role: 'system', label: 'World Book Before', enabled: true, content: '' },
        { id: 'character-description', source: 'character-description', role: 'system', label: 'Character Description', enabled: true, content: '' },
        { id: 'character-personality', source: 'character-personality', role: 'system', label: 'Character Personality', enabled: true, content: '' },
        { id: 'scenario', source: 'scenario', role: 'system', label: 'Scenario', enabled: true, content: '' },
        { id: 'world-after', source: 'worldbook-after', role: 'system', label: 'World Book After', enabled: true, content: '' },
        { id: 'examples', source: 'examples', role: 'system', label: 'Examples', enabled: true, content: '' },
        { id: 'history', source: 'history', role: 'user', label: 'Chat History', enabled: true, content: '' },
        { id: 'post-history', source: 'post-history', role: 'system', label: 'Post-History Instructions', enabled: true, content: '' }
      ]
    },
    legacy: input.legacy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
