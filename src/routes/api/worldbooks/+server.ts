import { json } from '@sveltejs/kit';
import { normalizeWorldBookBindings } from '$lib/schemas/character';
import { createWorldBook } from '$lib/schemas/worldbook';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

export function GET() {
  try {
    return json(createRequestContext().worldBooks.list());
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
