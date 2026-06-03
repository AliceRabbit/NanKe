import { z } from 'zod';

export const worldBookEntryPositionSchema = z.enum(['before', 'after', 'depth']);

export const worldBookEntrySchema = z.object({
  id: z.string(),
  worldBookId: z.string().optional(),
  keys: z.array(z.string()).default([]),
  secondaryKeys: z.array(z.string()).default([]),
  comment: z.string().default(''),
  content: z.string().default(''),
  constant: z.boolean().default(false),
  selective: z.boolean().default(false),
  enabled: z.boolean().default(true),
  order: z.number().default(100),
  position: worldBookEntryPositionSchema.default('before'),
  depth: z.number().default(4),
  role: z.enum(['system', 'user', 'assistant']).default('system'),
  probability: z.number().min(0).max(100).default(100),
  extensions: z.record(z.string(), z.unknown()).default({})
});

export type WorldBookEntry = z.infer<typeof worldBookEntrySchema>;

export const worldBookSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  entries: z.array(worldBookEntrySchema).default([]),
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

export type WorldBook = z.infer<typeof worldBookSchema>;

export function createWorldBook(input: Partial<WorldBook> & Pick<WorldBook, 'name'>): WorldBook {
  const now = Date.now();
  return worldBookSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    entries: input.entries ?? [],
    legacy: input.legacy,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
