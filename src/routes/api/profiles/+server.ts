import { json } from '@sveltejs/kit';
import { generationProfileSchema } from '$lib/schemas/profile';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

export function GET() {
  try {
    const context = createRequestContext();
    context.profiles.ensureDefault();
    return json(context.profiles.list());
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
