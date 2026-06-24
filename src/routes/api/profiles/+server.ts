import { json } from '@sveltejs/kit';
import { generationProfileSchema } from '$lib/schemas/profile';
import { profileSummary } from '$lib/server/profile-summary';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';

export function GET({ url }) {
  try {
    const context = createRequestContext();
    context.profiles.ensureDefault();
    const profiles = context.profiles.list();
    return json(url.searchParams.get('summary') === 'true' ? profiles.map(profileSummary) : profiles);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const profile = generationProfileSchema.parse(body);
    return json(createRequestContext().profiles.save(profile), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    if (!id) throw new AppError('Profile id is required.', 400, 'profile_id_required');
    const context = createRequestContext();
    if (context.profiles.list().length <= 1) throw new AppError('At least one profile is required.', 400, 'profile_delete_last');
    if (!context.profiles.delete(id)) throw new AppError('Generation profile not found.', 404, 'profile_not_found');
    return json({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
