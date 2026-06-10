import { json } from '@sveltejs/kit';
import { createUserPersona, userPersonaSchema, type UserPersona } from '$lib/schemas/user-persona';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';

export function GET({ url }) {
  try {
    const context = createRequestContext();
    const id = url.searchParams.get('id');
    return json(id ? context.personas.get(id) : context.personas.list());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const persona = createUserPersona(body);
    return json(createRequestContext().personas.save(persona), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH({ request }) {
  try {
    const body = await request.json();
    const context = createRequestContext();

    if (body?.action === 'duplicate') {
      if (typeof body.id !== 'string') throw new AppError('Persona id is required.', 400, 'persona_id_required');
      const persona = context.personas.duplicate(body.id);
      if (!persona) throw new AppError('Persona not found.', 404, 'persona_not_found');
      return json(persona, { status: 201 });
    }

    if (typeof body?.id !== 'string') throw new AppError('Persona id is required.', 400, 'persona_id_required');
    const existing = context.personas.get(body.id);
    if (!existing) throw new AppError('Persona not found.', 404, 'persona_not_found');
    const persona = userPersonaSchema.parse({
      ...existing,
      ...pickPersonaPatch(body),
      id: existing.id,
      createdAt: existing.createdAt
    });
    return json(context.personas.save(persona));
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    if (!id) throw new AppError('Persona id is required.', 400, 'persona_id_required');
    const result = createRequestContext().personas.delete(id);
    if (!result.deleted) throw new AppError('Persona not found.', 404, 'persona_not_found');
    return json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

function pickPersonaPatch(body: Record<string, unknown>): Partial<UserPersona> {
  return {
    ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
    ...(typeof body.title === 'string' ? { title: body.title.trim() } : {}),
    ...(typeof body.description === 'string' ? { description: body.description } : {}),
    ...(typeof body.avatarAssetId === 'string' ? { avatarAssetId: body.avatarAssetId } : {}),
    ...(body.avatarAssetId === null ? { avatarAssetId: undefined } : {}),
    ...(typeof body.isDefault === 'boolean' ? { isDefault: body.isDefault } : {}),
    ...(body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata) ? { metadata: body.metadata as Record<string, unknown> } : {})
  };
}
