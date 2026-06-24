import { createRequestContext } from '$lib/server/request-context';
import { profileSummary } from '$lib/server/profile-summary';
import type { PageServerLoad } from './$types';

const conversationPageSize = 80;

function conversationCursorFrom(conversations: Array<{ id?: string; updatedAt?: number }>) {
  const last = conversations.at(-1);
  return typeof last?.updatedAt === 'number' && last.id ? { updatedAt: last.updatedAt, id: last.id } : null;
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
