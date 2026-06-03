import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import { parseSseStream, resolveSecret, type ProviderAdapter, type ProviderFetch } from './ProviderAdapter';

type GeminiChunk = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
};

function withDefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}

function geminiRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

export function buildGeminiRequest(request: ProviderRequest, profile: GenerationProfile) {
  const systemText = request.messages
    .filter((message) => message.role === 'system')
    .map((message) => message.content)
    .join('\n\n');

  const contents = request.messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: geminiRole(message.role),
      parts: [{ text: message.content }]
    }));

  const stop = request.stop.length ? request.stop : profile.sampler.stop;
  const generationConfig = withDefinedValues({
    temperature: request.temperature ?? profile.sampler.temperature,
    topP: request.topP ?? profile.sampler.topP,
    topK: request.topK ?? profile.sampler.topK,
    maxOutputTokens: request.maxTokens ?? profile.sampler.maxTokens,
    stopSequences: stop?.length ? stop : undefined,
    frequencyPenalty: request.frequencyPenalty ?? profile.sampler.frequencyPenalty,
    presencePenalty: request.presencePenalty ?? profile.sampler.presencePenalty,
    seed: request.seed ?? profile.sampler.seed,
    candidateCount: request.n ?? profile.sampler.n
  });

  return withDefinedValues({
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: Object.keys(generationConfig).length ? generationConfig : undefined
  });
}

export function geminiUrl(profile: GenerationProfile): string {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');
  if (profile.provider.endpoint) return profile.provider.endpoint;
  if (profile.provider.vertex) {
    const { projectId, location } = profile.provider.vertex;
    return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${encodeURIComponent(profile.provider.model)}:streamGenerateContent?alt=sse`;
  }
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.provider.model)}:streamGenerateContent?alt=sse`;
}

function geminiHeaders(profile: GenerationProfile, apiKey?: string, vertexToken?: string): HeadersInit {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (profile.provider.vertex) {
    if (vertexToken) headers.Authorization = `Bearer ${vertexToken}`;
    return headers;
  }

  if (apiKey) headers['x-goog-api-key'] = apiKey;
  return headers;
}

async function readProviderError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `${response.status} ${response.statusText}`;
  try {
    const parsed = JSON.parse(text) as { error?: { message?: string }; message?: string };
    return parsed.error?.message ?? parsed.message ?? text;
  } catch {
    return text;
  }
}

export function createGeminiAdapter(fetchImpl: ProviderFetch = fetch): ProviderAdapter {
  return {
    type: 'gemini',
    async *stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk> {
      if (profile.provider.type !== 'gemini') {
        throw new Error('Invalid profile for Gemini adapter.');
      }

      const apiKey = resolveSecret(profile.provider.apiKey, profile.provider.apiKeyEnv);
      const vertexToken = profile.provider.vertex
        ? resolveSecret(profile.provider.vertex.accessToken, profile.provider.vertex.accessTokenEnv)
        : undefined;

      const response = await fetchImpl(geminiUrl(profile), {
        method: 'POST',
        signal,
        headers: geminiHeaders(profile, apiKey, vertexToken),
        body: JSON.stringify(buildGeminiRequest(request, profile))
      });

      if (!response.ok) {
        yield { type: 'error', text: await readProviderError(response), raw: { status: response.status } };
        return;
      }

      for await (const payload of parseSseStream(response)) {
        const chunk = payload as GeminiChunk;
        const text = chunk.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
        if (text) yield { type: 'text', text, raw: payload };
      }

      yield { type: 'done', text: '' };
    }
  };
}
