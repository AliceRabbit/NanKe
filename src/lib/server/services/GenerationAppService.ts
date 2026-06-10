import { GenerationPipeline, inspectPrompt } from '$lib/core';
import { applyRegexScripts, hasRegexScriptForPlacement, REGEX_PLACEMENT } from '$lib/core/regex';
import { renderPromptTemplate } from '$lib/core/prompt/PromptCompiler';
import type { Character } from '$lib/schemas/character';
import { createConversation } from '$lib/schemas/conversation';
import { createMessage } from '$lib/schemas/message';
import type { NankeMessage } from '$lib/schemas/message';
import type { ProviderRequest } from '$lib/schemas/provider';
import type { RegexScript } from '$lib/schemas/regex';
import { createDefaultProviderRegistry, type ProviderRegistry } from '$lib/providers';
import type { createRequestContext } from '$lib/server/request-context';
import { AppError } from '$lib/server/errors';
import { resolvePersonaForGeneration } from './PersonaResolver';

export function activeCharacterWorldBookIds(character?: Character): string[] {
  if (!character) return [];
  const bindings = character.worldBookBindings ?? [];
  if (character.worldBookBindings !== undefined) {
    return bindings.filter((binding) => binding.enabled !== false).map((binding) => binding.worldBookId);
  }
  const ids = new Set(character.worldBookIds ?? []);
  if (character.characterBook?.id) ids.add(character.characterBook.id);
  return [...ids];
}

export type GenerateInput = {
  conversationId?: string;
  profileId?: string;
  characterId?: string;
  personaId?: string;
  message?: string;
  regenerateNodeId?: string;
  continueNodeId?: string;
  dryRun?: boolean;
};

export type GenerationStreamEvent =
  | { type: 'text' | 'thinking'; text: string }
  | { type: 'inspector'; text: string }
  | { type: 'done'; text: ''; conversationId?: string; activeLeafId?: string };

export class GenerationAppService {
  private readonly pipeline = new GenerationPipeline();

  constructor(
    private readonly context: ReturnType<typeof createRequestContext>,
    private readonly providers: ProviderRegistry = createDefaultProviderRegistry()
  ) {}

