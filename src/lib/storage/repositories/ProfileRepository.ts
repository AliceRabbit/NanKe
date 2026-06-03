import { asc, eq } from 'drizzle-orm';
import { createDefaultGenerationProfile, generationProfileSchema, type GenerationProfile } from '$lib/schemas/profile';
import { generationProfiles } from '../schema';
import { getDatabase } from '../db';

export class ProfileRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): GenerationProfile[] {
    return this.db.select().from(generationProfiles).orderBy(asc(generationProfiles.name)).all().map((row) => generationProfileSchema.parse(row.data));
  }

  get(id: string): GenerationProfile | undefined {
    const row = this.db.select().from(generationProfiles).where(eq(generationProfiles.id, id)).get();
    return row ? generationProfileSchema.parse(row.data) : undefined;
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
    const [first] = this.list();
    if (first) return first;
    return this.save(createDefaultGenerationProfile());
  }
}
