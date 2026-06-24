import { GenerationAppService } from '$lib/server/services/GenerationAppService';
import { createRequestContext } from '$lib/server/request-context';
import { errorResponse } from '$lib/server/errors';
import type { GenerationStreamEvent } from '$lib/server/services/GenerationAppService';

function streamErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown generation error';
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === 'AbortError';
}

function encodeEvent(encoder: TextEncoder, event: GenerationStreamEvent | { type: 'error'; text: string }) {
  return encoder.encode(`${JSON.stringify(event)}\n`);
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const service = new GenerationAppService(createRequestContext());
    const encoder = new TextEncoder();
    const iterator = service.generate(body, request.signal)[Symbol.asyncIterator]();
    let first: IteratorResult<GenerationStreamEvent>;

    try {
      first = await iterator.next();
    } catch (error) {
      return errorResponse(error);
    }

    const stream = new ReadableStream({
      async start(controller) {
        if (!first.done) {
          controller.enqueue(encodeEvent(encoder, first.value));
        }

        try {
          while (true) {
            const next = await iterator.next();
            if (next.done) break;
            controller.enqueue(encodeEvent(encoder, next.value));
          }
          controller.close();
        } catch (error) {
          if (isAbortError(error)) {
            controller.close();
            return;
          }
          controller.enqueue(encodeEvent(encoder, { type: 'error', text: streamErrorMessage(error) }));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8'
      }
    });
  } catch (error) {
    return errorResponse(error);
  }
}
