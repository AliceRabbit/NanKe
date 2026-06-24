import { json } from '@sveltejs/kit';
import { regexProfileSchema } from '$lib/schemas/regex';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

export function GET() {
  try {
    return json(createRequestContext().toolbox.getGlobalRegex());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    return json(createRequestContext().toolbox.saveGlobalRegex(regexProfileSchema.parse(body)));
  } catch (error) {
    return errorResponse(error);
  }
}
