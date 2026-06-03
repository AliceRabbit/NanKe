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

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents,
    generationConfig: {
      temperature: request.temperature ?? profile.sampler.temperature,
      topP: request.topP ?? profile.sampler.topP,
      topK: request.topK ?? profile.sampler.topK,
      maxOutputTokens: request.maxTokens ?? profile.sampler.maxTokens,
      stopSequences: request.stop.length ? request.stop : profile.sampler.stop
    }
  };
}

function geminiUrl(profile: GenerationProfile, apiKey?: string): string {
  if (profile.provider.type !== 'gemini') throw new Error('Invalid profile for Gemini adapter.');
  if (profile.provider.endpoint) return profile.provider.endpoint;
  if (profile.provider.vertex) {
    const { projectId, location } = profile.provider.vertex;
    return `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${encodeURIComponent(profile.provider.model)}:streamGenerateContent?alt=sse`;
  }
  const key = apiKey ? `?alt=sse&key=${encodeURIComponent(apiKey)}` : '?alt=sse';
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(profile.provider.model)}:streamGenerateContent${key}`;
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

      const response = await fetchImpl(geminiUrl(profile, apiKey), {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(vertexToken ? { Authorization: `Bearer ${vertexToken}` } : {})
        },
        body: JSON.stringify(buildGeminiRequest(request, profile))
      });

      if (!response.ok) {
        yield { type: 'error', text: await response.text(), raw: { status: response.status } };
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
