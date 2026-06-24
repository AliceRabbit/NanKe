import { json } from '@sveltejs/kit';
import { generationProfileSchema } from '$lib/schemas/profile';
import { profileSummary } from '$lib/server/profile-summary';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

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
