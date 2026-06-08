import { asc, eq } from 'drizzle-orm';
import { worldBookSchema, type WorldBook } from '$lib/schemas/worldbook';
import { characterSchema, type Character } from '$lib/schemas/character';
import { getDatabase } from '../db';
import { characters, worldBooks } from '../schema';

export type WorldBookDeleteResult = {
  deleted: boolean;
  id: string;
  affectedCharacterIds: string[];
  removedCharacterBindings: number;
  removedEmbeddedCharacterBooks: number;
};

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

  delete(id: string): WorldBookDeleteResult {
    return this.db.transaction((tx) => {
      const existing = tx.select().from(worldBooks).where(eq(worldBooks.id, id)).get();
      const affectedCharacterIds: string[] = [];
      let removedCharacterBindings = 0;
      let removedEmbeddedCharacterBooks = 0;

      for (const row of tx.select().from(characters).all()) {
        const character = characterSchema.parse(row.data);
        const next = detachWorldBookFromCharacter(character, id);
        if (!next.changed) continue;

        affectedCharacterIds.push(character.id);
        removedCharacterBindings += next.removedBindings;
        removedEmbeddedCharacterBooks += next.removedEmbeddedCharacterBook ? 1 : 0;
        tx.update(characters)
          .set({
            data: next.character,
            updatedAt: next.character.updatedAt
          })
          .where(eq(characters.id, character.id))
          .run();
      }

      const result = tx.delete(worldBooks).where(eq(worldBooks.id, id)).run();
      return {
        deleted: Boolean(existing) || result.changes > 0 || affectedCharacterIds.length > 0,
        id,
        affectedCharacterIds,
        removedCharacterBindings,
        removedEmbeddedCharacterBooks
      };
    });
  }
}

function detachWorldBookFromCharacter(
  character: Character,
  worldBookId: string
): { changed: boolean; character: Character; removedBindings: number; removedEmbeddedCharacterBook: boolean } {
  const hasExplicitBindings = character.worldBookBindings !== undefined;
  const worldBookIds = (character.worldBookIds ?? []).filter((id) => id !== worldBookId);
  const explicitBindings = character.worldBookBindings ?? [];
  const worldBookBindingIds = new Set(explicitBindings.map((binding) => binding.worldBookId));
  const nextBindings = explicitBindings.filter((binding) => binding.worldBookId !== worldBookId);
  const removedListBinding = (character.worldBookIds ?? []).includes(worldBookId) || explicitBindings.some((binding) => binding.worldBookId === worldBookId);
  const removedEmbeddedCharacterBook = character.characterBook?.id === worldBookId;
  const implicitEmbeddedBinding = !hasExplicitBindings && removedEmbeddedCharacterBook && !worldBookBindingIds.has(worldBookId);
  const removedBindings = removedListBinding || implicitEmbeddedBinding ? 1 : 0;
  const changed = removedBindings > 0 || removedEmbeddedCharacterBook;

  if (!changed) return { changed: false, character, removedBindings: 0, removedEmbeddedCharacterBook: false };

  let nextCharacter: Character = {
    ...character,
    worldBookIds,
    updatedAt: Date.now()
  };

  if (hasExplicitBindings) {
    nextCharacter = { ...nextCharacter, worldBookBindings: nextBindings };
  } else {
    const { worldBookBindings: _worldBookBindings, ...withoutBindings } = nextCharacter;
    nextCharacter = withoutBindings;
  }

  if (removedEmbeddedCharacterBook) {
    const { characterBook: _characterBook, ...withoutCharacterBook } = nextCharacter;
    nextCharacter = withoutCharacterBook;
  }

  return {
    changed: true,
    character: nextCharacter,
    removedBindings,
    removedEmbeddedCharacterBook
  };
}
