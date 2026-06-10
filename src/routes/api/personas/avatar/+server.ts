import { json } from '@sveltejs/kit';
import { AssetStore } from '$lib/storage/assets/AssetStore';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';

const maxAvatarBytes = 8 * 1024 * 1024;
const allowedAvatarTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export async function POST({ request }) {
  try {
    const form = await request.formData();
    const personaId = String(form.get('personaId') ?? '');
    const file = form.get('avatar');
    if (!personaId) throw new AppError('Persona id is required.', 400, 'persona_id_required');
    if (!(file instanceof File)) throw new AppError('Avatar image is required.', 400, 'persona_avatar_required');
    if (file.size > maxAvatarBytes) throw new AppError('Avatar image is too large.', 413, 'persona_avatar_too_large');
    if (file.type && !allowedAvatarTypes.has(file.type)) throw new AppError('Unsupported avatar image type.', 400, 'persona_avatar_type_unsupported');

    const context = createRequestContext();
    const persona = context.personas.get(personaId);
    if (!persona) throw new AppError('Persona not found.', 404, 'persona_not_found');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const asset = new AssetStore().save(bytes, file.name || `${persona.name}.png`);
    return json(context.personas.save({ ...persona, avatarAssetId: asset.id }));
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const personaId = url.searchParams.get('personaId');
    if (!personaId) throw new AppError('Persona id is required.', 400, 'persona_id_required');
    const context = createRequestContext();
    const persona = context.personas.get(personaId);
    if (!persona) throw new AppError('Persona not found.', 404, 'persona_not_found');
    return json(context.personas.save({ ...persona, avatarAssetId: undefined }));
  } catch (error) {
    return errorResponse(error);
  }
}
