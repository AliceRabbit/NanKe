import { createConversation, type Conversation } from '$lib/schemas/conversation';
import { createMessage, type NankeMessage } from '$lib/schemas/message';

export class ConversationService {
  create(title: string, characterId?: string, profileId?: string): Conversation {
    return createConversation({ title, characterId, profileId });
  }

  userMessage(content: string, conversationId?: string): NankeMessage {
    return createMessage({ role: 'user', content, conversationId });
  }

  assistantMessage(content: string, conversationId?: string): NankeMessage {
    return createMessage({ role: 'assistant', content, conversationId });
  }
}
