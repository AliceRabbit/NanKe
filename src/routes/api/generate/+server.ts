import { GenerationAppService } from '$lib/server/services';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';

function streamErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown generation error';
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const service = new GenerationAppService(createRequestContext());
    const encoder = new TextEncoder();
    const iterator = service.generate(body, request.signal)[Symbol.asyncIterator]();
    let first: IteratorResult<string>;

    try {
      first = await iterator.next();
    } catch (error) {
      return errorResponse(error);
    }

    const stream = new ReadableStream({
      async start(controller) {
        if (!first.done) {
          controller.enqueue(encoder.encode(first.value));
        }

        try {
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            controller.enqueue(encoder.encode(next.value));
          }
          controller.close();
        } catch (error) {
          if (isAbortError(error)) {
            controller.close();
            return;
          }
          controller.enqueue(encoder.encode(`\n\n[Generation error] ${streamErrorMessage(error)}`));
          controller.close();
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