  async *generate(input: GenerateInput, signal?: AbortSignal): AsyncIterable<GenerationStreamEvent> {
    const profile = input.profileId ? this.context.profiles.get(input.profileId) : this.context.profiles.ensureDefault();
    if (!profile) throw new AppError('Generation profile not found.', 404, 'profile_not_found');

    const existingConversation = input.conversationId ? this.context.conversations.get(input.conversationId) : undefined;
    const regenerateNode = input.regenerateNodeId ? this.context.conversations.getMessageNode(input.regenerateNodeId) : undefined;
    const continueNode = input.continueNodeId ? this.context.conversations.getMessageNode(input.continueNodeId) : undefined;
    if (input.regenerateNodeId && input.continueNodeId) {
      throw new AppError('Regenerate and continue cannot be used together.', 400, 'generation_mode_conflict');
    }
    if (input.regenerateNodeId && (!regenerateNode || regenerateNode.kind !== 'message' || regenerateNode.role !== 'assistant')) {
      throw new AppError('Regeneration target must be an assistant message.', 400, 'regenerate_target_invalid');
    }
    if (input.continueNodeId && (!continueNode || continueNode.kind !== 'message' || continueNode.role !== 'assistant')) {
      throw new AppError('Continuation target must be an assistant message.', 400, 'continue_target_invalid');
    }
    if (regenerateNode && regenerateNode.conversationId !== input.conversationId) {
      throw new AppError('Regeneration target does not belong to the requested conversation.', 400, 'regenerate_conversation_mismatch');
    }
    if (continueNode && continueNode.conversationId !== input.conversationId) {
      throw new AppError('Continuation target does not belong to the requested conversation.', 400, 'continue_conversation_mismatch');
    }
    if (continueNode && existingConversation?.activeLeafId !== continueNode.id) {
      throw new AppError('Continuation target must be the active leaf.', 400, 'continue_target_not_active');
    }
    const userInput = input.message?.trim() ?? '';
    if (!regenerateNode && !continueNode && !userInput) {
      throw new AppError('Message is required for generation.', 400, 'message_required');
    }
    const resolvedCharacterId = input.characterId ?? existingConversation?.characterId;
    const character = resolvedCharacterId ? this.context.characters.get(resolvedCharacterId) : undefined;
    const personaResolution = resolvePersonaForGeneration(this.context, {
      explicitPersonaId: input.personaId,
      conversationPersonaId: existingConversation?.personaId,
      characterId: character?.id
    });
    const persona = personaResolution.persona;
    const personaId = persona?.id;
    const conversation =
      existingConversation ??
      (input.dryRun
        ? undefined
        : this.context.conversations.save({
            ...createConversation({
              title: userInput.slice(0, 40) || 'New Chat',
              characterId: input.characterId,
              personaId,
              profileId: profile.id,
              worldBookIds: []
            })
          }));

    const conversationId = conversation?.id ?? input.conversationId;
    const regexScripts = profile.regex.enabled === false ? [] : profile.regex.scripts;
    const regexMacros = {
      char: character?.name ?? 'Assistant',
      charIfNotGroup: character?.name ?? 'Assistant',
      user: persona?.name ?? 'User'
    };

    if (!input.dryRun && conversation && personaId && personaId !== conversation.personaId && (input.personaId || !conversation.personaId)) {
      this.context.conversations.save({ ...conversation, personaId });
    }

    const existingMessages =
      conversationId && regenerateNode?.parentId
        ? this.context.conversations.getPathNodesTo(conversationId, regenerateNode.parentId).map((node) =>
            createMessage({
              id: node.id,
              conversationId: node.conversationId,
              role: node.role ?? 'system',
              speakerId: node.speakerId,
              name: node.speakerName,
              speakerAvatarAssetId: node.speakerAvatarAssetId,
              content: node.content,
              thinking: node.thinking,
              createdAt: node.createdAt,
              metadata: node.metadata
            })
          )
        : conversationId && continueNode
          ? this.context.conversations.getPathNodesTo(conversationId, continueNode.id).map((node) =>
              createMessage({
                id: node.id,
                conversationId: node.conversationId,
                role: node.role ?? 'system',
                speakerId: node.speakerId,
                name: node.speakerName,
                speakerAvatarAssetId: node.speakerAvatarAssetId,
                content: node.content,
                thinking: node.thinking,
                createdAt: node.createdAt,
                metadata: node.metadata
              })
            )
        : conversationId
          ? this.context.conversations.listMessages(conversationId)
          : [];
    const openingMessage =
      !regenerateNode && !continueNode && character?.firstMessage && existingMessages.length === 0
        ? createMessage({
            conversationId,
            role: 'assistant',
            speakerId: character.id,
            content: renderPromptTemplate(character.firstMessage, {
              character,
              persona: persona?.description,
              userName: persona?.name
            }),
            name: character.name,
            speakerAvatarAssetId: character.avatarAssetId
          })
        : undefined;
    const userMessage = regenerateNode || continueNode
      ? undefined
      : createMessage({
          conversationId,
          role: 'user',
          speakerId: persona?.id,
          content: applyRegexScripts(userInput, regexScripts, {
            placement: REGEX_PLACEMENT.USER_INPUT,
            macros: regexMacros
          }),
          name: persona?.name,
          speakerAvatarAssetId: persona?.avatarAssetId
        });
    const messages = [...existingMessages, ...(openingMessage ? [openingMessage] : []), ...(userMessage ? [userMessage] : [])];
    if (!input.dryRun) {
      if (!conversationId) throw new AppError('Could not create conversation.', 500, 'conversation_create_failed');
      if (openingMessage) this.context.conversations.appendMessage(openingMessage);
      if (userMessage) this.context.conversations.appendMessage(userMessage);
    }

    const characterWorldBookIds = activeCharacterWorldBookIds(character);
    const worldBooksById = new Map(
      [...characterWorldBookIds, ...(conversation?.worldBookIds ?? [])]
        .map((id) => this.context.worldBooks.get(id))
        .filter((item) => item !== undefined)
        .map((item) => [item.id, item])
    );
    if (character?.characterBook && characterWorldBookIds.includes(character.characterBook.id) && !worldBooksById.has(character.characterBook.id)) {
      worldBooksById.set(character.characterBook.id, this.context.worldBooks.get(character.characterBook.id) ?? character.characterBook);
    }
    const worldBooks = [...worldBooksById.values()];
    const compiled = this.pipeline.compile({
      profile,
      character,
      messages,
      worldBooks,
      persona: persona?.description,
      userName: persona?.name
    });

    if (input.dryRun) {
      yield { type: 'inspector', text: JSON.stringify({ conversationId, inspector: inspectPrompt(compiled) }) };
      return;
    }

    const promptMessages = compiled.messages.map((message, index) => regexPromptMessage(message, index, compiled.messages.length, regexScripts, regexMacros));
    const providerRequest: ProviderRequest = {
      messages: promptMessages.map((message) => ({ role: message.role, name: message.name, content: message.content })),
      stop: profile.sampler.stop ?? [],
      maxTokens: profile.sampler.maxTokens,
      temperature: profile.sampler.temperature,
      topP: profile.sampler.topP,
      topK: profile.sampler.topK,
      topA: profile.sampler.topA,
      minP: profile.sampler.minP,
      frequencyPenalty: profile.sampler.frequencyPenalty,
      presencePenalty: profile.sampler.presencePenalty,
      repetitionPenalty: profile.sampler.repetitionPenalty,
      seed: profile.sampler.seed,
      n: profile.sampler.n,
      stream: profile.request.stream
    };

    const adapter = this.providers.resolve(profile);
    let assistantText = '';
    let assistantThinking = '';
    const shouldBufferOutput = hasRegexScriptForPlacement(regexScripts, {
      placement: REGEX_PLACEMENT.AI_OUTPUT,
      macros: regexMacros
    });
    for await (const chunk of adapter.stream(providerRequest, profile, signal)) {
      if (chunk.type === 'error') throw new AppError(chunk.text, 502, 'provider_error');
      if (chunk.type === 'thinking') {
        assistantThinking += chunk.text;
        yield { type: 'thinking', text: chunk.text };
      }
      if (chunk.type === 'text') {
        assistantText += chunk.text;
        if (!shouldBufferOutput) yield { type: 'text', text: chunk.text };
      }
    }

    if (assistantText) {
      assistantText = applyRegexScripts(assistantText, regexScripts, {
        placement: REGEX_PLACEMENT.AI_OUTPUT,
        macros: regexMacros
      });
      if (shouldBufferOutput) yield { type: 'text', text: assistantText };
    }

    if (assistantText || assistantThinking) {
      if (!conversationId) throw new AppError('Assistant response has no conversation target.', 500, 'conversation_missing');
      if (continueNode) {
        const continued = this.context.conversations.appendToMessage(conversationId, continueNode.id, assistantText, assistantThinking || undefined);
        if (!continued) throw new AppError('Could not append continuation.', 500, 'continue_save_failed');
      } else {
        this.context.conversations.appendMessage(
          createMessage({
            conversationId,
            role: 'assistant',
            speakerId: character?.id,
            name: character?.name,
            speakerAvatarAssetId: character?.avatarAssetId,
            content: assistantText,
            thinking: assistantThinking || undefined
          }),
          regenerateNode?.parentId ?? undefined
        );
      }
    }

    const savedConversation = conversationId ? this.context.conversations.get(conversationId) : undefined;
    yield { type: 'done', text: '', conversationId, activeLeafId: savedConversation?.activeLeafId };
  }
}

function promptRegexPlacement(message: NankeMessage) {
  if (message.role === 'assistant') return REGEX_PLACEMENT.AI_OUTPUT;
  if (message.role === 'user') return REGEX_PLACEMENT.USER_INPUT;
  return undefined;
}

function regexPromptMessage(
  message: NankeMessage,
  index: number,
  total: number,
  scripts: RegexScript[],
  macros: Record<string, string>
): NankeMessage {
  const placement = promptRegexPlacement(message);
  if (placement === undefined) return message;
  return {
    ...message,
    content: applyRegexScripts(message.content, scripts, {
      placement,
      isPrompt: true,
      depth: total - index,
      macros
    })
  };
}
