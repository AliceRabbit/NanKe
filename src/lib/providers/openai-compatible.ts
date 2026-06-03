import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import { parseSseStream, type ProviderAdapter, type ProviderFetch } from './ProviderAdapter';

type OpenAIChunk = {
  choices?: Array<{
    delta?: { content?: string };
    text?: string;
  }>;
};

function withDefinedValues<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as Partial<T>;
}

export function openAICompatibleUrl(profile: GenerationProfile): string {
  if (profile.provider.type !== 'openai-compatible') {
    throw new Error('Invalid profile for OpenAI-compatible adapter.');
  }

  const endpoint = (profile.provider.endpoint || 'https://api.openai.com/v1').replace(/\/+$/, '');
  if (endpoint.endsWith('/chat/completions')) return endpoint;
  return `${endpoint}/chat/completions`;
}

export function buildOpenAICompatibleRequest(request: ProviderRequest, profile: GenerationProfile) {
  if (profile.provider.type !== 'openai-compatible') {
    throw new Error('Invalid profile for OpenAI-compatible request.');
  }

  const stop = request.stop.length ? request.stop : profile.sampler.stop;
  const maxTokens = request.maxTokens ?? profile.sampler.maxTokens;
  const messages = request.messages.map((message) => ({
    role: message.role === 'tool' ? 'user' : message.role,
    content: message.content,
    ...(message.name ? { name: message.name } : {})
  }));
  const common = {
    model: profile.provider.model,
    messages,
    stream: true,
    temperature: request.temperature ?? profile.sampler.temperature,
    top_p: request.topP ?? profile.sampler.topP,
    frequency_penalty: request.frequencyPenalty ?? profile.sampler.frequencyPenalty,
    presence_penalty: request.presencePenalty ?? profile.sampler.presencePenalty,
    seed: request.seed ?? profile.sampler.seed,
    n: request.n ?? profile.sampler.n,
    stop
  };

  if (profile.provider.compatibility === 'extended') {
    return withDefinedValues({
      ...common,
      top_k: request.topK ?? profile.sampler.topK,
      top_a: request.topA ?? profile.sampler.topA,
      min_p: request.minP ?? profile.sampler.minP,
      repetition_penalty: request.repetitionPenalty ?? profile.sampler.repetitionPenalty,
      max_tokens: maxTokens
    });
  }

  return withDefinedValues({
    ...common,
    max_completion_tokens: maxTokens,
    stream_options: { include_usage: true }
  });
}

function openAIHeaders(profile: GenerationProfile, apiKey?: string): HeadersInit {
  if (profile.provider.type !== 'openai-compatible') {
    throw new Error('Invalid profile for OpenAI-compatible adapter.');
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
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

export function createOpenAICompatibleAdapter(fetchImpl: ProviderFetch = fetch): ProviderAdapter {
  return {
    type: 'openai-compatible',
    async *stream(request: ProviderRequest, profile: GenerationProfile, signal?: AbortSignal): AsyncIterable<GenerationChunk> {
      if (profile.provider.type !== 'openai-compatible') {
        throw new Error('Invalid profile for OpenAI-compatible adapter.');
      }

      const apiKey = profile.provider.apiKey?.trim();
      const response = await fetchImpl(openAICompatibleUrl(profile), {
        method: 'POST',
        signal,
        headers: openAIHeaders(profile, apiKey),
        body: JSON.stringify(buildOpenAICompatibleRequest(request, profile))
      });

      if (!response.ok) {
        yield { type: 'error', text: await readProviderError(response), raw: { status: response.status } };
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
