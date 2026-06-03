import { asc, eq } from 'drizzle-orm';
import { worldBookSchema, type WorldBook } from '$lib/schemas/worldbook';
import { getDatabase } from '../db';
import { worldBooks } from '../schema';

export class WorldBookRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): WorldBook[] {
    return this.db.select().from(worldBooks).orderBy(asc(worldBooks.name)).all().map((row) => worldBookSchema.parse(row.data));
  }

  get(id: string): WorldBook | undefined {
    const row = this.db.select().from(worldBooks).where(eq(worldBooks.id, id)).get();
    return row ? worldBookSchema.parse(row.data) : undefined;
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
