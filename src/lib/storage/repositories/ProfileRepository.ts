import { asc, eq } from 'drizzle-orm';
import { createDefaultGenerationProfile, generationProfileSchema, type GenerationProfile } from '$lib/schemas/profile';
import { importSillyTavernRegexScripts } from '$lib/compat/sillytavern/presets';
import { generationProfiles } from '../schema';
import { getDatabase } from '../db';

function ensureRequiredPromptSlots(profile: GenerationProfile): { profile: GenerationProfile; changed: boolean } {
  const defaultSlots = createDefaultGenerationProfile().prompt.slots;
  const requiredSlots = defaultSlots.filter((slot) => slot.source === 'character-system' || slot.source === 'persona');
  let changed = false;

  const slots = [...profile.prompt.slots];
  for (const requiredSlot of requiredSlots) {
    if (slots.some((slot) => slot.source === requiredSlot.source)) continue;
    const afterSource = requiredSlot.source === 'character-system' ? 'system' : 'scenario';
    const insertionIndex = slots.findIndex((slot) => slot.source === afterSource);
    slots.splice(insertionIndex >= 0 ? insertionIndex + 1 : slots.length, 0, requiredSlot);
    changed = true;
  }

  if (!changed) return { profile, changed: false };

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

function ensureLegacyRegexScripts(profile: GenerationProfile): { profile: GenerationProfile; changed: boolean } {
  if (profile.regex.scripts.length) return { profile, changed: false };
  const extensions = (profile.metadata.sillyTavern as { extensions?: { regex_scripts?: unknown } } | undefined)?.extensions;
  const scripts = importSillyTavernRegexScripts(extensions?.regex_scripts);
  if (!scripts.length) return { profile, changed: false };
  return {
    profile: generationProfileSchema.parse({
      ...profile,
      regex: {
        enabled: true,
        scripts
      }
    }),
    changed: true
  };
}

function normalizeProfile(profile: GenerationProfile): { profile: GenerationProfile; changed: boolean } {
  const withSlots = ensureRequiredPromptSlots(profile);
  const withRegex = ensureLegacyRegexScripts(withSlots.profile);
  return { profile: withRegex.profile, changed: withSlots.changed || withRegex.changed };
}

export class ProfileRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): GenerationProfile[] {
    return this.db
      .select()
      .from(generationProfiles)
      .orderBy(asc(generationProfiles.name))
      .all()
      .map((row) => {
        const normalized = normalizeProfile(generationProfileSchema.parse(row.data));
        return normalized.changed ? this.save(normalized.profile) : normalized.profile;
      });
  }

  get(id: string): GenerationProfile | undefined {
    const row = this.db.select().from(generationProfiles).where(eq(generationProfiles.id, id)).get();
    if (!row) return undefined;
    const normalized = normalizeProfile(generationProfileSchema.parse(row.data));
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
      const normalized = normalizeProfile(generationProfileSchema.parse(row.data));
      return normalized.changed ? this.save(normalized.profile) : normalized.profile;
    }
    return this.save(createDefaultGenerationProfile());
  }
}
