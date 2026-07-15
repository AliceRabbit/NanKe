import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { fetchOpenAICompatibleModels, OpenAICompatibleModelListError } from '$lib/providers/openai-compatible';
import { AppError, errorResponse } from '$lib/server/errors';

const requestSchema = z.object({
  endpoint: z
    .string()
    .trim()
    .min(1)
    .url()
    .refine((value) => {
      const url = new URL(value);
      return (url.protocol === 'http:' || url.protocol === 'https:') && !url.username && !url.password;
    }),
  apiKey: z.string().max(16_384).optional()
});

const requestTimeoutMs = 12_000;

export async function POST({ request }) {
  try {
    const body = await request.json().catch(() => undefined);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      throw new AppError('A valid HTTP(S) endpoint is required.', 400, 'model_list_invalid_request');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(new Error('Model list request timed out.')), requestTimeoutMs);
    const abortFromClient = () => controller.abort(request.signal.reason);
    request.signal.addEventListener('abort', abortFromClient, { once: true });

    try {
      const models = await fetchOpenAICompatibleModels(parsed.data, fetch, controller.signal);
      return json({ models });
    } catch (error) {
      if (controller.signal.aborted && !request.signal.aborted) {
        throw new AppError('The model list request timed out.', 504, 'model_list_timeout');
      }
      if (error instanceof OpenAICompatibleModelListError) {
        const status = error.status === 401 || error.status === 403 ? 401 : error.status === 404 || error.status === 405 ? 404 : 502;
        throw new AppError(error.message, status, error.code);
      }
      throw new AppError('The model endpoint could not be reached.', 502, 'model_list_unreachable');
    } finally {
      clearTimeout(timeout);
      request.signal.removeEventListener('abort', abortFromClient);
    }
  } catch (error) {
    return errorResponse(error);
  }
}
