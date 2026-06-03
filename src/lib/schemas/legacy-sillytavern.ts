import { z } from 'zod';

export const sillyTavernCharacterV1Schema = z.object({
  name: z.string(),
  description: z.string().default(''),
  personality: z.string().default(''),
  scenario: z.string().default(''),
  first_mes: z.string().default(''),
  mes_example: z.string().default('')
});

export const sillyTavernCharacterV2Schema = z.object({
  spec: z.string().optional(),
  spec_version: z.string().optional(),
  data: z.object({
    name: z.string(),
    description: z.string().default(''),
    personality: z.string().default(''),
    scenario: z.string().default(''),
    first_mes: z.string().default(''),
    mes_example: z.string().default(''),
    creator_notes: z.string().default(''),
    system_prompt: z.string().default(''),
    post_history_instructions: z.string().default(''),
    alternate_greetings: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    creator: z.string().default(''),
    character_version: z.string().default(''),
    extensions: z.record(z.string(), z.unknown()).default({})
  })
});

export const sillyTavernWorldInfoEntrySchema = z.object({
  uid: z.union([z.string(), z.number()]).optional(),
  key: z.array(z.string()).default([]),
  keysecondary: z.array(z.string()).default([]),
  comment: z.string().default(''),
  content: z.string().default(''),
  constant: z.boolean().default(false),
  selective: z.boolean().default(false),
  order: z.number().default(100),
  position: z.number().default(0),
  disable: z.boolean().default(false),
  depth: z.number().default(4),
  role: z.union([z.string(), z.number(), z.null()]).optional(),
  probability: z.number().default(100)
});

export const sillyTavernWorldInfoSchema = z.object({
  name: z.string().optional(),
  entries: z.union([z.record(z.string(), sillyTavernWorldInfoEntrySchema), z.array(sillyTavernWorldInfoEntrySchema)]),
  extensions: z.record(z.string(), z.unknown()).optional()
});

export const sillyTavernOpenAiPresetSchema = z.object({
  chat_completion_source: z.string().optional(),
  openai_model: z.string().optional(),
  google_model: z.string().optional(),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  top_k: z.number().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  openai_max_context: z.number().optional(),
  openai_max_tokens: z.number().optional(),
  stream_openai: z.boolean().optional(),
  prompts: z.array(z.record(z.string(), z.unknown())).optional(),
  prompt_order: z.array(z.record(z.string(), z.unknown())).optional()
}).passthrough();

export const sillyTavernContextPresetSchema = z.object({
  story_string: z.string(),
  example_separator: z.string().optional(),
  chat_start: z.string().optional(),
  use_stop_strings: z.boolean().optional(),
  names_as_stop_strings: z.boolean().optional(),
  name: z.string().optional()
}).passthrough();

export const sillyTavernInstructPresetSchema = z.object({
  input_sequence: z.string().default(''),
  output_sequence: z.string().default(''),
  system_sequence: z.string().default(''),
  stop_sequence: z.string().default(''),
  wrap: z.boolean().default(true),
  input_suffix: z.string().default('\n\n'),
  output_suffix: z.string().default('\n\n'),
  system_suffix: z.string().default('\n\n'),
  sequences_as_stop_strings: z.boolean().default(true),
  name: z.string().optional()
}).passthrough();
