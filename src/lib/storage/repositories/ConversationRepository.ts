import { asc, eq } from 'drizzle-orm';
import { conversationSchema, type Conversation, type ConversationWithMessages } from '$lib/schemas/conversation';
import { nankeMessageSchema, type NankeMessage } from '$lib/schemas/message';
import { conversations, messages } from '../schema';
import { getDatabase } from '../db';

export class ConversationRepository {
  constructor(private readonly db = getDatabase()) {}

  list(): Conversation[] {
    return this.db.select().from(conversations).orderBy(asc(conversations.updatedAt)).all().map((row) => conversationSchema.parse(row.data));
  }

  get(id: string): Conversation | undefined {
    const row = this.db.select().from(conversations).where(eq(conversations.id, id)).get();
    return row ? conversationSchema.parse(row.data) : undefined;
  }

  getWithMessages(id: string): ConversationWithMessages | undefined {
    const conversation = this.get(id);
    if (!conversation) return undefined;
    return { ...conversation, messages: this.listMessages(id) };
  }

  save(conversation: Conversation): Conversation {
    const updated = { ...conversation, updatedAt: Date.now() };
    this.db
      .insert(conversations)
      .values({
        id: updated.id,
        title: updated.title,
        characterId: updated.characterId,
        profileId: updated.profileId,
        data: updated,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt
      })
      .onConflictDoUpdate({
        target: conversations.id,
        set: {
          title: updated.title,
          characterId: updated.characterId,
          profileId: updated.profileId,
          data: updated,
          updatedAt: updated.updatedAt
        }
      })
      .run();
    return updated;
  }

  listMessages(conversationId: string): NankeMessage[] {
    return this.db
      .select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(asc(messages.createdAt))
      .all()
      .map((row) => nankeMessageSchema.parse(row.data));
  }

  appendMessage(message: NankeMessage): NankeMessage {
    if (!message.conversationId) throw new Error('Message requires conversationId before persistence.');
    this.db
      .insert(messages)
      .values({
        id: message.id,
        conversationId: message.conversationId,
        role: message.role,
        data: message,
        createdAt: message.createdAt
      })
      .onConflictDoUpdate({
        target: messages.id,
        set: { data: message }
      })
      .run();
    return message;
  }
}
