import { asc, eq } from 'drizzle-orm';
import { userPersonaSchema, type UserPersona } from '$lib/schemas/user-persona';
import { userPersonas } from '../schema';
import { getDatabase } from '../db';

export class UserPersonaRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): UserPersona[] {
    return this.db.select().from(userPersonas).orderBy(asc(userPersonas.name)).all().map((row) => userPersonaSchema.parse(row.data));
  }

  get(id: string): UserPersona | undefined {
    const row = this.db.select().from(userPersonas).where(eq(userPersonas.id, id)).get();
    return row ? userPersonaSchema.parse(row.data) : undefined;
  }

  getDefault(): UserPersona | undefined {
    const row = this.db.select().from(userPersonas).where(eq(userPersonas.isDefault, true)).get();
    return row ? userPersonaSchema.parse(row.data) : undefined;
  }

  save(persona: UserPersona): UserPersona {
    const updated = { ...persona, updatedAt: Date.now() };
    if (updated.isDefault) {
      for (const existing of this.list()) {
        if (existing.id !== updated.id && existing.isDefault) {
          this.save({ ...existing, isDefault: false });
        }
      }
    }

    this.db
      .insert(userPersonas)
      .values({
        id: updated.id,
        name: updated.name,
        isDefault: updated.isDefault,
        data: updated,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      })
      .onConflictDoUpdate({
        target: userPersonas.id,
        set: {
          name: updated.name,
          isDefault: updated.isDefault,
          data: updated,
          updatedAt: updated.updatedAt
        }
      })
      .run();
    return updated;
  }
}
