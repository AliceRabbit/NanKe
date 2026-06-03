import { json } from '@sveltejs/kit';
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
    return json(createRequestContext().worldBooks.save(worldBook), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
