import { asc, eq } from 'drizzle-orm';
import { worldBookSchema, type WorldBook } from '$lib/schemas/worldbook';
import { characterSchema } from '$lib/schemas/character';
import { getDatabase } from '../db';
import { characters, worldBooks } from '../schema';

export class WorldBookRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): WorldBook[] {
    const saved = this.db.select().from(worldBooks).orderBy(asc(worldBooks.name)).all().map((row) => worldBookSchema.parse(row.data));
    const savedIds = new Set(saved.map((worldBook) => worldBook.id));
    const embedded = this.db
      .select()
      .from(characters)
      .orderBy(asc(characters.name))
      .all()
      .map((row) => characterSchema.parse(row.data))
      .flatMap((character) => {
        if (!character.characterBook || savedIds.has(character.characterBook.id)) return [];
        return [
          worldBookSchema.parse({
            ...character.characterBook,
            metadata: {
              ...character.characterBook.metadata,
              source: 'character-card',
              characterId: character.id,
              characterName: character.name
            }
          })
        ];
      });
    return [...saved, ...embedded].sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): WorldBook | undefined {
    const row = this.db.select().from(worldBooks).where(eq(worldBooks.id, id)).get();
    if (row) return worldBookSchema.parse(row.data);
    const embeddedCharacter = this.db
      .select()
      .from(characters)
      .all()
      .map((item) => characterSchema.parse(item.data))
      .find((character) => character.characterBook?.id === id);
    if (!embeddedCharacter?.characterBook) return undefined;
    return worldBookSchema.parse({
      ...embeddedCharacter.characterBook,
      metadata: {
        ...embeddedCharacter.characterBook.metadata,
        source: 'character-card',
        characterId: embeddedCharacter.id,
        characterName: embeddedCharacter.name
      }
    });
  }

  save(worldBook: WorldBook): WorldBook {
    const updated = { ...worldBook, updatedAt: Date.now() };
    this.db
      .insert(worldBooks)
      .values({ id: updated.id, name: updated.name, data: updated, createdAt: updated.createdAt, updatedAt: updated.updatedAt })
      .onConflictDoUpdate({
        target: worldBooks.id,
        set: { name: updated.name, data: updated, updatedAt: updated.updatedAt }
      })
      .run();
    return updated;
  }
}
