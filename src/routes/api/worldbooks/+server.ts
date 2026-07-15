import { json } from '@sveltejs/kit';
import { normalizeWorldBookBindings } from '$lib/schemas/character';
import { createWorldBook } from '$lib/schemas/worldbook';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';
import { worldBookSummary } from '$lib/server/initial-data-summary';

export function GET({ url }) {
  try {
    const worldBooks = createRequestContext().worldBooks.list();
    return json(url.searchParams.get('summary') === 'true' ? worldBooks.map(worldBookSummary) : worldBooks);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const worldBook = createWorldBook(body);
    const context = createRequestContext();
    const saved = context.worldBooks.save(worldBook);
    const characterId = saved.metadata.characterId;
    if (characterId) {
      const character = context.characters.get(characterId);
      if (character) {
        const worldBookIds = new Set(character.worldBookIds ?? []);
        worldBookIds.add(saved.id);
        context.characters.save({
          ...character,
          worldBookIds: [...worldBookIds],
          worldBookBindings: normalizeWorldBookBindings({
            ...character,
            worldBookIds: [...worldBookIds]
          }),
          characterBook: character.characterBook?.id === saved.id ? saved : character.characterBook
        });
      }
    }
    return json(saved, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    if (!id) throw new AppError('World book id is required.', 400, 'worldbook_delete_required');
    const result = createRequestContext().worldBooks.delete(id);
    if (!result.deleted) throw new AppError('World book not found.', 404, 'worldbook_not_found');
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
