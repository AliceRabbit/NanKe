import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';

export type ProviderType = GenerationProfile['provider']['type'];

export interface ProviderAdapter {
  type: ProviderType;
  stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk>;
}

export type ProviderFetch = typeof fetch;

export function resolveSecret(value: string | undefined, envName: string | undefined): string | undefined {
  const direct = value?.trim();
  if (direct) return direct;
  const name = envName?.trim();
  if (!name) return undefined;
  return process.env[name]?.trim();
}

export async function* parseSseStream(response: Response): AsyncIterable<unknown> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;
      try {
        yield JSON.parse(data);
      } catch {
        yield data;
      }
    }
  }
}
