import { json } from '@sveltejs/kit';
import { ImportAppService, type ImportKind } from '$lib/server/services';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

export async function POST({ request }) {
  try {
    const body = (await request.json()) as { kind: ImportKind; data: unknown; name?: string };
    const result = new ImportAppService(createRequestContext()).import(body.kind, body.data, body.name);
    return json(result, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
