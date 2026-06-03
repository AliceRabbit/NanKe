import { z } from 'zod';

export const regexPlacementSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(5),
  z.literal(6)
]);

export type RegexPlacement = z.infer<typeof regexPlacementSchema>;

export const regexSubstitutionModeSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);

export const regexScriptSchema = z.object({
  id: z.string().default(() => crypto.randomUUID()),
  scriptName: z.string().default('Regex Script'),
  findRegex: z.string().default(''),
  replaceString: z.string().default(''),
  trimStrings: z.array(z.string()).default([]),
  placement: z.array(regexPlacementSchema).default([]),
  disabled: z.boolean().default(false),
  markdownOnly: z.boolean().default(false),
  promptOnly: z.boolean().default(false),
  runOnEdit: z.boolean().default(false),
  substituteRegex: regexSubstitutionModeSchema.default(0),
  minDepth: z.number().int().nullable().optional(),
  maxDepth: z.number().int().nullable().optional(),
  legacy: z
    .object({
      source: z.literal('sillytavern'),
      raw: z.unknown(),
      originalIndex: z.number().int().min(0).optional()
    })
    .optional()
});

export type RegexScript = z.infer<typeof regexScriptSchema>;

export const regexProfileSchema = z
  .object({
    enabled: z.boolean().default(true),
    scripts: z.array(regexScriptSchema).default([])
  })
  .default(() => ({ enabled: true, scripts: [] }));

export type RegexProfile = z.infer<typeof regexProfileSchema>;
