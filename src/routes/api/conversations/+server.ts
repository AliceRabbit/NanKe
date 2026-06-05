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
    const query = url.searchParams.get('q') ?? undefined;
    const limit = parsePositiveInt(url.searchParams.get('limit'));
    const offset = parsePositiveInt(url.searchParams.get('offset')) ?? 0;
    const beforeUpdatedAt = parsePositiveInt(url.searchParams.get('beforeUpdatedAt'));
    const beforeId = url.searchParams.get('beforeId') ?? undefined;
    if (id && url.searchParams.get('export') === 'true') {
      const snapshot = context.conversations.exportSnapshot(id, {
        includeDeleted: url.searchParams.get('includeDeleted') === 'true'
      });
      if (!snapshot) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
      return new Response(JSON.stringify(snapshot, null, 2), {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition': `attachment; filename="${downloadFilename(snapshot.conversation.title)}.nanke-conversation.json"`
        }
      });
    }
    if (id && url.searchParams.get('tree') === 'true') {
      const tree = context.conversations.getTree(id);
      if (!tree) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
      return json(tree);
    }
    if (id) return json(context.conversations.getWithMessages(id));

    const queryCharacterIds =
      query && !characterId
        ? context.characters
            .list()
            .filter((character) => character.name.toLowerCase().includes(query.trim().toLowerCase()))
            .map((character) => character.id)
        : undefined;
    return json(context.conversations.list({ characterId, includeArchived, query, queryCharacterIds, limit, offset, beforeUpdatedAt, beforeId }));
  } catch (error) {
    return errorResponse(error);
  }
}

function parsePositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function downloadFilename(title: string): string {
  return (
    title
      .trim()
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .slice(0, 80) || 'conversation'
  );
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

    if (body?.action === 'clone') {
      if (typeof body.conversationId !== 'string') {
        throw new AppError('conversationId is required.', 400, 'conversation_clone_required');
      }
      const conversation = context.conversations.clone(body.conversationId, typeof body.title === 'string' ? body.title : undefined);
      if (!conversation) throw new AppError('Conversation not found.', 404, 'conversation_not_found');
      return json(conversation, { status: 201 });
    }

    if (body?.action === 'fork-path') {
      if (typeof body.conversationId !== 'string' || typeof body.nodeId !== 'string') {
        throw new AppError('conversationId and nodeId are required.', 400, 'conversation_fork_required');
      }
      const conversation = context.conversations.forkPathToConversation(body.conversationId, body.nodeId, {
        title: typeof body.title === 'string' ? body.title : undefined
      });
      if (!conversation) throw new AppError('Conversation node not found.', 404, 'conversation_node_not_found');
      return json(conversation, { status: 201 });
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

    if (body?.action === 'delete-node-subtree') {
      if (typeof body.conversationId !== 'string' || typeof body.nodeId !== 'string') {
        throw new AppError('conversationId and nodeId are required.', 400, 'conversation_node_delete_required');
      }
      const conversation = context.conversations.deleteNodeSubtree(body.conversationId, body.nodeId);
      if (!conversation) throw new AppError('Conversation node not found.', 404, 'conversation_node_not_found');
      return json(conversation);
    }

    if (body?.action === 'edit-message-branch') {
      if (typeof body.conversationId !== 'string' || typeof body.nodeId !== 'string' || typeof body.content !== 'string') {
        throw new AppError('conversationId, nodeId, and content are required.', 400, 'conversation_node_edit_required');
      }
      const conversation = context.conversations.editMessageAsSibling(body.conversationId, body.nodeId, body.content);
      if (!conversation) throw new AppError('Conversation node not found.', 404, 'conversation_node_not_found');
      return json(conversation);
    }

    if (body?.action === 'edit-message') {
      if (typeof body.conversationId !== 'string' || typeof body.nodeId !== 'string' || typeof body.content !== 'string') {
        throw new AppError('conversationId, nodeId, and content are required.', 400, 'conversation_node_edit_required');
      }
      const conversation = context.conversations.editMessage(body.conversationId, body.nodeId, body.content);
      if (!conversation) throw new AppError('Conversation node not found.', 404, 'conversation_node_not_found');
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
