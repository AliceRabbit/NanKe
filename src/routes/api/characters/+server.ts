import { json } from '@sveltejs/kit';
import { createCharacter } from '$lib/schemas/character';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';
import { characterSummary } from '$lib/server/initial-data-summary';

export function GET({ url }) {
  try {
    const characters = createRequestContext().characters.list();
    return json(url.searchParams.get('summary') === 'true' ? characters.map(characterSummary) : characters);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const character = createCharacter(body);
    return json(createRequestContext().characters.save(character), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE({ request }) {
  try {
    const body = await request.json().catch(() => ({}));
    const id = typeof body.id === 'string' ? body.id.trim() : '';
    if (!id) throw new Error('Character id is required.');
    const deleted = createRequestContext().characters.delete(id);
    return json({ deleted });
  } catch (error) {
    return errorResponse(error);
  }
}
