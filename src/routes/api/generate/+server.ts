import { GenerationAppService } from '$lib/server/services';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

export async function POST({ request }) {
  try {
    const body = await request.json();
    const service = new GenerationAppService(createRequestContext());
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const text of service.generate(body, request.signal)) {
            controller.enqueue(encoder.encode(text));
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
