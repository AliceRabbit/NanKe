import { z } from 'zod';
import { regexProfileSchema } from './regex';

export const promptSlotSourceSchema = z.enum([
  'system',
  'character-system',
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
  label: z.string().default(''),
  injection: z
    .object({
      position: z.enum(['relative', 'absolute']).default('relative'),
      depth: z.number().int().min(0).default(4),
      order: z.number().default(100),
      triggers: z.array(z.string()).default([])
    })
    .optional(),
  legacy: z
    .object({
      source: z.literal('sillytavern'),
      identifier: z.string(),
      marker: z.boolean().default(false),
      systemPrompt: z.boolean().default(false),
      forbidOverrides: z.boolean().default(false),
      ordered: z.boolean().default(true),
      enabledInPromptOrder: z.boolean().optional(),
      enabledInPrompt: z.boolean().optional(),
      originalIndex: z.number().int().min(0).optional()
    })
    .optional()
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
    compatibility: z.enum(['strict-openai', 'extended']).default('strict-openai')
  }),
  z.object({
    type: z.literal('gemini'),
    model: z.string().min(1),
    endpoint: z.string().url().optional(),
    apiKey: z.string().optional(),
    vertex: z.preprocess(
      (value) => {
        if (value && typeof value === 'object' && !Array.isArray(value) && !('mode' in value)) {
          return { ...(value as Record<string, unknown>), mode: 'oauth' };
        }
        return value;
      },
      z
        .object({
          mode: z.enum(['express', 'oauth']).default('express'),
          projectId: z.string().optional(),
          location: z.string().default('us-central1'),
          apiKey: z.string().optional(),
          accessToken: z.string().optional()
        })
        .superRefine((vertex, context) => {
          if (vertex.mode === 'oauth' && !vertex.projectId?.trim()) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: 'Project ID is required for Vertex OAuth mode.',
              path: ['projectId']
            });
          }
        })
    ).optional()
  })
]);

export type ProviderProfile = z.infer<typeof providerProfileSchema>;

export const samplerProfileSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  topK: z.number().min(0).optional(),
  topA: z.number().min(0).optional(),
  minP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  repetitionPenalty: z.number().min(0).optional(),
  maxTokens: z.number().positive().optional(),
  contextTokens: z.number().positive().optional(),
  seed: z.number().int().optional(),
  n: z.number().int().positive().optional(),
  stop: z.array(z.string()).optional()
});

export type SamplerProfile = z.infer<typeof samplerProfileSchema>;

export const requestProfileSchema = z
  .object({
    stream: z.boolean().default(true)
  })
  .default(() => ({ stream: true }));

export type RequestProfile = z.infer<typeof requestProfileSchema>;

export const thinkingProfileSchema = z
  .object({
    openai: z
      .object({
        effort: z.enum(['default', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh']).default('default')
      })
      .default(() => ({ effort: 'default' as const })),
    gemini: z
      .object({
        includeThoughts: z.boolean().default(false),
        mode: z.enum(['default', 'off', 'budget', 'level']).default('default'),
        budget: z.number().int().min(0).optional(),
        level: z.enum(['minimal', 'low', 'medium', 'high']).default('medium')
      })
      .default(() => ({ includeThoughts: false, mode: 'default' as const, level: 'medium' as const }))
  })
  .default(() => ({
    openai: { effort: 'default' as const },
    gemini: { includeThoughts: false, mode: 'default' as const, level: 'medium' as const }
  }));

export type ThinkingProfile = z.infer<typeof thinkingProfileSchema>;

export const generationProfileSchema = z.preprocess(
  (value) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (!('thinking' in record) && 'reasoning' in record) {
        return { ...record, thinking: record.reasoning };
      }
    }
    return value;
  },
  z.object({
    id: z.string(),
    name: z.string().min(1),
    provider: providerProfileSchema,
    sampler: samplerProfileSchema.default({}),
    request: requestProfileSchema,
    thinking: thinkingProfileSchema,
    prompt: z.object({
      mode: z.enum(['chat', 'text']).default('chat'),
      slots: z.array(promptSlotSchema),
      instruct: instructionTemplateSchema.optional(),
      macroMode: z.enum(['none', 'sillytavern']).default('sillytavern'),
      squashSystemMessages: z.boolean().default(false)
    }),
    regex: regexProfileSchema,
    metadata: z.record(z.string(), z.unknown()).default({}),
    legacy: z
      .object({
        source: z.literal('sillytavern'),
        raw: z.unknown(),
        report: z.unknown()
      })
      .optional(),
    createdAt: z.number(),
    updatedAt: z.number()
  })
);

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
      compatibility: 'strict-openai'
    },
    sampler: input.sampler ?? {
      temperature: 1,
      topP: 1,
      maxTokens: 512,
      contextTokens: 8192
    },
    request: input.request ?? { stream: true },
    thinking: input.thinking ?? {
      openai: { effort: 'default' },
      gemini: { includeThoughts: false, mode: 'default', level: 'medium' }
    },
    prompt: input.prompt ?? {
      mode: 'chat',
      macroMode: 'sillytavern',
      squashSystemMessages: false,
      slots: [
        {
          id: 'main',
          source: 'system',
          role: 'system',
          label: 'Main Prompt',
          enabled: true,
          content: "Write {{char}}'s next reply in a fictional chat between {{char}} and {{user}}."
        },
        { id: 'character-system', source: 'character-system', role: 'system', label: 'Character System Prompt', enabled: true, content: '' },
        { id: 'world-before', source: 'worldbook-before', role: 'system', label: 'World Book Before', enabled: true, content: '' },
        { id: 'character-description', source: 'character-description', role: 'system', label: 'Character Description', enabled: true, content: '' },
        { id: 'character-personality', source: 'character-personality', role: 'system', label: 'Character Personality', enabled: true, content: '' },
        { id: 'scenario', source: 'scenario', role: 'system', label: 'Scenario', enabled: true, content: '' },
        { id: 'persona', source: 'persona', role: 'system', label: 'Persona', enabled: true, content: '' },
        { id: 'world-after', source: 'worldbook-after', role: 'system', label: 'World Book After', enabled: true, content: '' },
        { id: 'examples', source: 'examples', role: 'system', label: 'Examples', enabled: true, content: '' },
        { id: 'history', source: 'history', role: 'user', label: 'Chat History', enabled: true, content: '' },
        { id: 'post-history', source: 'post-history', role: 'system', label: 'Post-History Instructions', enabled: true, content: '' }
      ]
    },
    regex: input.regex ?? { enabled: true, scripts: [] },
    metadata: input.metadata ?? {},
    legacy: input.legacy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
