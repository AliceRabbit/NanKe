import { createRequestContext } from '$lib/server/request-context';
import type { GenerationProfile } from '$lib/schemas/profile';
import type { PageServerLoad } from './$types';

const conversationPageSize = 80;

type SillyTavernProfileMetadata = {
  kind?: string;
  promptManager?: {
    promptCount?: number;
    orderedPromptCount?: number;
    enabledPromptCount?: number;
    inactivePromptCount?: number;
  };
};

function conversationCursorFrom(conversations: Array<{ id?: string; updatedAt?: number }>) {
  const last = conversations.at(-1);
  return typeof last?.updatedAt === 'number' && last.id ? { updatedAt: last.updatedAt, id: last.id } : null;
}

function profileSummary(profile: GenerationProfile) {
  const sillyTavern = profile.metadata.sillyTavern as SillyTavernProfileMetadata | undefined;

  return {
    id: profile.id,
    name: profile.name,
    provider:
      profile.provider.type === 'gemini'
        ? {
            type: profile.provider.type,
            model: profile.provider.model,
            endpoint: profile.provider.endpoint,
            vertex: profile.provider.vertex
              ? {
                  mode: profile.provider.vertex.mode,
                  projectId: profile.provider.vertex.projectId,
                  location: profile.provider.vertex.location
                }
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

export const load = (() => {
  const context = createRequestContext();
  context.profiles.ensureDefault();

  const conversations = context.conversations.list({ limit: conversationPageSize });

  return {
    initial: {
      profiles: context.profiles.list().map(profileSummary),
      profilesHydrated: false,
      characters: context.characters.list(),
      personas: context.personas.list(),
      personaCharacterBindings: context.personas.listCharacterBindings(),
      worldBooks: context.worldBooks.list(),
      conversations,
      conversationCursor: conversationCursorFrom(conversations),
      conversationHasMore: conversations.length === conversationPageSize,
      conversationPageSize
    }
  };
}) satisfies PageServerLoad;
