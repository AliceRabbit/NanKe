import { GenerationPipeline, inspectPrompt } from '$lib/core';
import { renderPromptTemplate } from '$lib/core/prompt/PromptCompiler';
import { createMessage } from '$lib/schemas/message';
import type { ProviderRequest } from '$lib/schemas/provider';
import { createDefaultProviderRegistry, type ProviderRegistry } from '$lib/providers';
import type { createRequestContext } from '$lib/server/request-context';
import { AppError } from '$lib/server/errors';

export type GenerateInput = {
  conversationId?: string;
  profileId?: string;
  characterId?: string;
  personaId?: string;
  message: string;
  dryRun?: boolean;
};

export class GenerationAppService {
  private readonly pipeline = new GenerationPipeline();

  constructor(
    private readonly context: ReturnType<typeof createRequestContext>,
    private readonly providers: ProviderRegistry = createDefaultProviderRegistry()
  ) {}

  async *generate(input: GenerateInput, signal?: AbortSignal): AsyncIterable<string> {
    const profile = input.profileId ? this.context.profiles.get(input.profileId) : this.context.profiles.ensureDefault();
    if (!profile) throw new AppError('Generation profile not found.', 404, 'profile_not_found');

    const existingConversation = input.conversationId ? this.context.conversations.get(input.conversationId) : undefined;
    const defaultPersona = this.context.personas.getDefault();
    const personaId = input.personaId ?? existingConversation?.personaId ?? defaultPersona?.id;
    const conversation =
      existingConversation ??
      (input.dryRun
        ? undefined
        : this.context.conversations.save({
            id: crypto.randomUUID(),
            title: input.message.slice(0, 40) || 'New Chat',
            characterId: input.characterId,
            personaId,
            profileId: profile.id,
            worldBookIds: [],
            metadata: {},
            createdAt: Date.now(),
            updatedAt: Date.now()
          }));

    const conversationId = conversation?.id ?? input.conversationId;
    const character = input.characterId ? this.context.characters.get(input.characterId) : conversation?.characterId ? this.context.characters.get(conversation.characterId) : undefined;
    const persona = personaId ? this.context.personas.get(personaId) : undefined;

    if (!input.dryRun && conversation && input.personaId && input.personaId !== conversation.personaId) {
      this.context.conversations.save({ ...conversation, personaId: input.personaId });
    }

    const userMessage = createMessage({ conversationId, role: 'user', content: input.message });
    const existingMessages = conversationId ? this.context.conversations.listMessages(conversationId) : [];
    const openingMessage =
      character?.firstMessage && existingMessages.length === 0
        ? createMessage({
            conversationId,
            role: 'assistant',
            content: renderPromptTemplate(character.firstMessage, {
              character,
              persona: persona?.description,
              userName: persona?.name
            })
          })
        : undefined;
    const messages = [...existingMessages, ...(openingMessage ? [openingMessage] : []), userMessage];
    if (!input.dryRun) {
      if (!conversationId) throw new AppError('Could not create conversation.', 500, 'conversation_create_failed');
      if (openingMessage) this.context.conversations.appendMessage(openingMessage);
      this.context.conversations.appendMessage(userMessage);
    }

    const worldBooks = [
      ...(character?.characterBook ? [character.characterBook] : []),
      ...(conversation?.worldBookIds ?? []).map((id) => this.context.worldBooks.get(id)).filter((item) => item !== undefined)
    ];
    const compiled = this.pipeline.compile({
      profile,
      character,
      messages,
      worldBooks,
      persona: persona?.description,
      userName: persona?.name
    });

    if (input.dryRun) {
      yield JSON.stringify({ conversationId, inspector: inspectPrompt(compiled) });
      return;
    }

    const providerRequest: ProviderRequest = {
      messages: compiled.messages.map((message) => ({ role: message.role, name: message.name, content: message.content })),
      stop: profile.sampler.stop ?? [],
      maxTokens: profile.sampler.maxTokens,
      temperature: profile.sampler.temperature,
      topP: profile.sampler.topP,
      topK: profile.sampler.topK
    };

    const adapter = this.providers.resolve(profile);
    let assistantText = '';
    for await (const chunk of adapter.stream(providerRequest, profile, signal)) {
      if (chunk.type === 'error') throw new AppError(chunk.text, 502, 'provider_error');
      if (chunk.type === 'text') {
        assistantText += chunk.text;
        yield chunk.text;
      }
    }

    if (assistantText) {
      if (!conversationId) throw new AppError('Assistant response has no conversation target.', 500, 'conversation_missing');
      this.context.conversations.appendMessage(createMessage({ conversationId, role: 'assistant', content: assistantText }));
    }
  }
}
