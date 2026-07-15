import type { GenerationProfile } from '$lib/schemas/profile';

type SillyTavernProfileMetadata = {
  kind?: string;
  promptManager?: {
    promptCount?: number;
    orderedPromptCount?: number;
    enabledPromptCount?: number;
    inactivePromptCount?: number;
  };
};

export function profileSummary(profile: GenerationProfile) {
  const sillyTavern = profile.metadata.sillyTavern as SillyTavernProfileMetadata | undefined;

  return {
    id: profile.id,
    name: profile.name,
    provider:
      profile.provider.type === 'gemini'
        ? {
            type: profile.provider.type,
            model: profile.provider.model,
            vertex: profile.provider.vertex
              ? profile.provider.vertex.mode === 'oauth'
                ? {
                    mode: profile.provider.vertex.mode,
                    projectId: profile.provider.vertex.projectId,
                    location: profile.provider.vertex.location
                  }
                : { mode: profile.provider.vertex.mode }
              : undefined
          }
        : {
            type: profile.provider.type,
            model: profile.provider.model,
            endpoint: profile.provider.endpoint,
            compatibility: profile.provider.compatibility
          },
    sampler: profile.sampler,
    request: profile.request,
    thinking: profile.thinking,
    prompt: {
      mode: profile.prompt.mode,
      macroMode: profile.prompt.macroMode,
      squashSystemMessages: profile.prompt.squashSystemMessages,
      slots: []
    },
    regex: {
      enabled: profile.regex.enabled,
      scripts: []
    },
    metadata: {
      sillyTavern: {
        kind: sillyTavern?.kind,
        promptManager: sillyTavern?.promptManager
      }
    },
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
}
