<script lang="ts">
  import { t } from '$lib/i18n';
  import { GitBranch, LocateFixed, MessageSquare, RefreshCw, Trash2, X } from '@lucide/svelte';
  import {
    Background,
    BackgroundVariant,
    Controls,
    MarkerType,
    MiniMap,
    SvelteFlow,
    type Edge,
    type Node
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import ConversationTreeNode from './ConversationTreeNode.svelte';
  import type { ConversationTreeFlowNodeData, ConversationTreeNode as TreeNode, ConversationTreeSummary } from './types';

  type TreeFlowNode = Node<ConversationTreeFlowNodeData, 'conversationNode'>;
  type TreeFlowEdge = Edge<Record<string, unknown>, 'smoothstep'>;

  const nodeWidth = 220;
  const nodeHeight = 112;
  const nodeTypes = { conversationNode: ConversationTreeNode };

  let {
    summary,
    loading = false,
    actionStatus = '',
    selectedNodeId = '',
    onSelectNode,
    onClose,
    onRefresh,
    onFocusNode,
    onDeleteNode
  }: {
    summary: ConversationTreeSummary | null;
    loading?: boolean;
    actionStatus?: string;
    selectedNodeId?: string;
    onSelectNode?: (nodeId: string) => void;
    onClose?: () => void;
    onRefresh?: () => void;
    onFocusNode?: (node: TreeNode, restoreSubtree: boolean) => void | Promise<void>;
    onDeleteNode?: (node: TreeNode) => void | Promise<void>;
  } = $props();

  let graph = $derived(summary ? buildGraph(summary, selectedNodeId) : { nodes: [], edges: [] });
  let selectedNode = $derived(summary?.nodes.find((node) => node.id === selectedNodeId) ?? summary?.nodes.find((node) => node.isActiveLeaf) ?? null);

  function buildGraph(tree: ConversationTreeSummary, activeSelectionId: string): { nodes: TreeFlowNode[]; edges: TreeFlowEdge[] } {
    const rootId = tree.conversation.rootNodeId ?? 'root';
    const childrenByParent = new Map<string, TreeNode[]>();
    const positioned = new Map<string, { x: number; y: number }>();
    let nextLeaf = 0;

    for (const node of tree.nodes) {
      if (!node.parentId) continue;
      const siblings = childrenByParent.get(node.parentId) ?? [];
      siblings.push(node);
      childrenByParent.set(node.parentId, siblings);
    }

    for (const siblings of childrenByParent.values()) {
      siblings.sort((a, b) => a.siblingOrder - b.siblingOrder || a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    }

    function place(id: string, depth: number): number {
      const children = childrenByParent.get(id) ?? [];
      if (!children.length) {
        const x = nextLeaf++ * nodeWidth;
        positioned.set(id, { x, y: depth * nodeHeight });
        return x;
      }

      const childXs = children.map((child) => place(child.id, Math.max(child.depth, depth + 1)));
      const x = (Math.min(...childXs) + Math.max(...childXs)) / 2;
      positioned.set(id, { x, y: depth * nodeHeight });
      return x;
    }

    place(rootId, 0);

    for (const node of tree.nodes) {
      if (positioned.has(node.id)) continue;
      positioned.set(node.id, { x: nextLeaf++ * nodeWidth, y: Math.max(1, node.depth) * nodeHeight });
    }

    const rootChildren = childrenByParent.get(rootId)?.length ?? 0;
    const flowNodes: TreeFlowNode[] = [
      {
        id: rootId,
        type: 'conversationNode',
        position: positioned.get(rootId) ?? { x: 0, y: 0 },
        draggable: false,
        selectable: false,
        data: {
          label: t('tree.start'),
          role: 'root',
          meta: t('tree.messages', { count: tree.nodes.length }),
          preview: tree.conversation.title,
          childCount: rootChildren,
          branchCount: tree.conversation.branchCount ?? 0,
          isActivePath: false,
          isActiveLeaf: false
        }
      },
      ...tree.nodes.map((node) => ({
        id: node.id,
        type: 'conversationNode' as const,
        position: positioned.get(node.id) ?? { x: 0, y: Math.max(1, node.depth) * nodeHeight },
        draggable: false,
        selected: node.id === activeSelectionId,
        data: {
          label: node.speakerName ?? labelRole(node.role),
          role: node.role,
          meta: t('tree.depth', { depth: node.depth }),
          preview: shortPreview(node.preview),
          childCount: node.childCount,
          branchCount: node.branchCount,
          isActivePath: node.isActivePath,
          isActiveLeaf: node.isActiveLeaf
        }
      }))
    ];

    const knownNodeIds = new Set(flowNodes.map((node) => node.id));
    const edges = tree.nodes
      .filter((node) => node.parentId && knownNodeIds.has(node.parentId))
      .map((node) => ({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId!,
        target: node.id,
        type: 'smoothstep' as const,
        animated: node.isActivePath,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: node.isActivePath ? 'stroke: #3f8d5a; stroke-width: 2px;' : 'stroke: #cbd6ce; stroke-width: 1.5px;'
      }));

    return { nodes: flowNodes, edges };
  }

  function labelRole(role: string) {
    if (role === 'assistant') return t('role.assistant');
    if (role === 'user') return t('role.user');
    if (role === 'system') return t('role.system');
    if (role === 'root') return t('role.root');
    return role;
  }

  function shortPreview(text: string) {
    const compact = text.trim().replace(/\s+/g, ' ');
    return compact.length > 220 ? `${compact.slice(0, 220)}...` : compact;
  }

  function selectedNodeTime(node: TreeNode) {
    return new Date(node.updatedAt).toLocaleString(t('date.locale'), {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function selectNode({ node }: { node: TreeFlowNode }) {
    if (node.data.role === 'root') return;
    onSelectNode?.(node.id);
  }
</script>

<aside class="tree-dock" aria-label={t('tree.title')}>
  <header class="tree-dock-header">
    <div>
      <span><GitBranch size={15} /> {t('tree.title')}</span>
      <strong>{summary?.conversation.title ?? t('common.loading')}</strong>
    </div>
    <div class="tree-dock-actions">
      <button type="button" title={t('tree.refresh')} aria-label={t('tree.refresh')} disabled={loading} onclick={() => onRefresh?.()}>
        <RefreshCw size={15} />
      </button>
      <button type="button" title={t('tree.close')} aria-label={t('tree.close')} onclick={() => onClose?.()}>
        <X size={15} />
      </button>
    </div>
  </header>

  <div class="tree-flow">
    {#if loading}
      <div class="empty-tree">
        <RefreshCw size={22} />
        <span>{t('tree.loading')}</span>
      </div>
    {:else if !summary || summary.nodes.length === 0}
      <div class="empty-tree">
        <MessageSquare size={22} />
        <span>{t('tree.empty')}</span>
      </div>
    {:else}
      <SvelteFlow
        nodes={graph.nodes}
        edges={graph.edges}
        {nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        panOnDrag={true}
        zoomOnScroll={true}
        fitViewOptions={{ padding: 0.18 }}
        proOptions={{ hideAttribution: true }}
        onnodeclick={selectNode}
      >
        <Background variant={BackgroundVariant.Dots} patternColor="#d7dfd7" gap={22} size={1.3} />
        <Controls />
        <MiniMap nodeColor="#8fa597" maskColor="rgba(246, 248, 245, 0.74)" />
      </SvelteFlow>
    {/if}
  </div>

  <section class="node-detail" aria-label={t('tree.selected')}>
    <div class="detail-heading">
      <span><LocateFixed size={15} /> {t('tree.selected')}</span>
      {#if summary}
        <small>{t('tree.nodesBranches', { nodes: summary.nodes.length, branches: summary.conversation.branchCount ?? 0 })}</small>
      {/if}
    </div>

    {#if selectedNode}
      <section class="detail-section">
        <strong>{selectedNode.speakerName ?? labelRole(selectedNode.role)}</strong>
        <small>{labelRole(selectedNode.role)} · {t('tree.depth', { depth: selectedNode.depth })} · {selectedNodeTime(selectedNode)}</small>
        <p>{selectedNode.preview || t('tree.emptyPreview')}</p>
      </section>
      <section class="detail-grid">
        <span>{t('tree.children')} <strong>{selectedNode.childCount}</strong></span>
        <span>{t('tree.branchLabel')} <strong>{selectedNode.branchCount}</strong></span>
        <span>{t('tree.sibling')} <strong>{selectedNode.siblingOrder + 1}</strong></span>
        <span>{t('tree.status')} <strong>{selectedNode.status}</strong></span>
      </section>
      <div class="detail-actions">
        <button type="button" disabled={Boolean(actionStatus)} onclick={() => onFocusNode?.(selectedNode, true)}>
          <LocateFixed size={14} /> {t('tree.focus')}
        </button>
        <button type="button" disabled={Boolean(actionStatus)} onclick={() => onFocusNode?.(selectedNode, false)}>
          <GitBranch size={14} /> {t('tree.continue')}
        </button>
        <button class="danger" type="button" disabled={Boolean(actionStatus)} onclick={() => onDeleteNode?.(selectedNode)}>
          <Trash2 size={14} /> {t('tree.delete')}
        </button>
      </div>
      {#if actionStatus}
        <small class="action-status">{actionStatus}</small>
      {/if}
    {:else}
      <div class="empty-detail">{t('tree.inspectHint')}</div>
    {/if}
  </section>
</aside>

<style>
  :global(.svelte-flow) {
    background: #f8faf7;
  }

  .tree-dock {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-width: 0;
    min-height: 0;
    border-left: 1px solid #dfe6df;
    background: #fbfcfa;
  }

  .tree-dock-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    border-bottom: 1px solid #e3e9e3;
    padding: 11px 12px;
  }

  .tree-dock-header div:first-child {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .tree-dock-header span,
  .detail-heading span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #52645a;
    font-size: var(--app-text-2xs);
    font-weight: 700;
    text-transform: uppercase;
  }

  .tree-dock-header strong {
    overflow: hidden;
    color: #213129;
    font-size: var(--app-text-md);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tree-dock-actions {
    display: flex;
    gap: 5px;
  }

  .tree-dock-actions button {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid #d7dfd7;
    border-radius: 8px;
    background: #fff;
    color: #425249;
    padding: 0;
  }

  .tree-dock-actions button:not(:disabled):hover {
    border-color: #b9cdbf;
    color: #245239;
  }

  .tree-flow {
    min-height: 0;
  }

  .empty-tree,
  .empty-detail {
    display: grid;
    place-items: center;
    gap: 8px;
    height: 100%;
    color: #68766e;
    font-size: var(--app-text-sm);
  }

  .node-detail {
    display: grid;
    gap: 10px;
    border-top: 1px solid #e3e9e3;
    padding: 12px;
  }

  .detail-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .detail-heading small,
  .detail-section small,
  .action-status {
    color: #65736b;
    font-size: var(--app-text-2xs);
  }

  .detail-section {
    display: grid;
    gap: 6px;
    border: 1px solid #dfe6df;
    border-radius: 8px;
    background: #fff;
    padding: 10px;
  }

  .detail-section strong {
    color: #25352d;
    font-size: var(--app-text-md);
  }

  .detail-section p {
    overflow: auto;
    max-height: 18vh;
    margin: 0;
    color: #35443c;
    font-size: var(--app-text-xs);
    line-height: 1.5;
    white-space: pre-wrap;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 7px;
  }

  .detail-grid span {
    display: grid;
    gap: 3px;
    border: 1px solid #e1e8e1;
    border-radius: 8px;
    background: #fff;
    color: #68766e;
    font-size: var(--app-text-2xs);
    padding: 8px;
  }

  .detail-grid strong {
    color: #26372e;
    font-size: var(--app-text-sm);
  }

  .detail-actions {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 6px;
  }

  .detail-actions button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-height: 32px;
    border: 1px solid #cad8ce;
    border-radius: 8px;
    background: #fff;
    color: #2d4a38;
    font-size: var(--app-text-xs);
    font-weight: 700;
  }

  .detail-actions button:not(:disabled):hover {
    border-color: #9fc2aa;
    background: #f1f8f3;
  }

  .detail-actions button.danger {
    border-color: #e7c8c4;
    color: #8f2f28;
  }

  .detail-actions button.danger:not(:disabled):hover {
    border-color: #ddaaa5;
    background: #fff4f3;
  }

  .detail-actions button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
</style>
