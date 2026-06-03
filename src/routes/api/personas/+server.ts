import { json } from '@sveltejs/kit';
import { createUserPersona } from '$lib/schemas/user-persona';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

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
