import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';

export type ProviderType = GenerationProfile['provider']['type'];

export interface ProviderAdapter {
  type: ProviderType;
  stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk>;
}

export type ProviderFetch = typeof fetch;

function parseProviderPayload(data: string): unknown[] {
  const text = data.trim();
  if (!text || text === '[DONE]') return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [text];
  }
}

function parseSseEvent(event: string): unknown[] {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .join('\n');
  return parseProviderPayload(data);
}

export async function* parseSseStream(response: Response): AsyncIterable<unknown> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (true) {
      const match = /\r?\n\r?\n/.exec(buffer);
      if (!match) break;
      const event = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);
      for (const payload of parseSseEvent(event)) {
        yield payload;
      }
    }
  }

  const remaining = buffer.trim();
  if (!remaining) return;

  if (remaining.includes('data:')) {
    const events = remaining.split(/\r?\n\r?\n/).filter(Boolean);
    for (const event of events) {
      for (const payload of parseSseEvent(event)) {
        yield payload;
      }
    }
    return;
  }

  for (const payload of parseProviderPayload(remaining)) {
    yield payload;
  }
}
