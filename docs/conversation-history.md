# Conversation History

NanKe stores chat history as an append-oriented message tree. This keeps branching, regeneration, editing, and export/import explicit without copying SillyTavern's chat-file layout.

## Data Model

`conversations` stores the chat header and queryable summary fields:

- `rootNodeId`: synthetic root node for the tree.
- `activeLeafId`: current visible branch leaf.
- `nodeCount`, `branchCount`, `activeDepth`, `lastPreview`: derived indexes for list UI and quick summaries.
- `characterId`, `personaId`, `profileId`, `worldBookIds`: current binding context.
- `revision`, `archivedAt`, `createdAt`, `updatedAt`: lifecycle fields.

`message_nodes` stores the actual history graph:

- `parentId`: parent node. Message nodes under the same parent are alternatives.
- `siblingOrder`: stable order for swipes/alternatives.
- `depth`: tree depth for path reconstruction and branch maps.
- `lastActiveLeafId`: remembers the last descendant leaf selected under a node.
- `status`: active, archived, deleted, or interrupted.
- `content` and `thinking`: visible text and normalized thinking text.
- `metadata`: small per-node provenance such as edit/fork source IDs.

`message_assets` stores attachment references for nodes. Large binary assets stay in the asset store; message history only keeps references.

## Invariants

- The active conversation view is the path from `rootNodeId` to `activeLeafId`, excluding the root node.
- Editing a message never mutates the original node. It creates a sibling branch with `metadata.editedFromNodeId`.
- Regeneration creates an assistant sibling under the same parent.
- Deleting a branch is a soft delete of the selected node and descendants. Deleted nodes are excluded from normal paths, branch maps, and exports unless explicitly requested.
- `nodeCount` and `branchCount` count non-deleted message nodes. Recompute them after subtree deletion and imported snapshots.
- `lastActiveLeafId` is updated on ancestors whenever a branch is selected or appended. It lets NanKe restore a previous subtree without guessing.
- `Conversation` summary fields are cache/index data. `message_nodes` is the source of truth for history content and branching.
- Maintenance repair treats `message_nodes` as authoritative and rebuilds derived conversation fields without changing user-facing lifecycle fields.

## Operations

- `appendMessage`: append a child under the active leaf or explicit parent.
- `switchSibling`: move between sibling alternatives and restore the selected sibling's remembered subtree.
- `setActiveLeaf`: focus a leaf or, with `restoreSubtree: false`, cut the active path exactly at a historical node.
- `editMessageAsSibling`: create an edited sibling branch and switch to it.
- `deleteNodeSubtree`: soft-delete a branch and choose a nearby fallback leaf.
- `clone`: copy the full non-deleted tree to a new conversation with fresh IDs.
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

Full message-body search should not be implemented with `LIKE '%term%'` over `message_nodes`. That is simple but not high-performance. If full-history search becomes necessary, add a dedicated SQLite FTS index and keep the ordinary conversation list query separate.

Pagination uses keyset cursors:

- sort by `updated_at DESC, id DESC`;
- use `beforeUpdatedAt` and `beforeId` for the next page;
- keep `offset` only as a compatibility fallback, not the primary path.

## Import/Export Format

Native snapshots use:

```text
format: nanke.conversation.snapshot
version: 1
conversation: Conversation
nodes: MessageNode[]
activePathNodeIds: string[]
assets: ConversationSnapshotAsset[]
```

Imports always create a new conversation. They never overwrite an existing conversation or reuse source node IDs.
