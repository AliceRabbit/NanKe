import type { GenerationProfile } from '$lib/schemas/profile';
import type { ProviderAdapter, ProviderType } from './ProviderAdapter';
import { createGeminiAdapter } from './gemini';
import { createOpenAICompatibleAdapter } from './openai-compatible';

export class ProviderRegistry {
  private readonly adapters = new Map<ProviderType, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.type, adapter);
  }

  get(type: ProviderType): ProviderAdapter {
    const adapter = this.adapters.get(type);
    if (!adapter) throw new Error(`Provider adapter is not registered: ${type}`);
    return adapter;
  }

  resolve(profile: GenerationProfile): ProviderAdapter {
    return this.get(profile.provider.type);
  }
}

export function createDefaultProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();
  registry.register(createOpenAICompatibleAdapter());
  registry.register(createGeminiAdapter());
  return registry;
}
