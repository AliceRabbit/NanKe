import { json } from '@sveltejs/kit';
import { createConversation } from '$lib/schemas/conversation';
import { createRequestContext } from '$lib/server/request-context';
import { AppError, errorResponse } from '$lib/server/errors';

export function GET({ url }) {
  try {
    const context = createRequestContext();
    const id = url.searchParams.get('id');
    const characterId = url.searchParams.get('characterId') ?? undefined;
    const includeArchived = url.searchParams.get('includeArchived') === 'true';
    return json(id ? context.conversations.getWithMessages(id) : context.conversations.list({ characterId, includeArchived }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const conversation = createConversation(body);
    return json(createRequestContext().conversations.save(conversation), { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH({ request }) {
  try {
    const body = await request.json();
    const context = createRequestContext();
    if (body?.action === 'rename') {
      if (typeof body.conversationId !== 'string' || typeof body.title !== 'string') {
        throw new AppError('conversationId and title are required.', 400, 'conversation_rename_required');
      }
      const conversation = context.conversations.rename(body.conversationId, body.title);
      if (!conversation) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
      return json(conversation);
    }

    if (body?.action === 'archive') {
      if (typeof body.conversationId !== 'string') {
        throw new AppError('conversationId is required.', 400, 'conversation_archive_required');
      }
      const conversation = context.conversations.archive(body.conversationId, body.archived !== false);
      if (!conversation) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
      return json(conversation);
    }

    if (body?.action === 'set-active-leaf') {
      if (typeof body.conversationId !== 'string' || typeof body.leafId !== 'string') {
        throw new AppError('conversationId and leafId are required.', 400, 'conversation_leaf_required');
      }
      const conversation = context.conversations.setActiveLeaf(body.conversationId, body.leafId, {
        restoreSubtree: body.restoreSubtree !== false
      });
      if (!conversation) throw new AppError('Conversation leaf not found.', 404, 'conversation_leaf_not_found');
      return json(conversation);
    }

    if (body?.action === 'switch-sibling') {
      if (typeof body.messageId !== 'string' || (body.direction !== 'left' && body.direction !== 'right')) {
        throw new AppError('messageId and direction are required.', 400, 'conversation_sibling_required');
      }
      const conversation = context.conversations.switchSibling(body.messageId, body.direction);
      if (!conversation) throw new AppError('Message sibling not found.', 404, 'message_sibling_not_found');
      return json(conversation);
    }

    throw new AppError('Unsupported conversation action.', 400, 'conversation_action_unknown');
  } catch (error) {
    return errorResponse(error);
  }
}

export function DELETE({ url }) {
  try {
    const id = url.searchParams.get('id');
    if (!id) throw new AppError('Conversation id is required.', 400, 'conversation_delete_required');
    const deleted = createRequestContext().conversations.delete(id);
    if (!deleted) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
    return json({ deleted: true, id });
  } catch (error) {
    return errorResponse(error);
  }
}
