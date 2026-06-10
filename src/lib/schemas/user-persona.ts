import { z } from 'zod';

export const userPersonaSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  title: z.string().default(''),
  description: z.string().default(''),
  avatarAssetId: z.string().optional(),
  isDefault: z.boolean().default(false),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.number(),
  updatedAt: z.number()
});

export type UserPersona = z.infer<typeof userPersonaSchema>;

export function createUserPersona(input: Partial<UserPersona> & Pick<UserPersona, 'name'>): UserPersona {
  const now = Date.now();
  return userPersonaSchema.parse({
    id: input.id ?? crypto.randomUUID(),
    name: input.name,
    title: input.title ?? '',
    description: input.description ?? '',
    avatarAssetId: input.avatarAssetId,
    isDefault: input.isDefault ?? false,
    metadata: input.metadata ?? {},
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now
  });
}
