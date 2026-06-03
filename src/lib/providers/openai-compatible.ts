import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import { parseSseStream, resolveSecret, type ProviderAdapter, type ProviderFetch } from './ProviderAdapter';

type OpenAIChunk = {
  choices?: Array<{
    delta?: { content?: string };
    text?: string;
  }>;
};

export function buildOpenAICompatibleRequest(request: ProviderRequest, profile: GenerationProfile) {
  return {
    model: profile.provider.model,
    messages: request.messages.map((message) => ({
      role: message.role === 'tool' ? 'user' : message.role,
      content: message.content,
      ...(message.name ? { name: message.name } : {})
    })),
    stream: true,
    temperature: request.temperature ?? profile.sampler.temperature,
    top_p: request.topP ?? profile.sampler.topP,
    max_tokens: request.maxTokens ?? profile.sampler.maxTokens,
    stop: request.stop.length ? request.stop : profile.sampler.stop
  };
}

export function createOpenAICompatibleAdapter(fetchImpl: ProviderFetch = fetch): ProviderAdapter {
  return {
    type: 'openai-compatible',
    async *stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk> {
      if (profile.provider.type !== 'openai-compatible') {
        throw new Error('Invalid profile for OpenAI-compatible adapter.');
      }

      const apiKey = resolveSecret(profile.provider.apiKey, profile.provider.apiKeyEnv);
      const endpoint = profile.provider.endpoint.replace(/\/$/, '');
      const response = await fetchImpl(`${endpoint}/chat/completions`, {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
        },
        body: JSON.stringify(buildOpenAICompatibleRequest(request, profile))
      });

      if (!response.ok) {
        yield { type: 'error', text: await response.text(), raw: { status: response.status } };
        return;
      }

      for await (const payload of parseSseStream(response)) {
        const chunk = payload as OpenAIChunk;
        const text = chunk.choices?.[0]?.delta?.content ?? chunk.choices?.[0]?.text ?? '';
        if (text) yield { type: 'text', text, raw: payload };
      }

      yield { type: 'done', text: '' };
    }
  };
}
