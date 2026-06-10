import { json } from '@sveltejs/kit';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';

export function GET({ url }) {
  try {
    const characterId = url.searchParams.get('characterId') ?? undefined;
    return json(createRequestContext().personas.listCharacterBindings(characterId));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    if (typeof body?.personaId !== 'string' || typeof body?.characterId !== 'string') {
      throw new AppError('personaId and characterId are required.', 400, 'persona_binding_required');
    }
    const context = createRequestContext();
    if (!context.personas.get(body.personaId)) throw new AppError('Persona not found.', 404, 'persona_not_found');
    if (!context.characters.get(body.characterId)) throw new AppError('Character not found.', 404, 'character_not_found');
    const binding = context.personas.setCharacterBinding(body.personaId, body.characterId, body.enabled !== false);
    return json(binding, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const personaId = url.searchParams.get('personaId');
    const characterId = url.searchParams.get('characterId');
    if (!personaId || !characterId) {
      throw new AppError('personaId and characterId are required.', 400, 'persona_binding_required');
    }
    const deleted = createRequestContext().personas.removeCharacterBinding(personaId, characterId);
    return json({ deleted, personaId, characterId });
  } catch (error) {
    return errorResponse(error);
  }
}
