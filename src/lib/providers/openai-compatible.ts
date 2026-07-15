import type { GenerationProfile } from '$lib/schemas/profile';
import type { GenerationChunk, ProviderRequest } from '$lib/schemas/provider';
import { parseSseStream, type ProviderAdapter, type ProviderFetch } from './ProviderAdapter';

type OpenAIChunk = {
  choices?: Array<{
    delta?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown; reasoning_summary?: unknown };
    message?: { content?: unknown; reasoning_content?: unknown; reasoning?: unknown; reasoning_summary?: unknown };
    text?: string;
  }>;
};

type OpenAICompatibleModelListInput = {
  endpoint: string;
  apiKey?: string;
};

export type OpenAICompatibleModelListErrorCode =
  | 'model_list_unauthorized'
  | 'model_list_not_supported'
  | 'model_list_provider_error'
  | 'model_list_invalid_response';

export class OpenAICompatibleModelListError extends Error {
  constructor(
    message: string,
    public readonly code: OpenAICompatibleModelListErrorCode,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'OpenAICompatibleModelListError';
  }
}

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

export function openAICompatibleModelsUrl(endpoint: string): string {
  const url = new URL(endpoint.trim() || 'https://api.openai.com/v1');
  const path = url.pathname.replace(/\/+$/, '');
  const completionSuffix = ['/chat/completions', '/completions', '/responses'].find((suffix) => path.endsWith(suffix));
  const basePath = completionSuffix ? path.slice(0, -completionSuffix.length) : path;

  url.pathname = basePath.endsWith('/models') ? basePath : `${basePath}/models`;
  url.hash = '';
  return url.toString();
}

function modelId(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  const candidate = record.id ?? record.model ?? record.name;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

export function parseOpenAICompatibleModelList(payload: unknown): string[] {
  let candidates: unknown;
  if (Array.isArray(payload)) {
    candidates = payload;
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    candidates = Array.isArray(record.data) ? record.data : record.models;
  }

  if (!Array.isArray(candidates)) {
    throw new OpenAICompatibleModelListError('The endpoint returned an invalid model list.', 'model_list_invalid_response');
  }

  return [...new Set(candidates.map(modelId).filter(Boolean))].sort((left, right) => left.localeCompare(right, 'en', { numeric: true }));
}

export async function fetchOpenAICompatibleModels(
  input: OpenAICompatibleModelListInput,
  fetchImpl: ProviderFetch = fetch,
  signal?: AbortSignal
): Promise<string[]> {
  const apiKey = input.apiKey?.trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const response = await fetchImpl(openAICompatibleModelsUrl(input.endpoint), {
    method: 'GET',
    headers,
    signal
  });

  if (!response.ok) {
    const message = await readProviderError(response);
    const code =
      response.status === 401 || response.status === 403
        ? 'model_list_unauthorized'
        : response.status === 404 || response.status === 405
          ? 'model_list_not_supported'
          : 'model_list_provider_error';
    throw new OpenAICompatibleModelListError(message, code, response.status);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new OpenAICompatibleModelListError('The endpoint did not return valid JSON.', 'model_list_invalid_response', response.status);
  }

  return parseOpenAICompatibleModelList(payload);
}

function openAIContentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') return part;
        if (part && typeof part === 'object' && 'text' in part) return String((part as { text?: unknown }).text ?? '');
        return '';
      })
      .join('');
  }
  return '';
}

function openAIReasoningText(...values: unknown[]): string {
  return values
    .map((value) => {
      if (typeof value === 'string') return value;
      if (Array.isArray(value)) {
        return value
          .map((part) => {
            if (typeof part === 'string') return part;
            if (!part || typeof part !== 'object') return '';
            const record = part as Record<string, unknown>;
            if (typeof record.text === 'string') return record.text;
            if (typeof record.content === 'string') return record.content;
            if (typeof record.summary_text === 'string') return record.summary_text;
            return '';
          })
          .join('');
      }
      if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.text === 'string') return record.text;
        if (typeof record.content === 'string') return record.content;
        if (Array.isArray(record.summary)) return openAIReasoningText(record.summary);
      }
      return '';
    })
    .join('');
}

export function buildOpenAICompatibleRequest(request: ProviderRequest, profile: GenerationProfile) {
  if (profile.provider.type !== 'openai-compatible') {
    throw new Error('Invalid profile for OpenAI-compatible request.');
  }

  const stream = request.stream ?? profile.request.stream;
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
    stream,
    temperature: request.temperature ?? profile.sampler.temperature,
    top_p: request.topP ?? profile.sampler.topP,
    frequency_penalty: request.frequencyPenalty ?? profile.sampler.frequencyPenalty,
    presence_penalty: request.presencePenalty ?? profile.sampler.presencePenalty,
    seed: request.seed ?? profile.sampler.seed,
    n: request.n ?? profile.sampler.n,
    stop,
    reasoning_effort: profile.thinking?.openai?.effort && profile.thinking.openai.effort !== 'default' ? profile.thinking.openai.effort : undefined
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
    ...(stream ? { stream_options: { include_usage: true } } : {})
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
      const streaming = request.stream ?? profile.request.stream;
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

      if (!streaming) {
        const payload = (await response.json()) as OpenAIChunk;
        const message = payload.choices?.[0]?.message;
        const thinking = openAIReasoningText(message?.reasoning_content, message?.reasoning, message?.reasoning_summary);
        const text = openAIContentText(message?.content) || payload.choices?.[0]?.text || '';
        if (thinking) yield { type: 'thinking', text: thinking, raw: payload };
        if (text) yield { type: 'text', text, raw: payload };
        yield { type: 'done', text: '' };
        return;
      }

      for await (const payload of parseSseStream(response)) {
        const chunk = payload as OpenAIChunk;
        const delta = chunk.choices?.[0]?.delta;
        const thinking = openAIReasoningText(delta?.reasoning_content, delta?.reasoning, delta?.reasoning_summary);
        const text = openAIContentText(delta?.content) || chunk.choices?.[0]?.text || '';
        if (thinking) yield { type: 'thinking', text: thinking, raw: payload };
        if (text) yield { type: 'text', text, raw: payload };
      }

      yield { type: 'done', text: '' };
    }
  };
}
