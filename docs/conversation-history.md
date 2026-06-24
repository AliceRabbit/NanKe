# Conversation History

NanKe stores chat history as a native message tree. The tree is designed for branching, regeneration, continuation, editing, visualization, and export without copying SillyTavern's chat-file layout.

## Data Model

`conversations` stores the chat header and query indexes:

- `rootNodeId`: synthetic root node for the tree.
- `activeLeafId`: current visible branch leaf.
- `nodeCount`, `branchCount`, `activeDepth`, `lastPreview`: derived fields for list UI and quick summaries.
- `characterId`, `personaId`, `profileId`, `worldBookIds`: current binding context.
- `revision`, `archivedAt`, `createdAt`, `updatedAt`: lifecycle fields.

`message_nodes` stores the history tree:

- `parentId`: parent node. Message nodes under the same parent are alternatives.
- `kind`: `root` or `message`.
- `role`, `speakerId`, `speakerName`, `speakerAvatarAssetId`: display and prompt identity fields.
- `content` and `thinking`: visible text and normalized thinking text.
- `siblingOrder`: stable order for sibling alternatives.
- `depth`: cached depth for path reconstruction and tree summaries.
- `lastActiveLeafId`: remembers the last descendant leaf selected under a node.
- `status`: lifecycle marker used by old data and maintenance code; normal delete operations physically remove rows.
- `metadata`: small per-node provenance such as edit, clone, or fork source IDs.

`message_assets` stores attachment references for nodes. Large binary assets stay in the asset store; message history only keeps references.

The older `messages` table is not the source of truth for current conversation history.

## Invariants

- The active conversation view is the path from `rootNodeId` to `activeLeafId`, excluding the root node.
- Regeneration creates an assistant sibling under the target message's parent.
- Sibling switching changes `activeLeafId` and restores the chosen sibling's remembered descendant leaf when possible.
- `lastActiveLeafId` is updated on ancestors whenever a branch is selected or appended.
- `nodeCount` and `branchCount` count live message nodes.
- `Conversation` summary fields are cache/index data. `message_nodes` is the source of truth for history content and branching.
- Maintenance repair treats `message_nodes` as authoritative and rebuilds derived conversation fields without rewriting user content.

## Editing

Normal message editing is in-place:

- `edit-message` updates the selected node content.
- The original node ID is preserved.
- The active path is not split just because text was corrected.
- `metadata.editedAt` records the edit time.

Branch editing still exists as an explicit operation:

- `edit-message-branch` creates a sibling node with `metadata.editedFromNodeId`.
- This should be used only when the user intentionally wants an alternate branch.

This keeps the common edit path simple while preserving a separate escape hatch for deliberate branching.

## Deletion

NanKe does not rely on indefinite soft deletion for normal chat cleanup.

- Deleting an entire conversation physically deletes its message assets, message nodes, legacy message rows, and conversation row.
- `delete-node-subtree` physically deletes the selected node and all live descendants, then moves the active leaf to a nearby valid fallback.
- `delete-node` physically deletes only the selected node. Its direct children are reparented to the deleted node's parent, descendant depths are adjusted, sibling order is rebuilt, and the active leaf is repaired.
- `purge-deleted-nodes` is a maintenance endpoint for stale rows with `status = 'deleted'` from older data or interrupted migrations.

This design avoids unbounded growth from deleted chat branches while keeping the two user-visible deletion choices clear.

## Operations

- `appendMessage`: append a child under the active leaf or an explicit parent.
- `appendToMessage`: continue an assistant leaf by appending text and optional thinking to the same node.
- `switchSibling`: move between sibling alternatives.
- `setActiveLeaf`: focus a live node, optionally restoring its remembered subtree.
- `editMessage`: update a node in place.
- `editMessageAsSibling`: create an edited sibling branch.
- `deleteNode`: remove one node and splice its children upward.
- `deleteNodeSubtree`: remove a whole branch.
- `clone`: copy the full live tree to a new conversation with fresh IDs.
- `forkPathToConversation`: copy only the path from root to a selected message into a new linear conversation.
- `exportSnapshot`: export the native tree snapshot.
- `importSnapshot`: import a native snapshot as a new conversation with remapped IDs.
- `repairDerivedState`: maintenance-only rebuild of `rootNodeId`, `activeLeafId`, `nodeCount`, `branchCount`, `activeDepth`, and `lastPreview`.

## Listing And Search

Conversation list queries are server-owned. The UI should not re-filter by search text after the API returns results; otherwise it can discard valid server results and make pagination inconsistent.

Current list search covers:

- conversation title;
- `lastPreview`;
- matching character names via API-provided `queryCharacterIds`.

Full message-body search should not use `LIKE '%term%'` over `message_nodes`. If full-history search becomes necessary, add a dedicated SQLite FTS index and keep the ordinary conversation list query separate.

Pagination uses keyset cursors:

- sort by `updated_at DESC, id DESC`;
- use `beforeUpdatedAt` and `beforeId` for the next page;
- keep `offset` only as a compatibility fallback, not the primary path.

## Import And Export

Native snapshots use:

```text
format: nanke.conversation.snapshot
version: 1
conversation: Conversation
nodes: MessageNode[]
activePathNodeIds: string[]
assets: ConversationSnapshotAsset[]
```

Snapshot imports always create a new conversation. They never overwrite an existing conversation or reuse source node IDs.

SillyTavern chat JSONL import still exists as a legacy intake path, but it is not NanKe's native storage format.
