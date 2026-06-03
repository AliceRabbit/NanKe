import { asc, eq } from 'drizzle-orm';
import { characterSchema, type Character } from '$lib/schemas/character';
import { getDatabase } from '../db';
import { characters } from '../schema';

export class CharacterRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): Character[] {
    return this.db.select().from(characters).orderBy(asc(characters.name)).all().map((row) => characterSchema.parse(row.data));
  }

  get(id: string): Character | undefined {
    const row = this.db.select().from(characters).where(eq(characters.id, id)).get();
    return row ? characterSchema.parse(row.data) : undefined;
  }

  save(character: Character): Character {
    const updated = { ...character, updatedAt: Date.now() };
    this.db
      .insert(characters)
      .values({ id: updated.id, name: updated.name, data: updated, createdAt: updated.createdAt, updatedAt: updated.updatedAt })
      .onConflictDoUpdate({
        target: characters.id,
        set: { name: updated.name, data: updated, updatedAt: updated.updatedAt }
      })
      .run();
    return updated;
  }
}
