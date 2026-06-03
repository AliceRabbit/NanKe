import { asc, eq } from 'drizzle-orm';
import { createDefaultGenerationProfile, generationProfileSchema, type GenerationProfile } from '$lib/schemas/profile';
import { generationProfiles } from '../schema';
import { getDatabase } from '../db';

function ensureRequiredPromptSlots(profile: GenerationProfile): { profile: GenerationProfile; changed: boolean } {
  if (profile.prompt.slots.some((slot) => slot.source === 'persona')) {
    return { profile, changed: false };
  }

  const personaSlot = createDefaultGenerationProfile().prompt.slots.find((slot) => slot.source === 'persona');
  if (!personaSlot) return { profile, changed: false };

  const slots = [...profile.prompt.slots];
  const scenarioIndex = slots.findIndex((slot) => slot.source === 'scenario');
  slots.splice(scenarioIndex >= 0 ? scenarioIndex + 1 : slots.length, 0, personaSlot);

  return {
    profile: generationProfileSchema.parse({
      ...profile,
      prompt: {
        ...profile.prompt,
        slots
      }
    }),
    changed: true
  };
}

export class ProfileRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): GenerationProfile[] {
    return this.db
      .select()
      .from(generationProfiles)
      .orderBy(asc(generationProfiles.name))
      .all()
      .map((row) => ensureRequiredPromptSlots(generationProfileSchema.parse(row.data)).profile);
  }

  get(id: string): GenerationProfile | undefined {
    const row = this.db.select().from(generationProfiles).where(eq(generationProfiles.id, id)).get();
    if (!row) return undefined;
    const normalized = ensureRequiredPromptSlots(generationProfileSchema.parse(row.data));
    return normalized.changed ? this.save(normalized.profile) : normalized.profile;
  }

  save(profile: GenerationProfile): GenerationProfile {
    const updated = { ...profile, updatedAt: Date.now() };
    this.db
      .insert(generationProfiles)
      .values({
        id: updated.id,
        name: updated.name,
        providerType: updated.provider.type,
        data: updated,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      })
      .onConflictDoUpdate({
        target: generationProfiles.id,
        set: {
          name: updated.name,
          providerType: updated.provider.type,
          data: updated,
          updatedAt: updated.updatedAt
        }
      })
      .run();
    return updated;
  }

  ensureDefault(): GenerationProfile {
    const row = this.db.select().from(generationProfiles).orderBy(asc(generationProfiles.name)).get();
    if (row) {
      const normalized = ensureRequiredPromptSlots(generationProfileSchema.parse(row.data));
      return normalized.changed ? this.save(normalized.profile) : normalized.profile;
    }
    return this.save(createDefaultGenerationProfile());
  }
}
