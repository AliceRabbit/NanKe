<script lang="ts">
  import { t } from '$lib/i18n';
  import { Handle, Position, type NodeProps } from '@xyflow/svelte';
  import type { ConversationTreeFlowNodeData } from './types';

  let { data, selected = false }: NodeProps = $props();
  let node = $derived(data as ConversationTreeFlowNodeData);
</script>

<div
  class={`tree-node-card ${node.role}`}
  class:active={node.isActivePath}
  class:leaf={node.isActiveLeaf}
  class:selected
  title={node.preview}
>
  {#if node.role !== 'root'}
    <Handle type="target" position={Position.Top} />
  {/if}
  <div class="node-row">
    <span class="role-dot"></span>
    <strong>{node.label}</strong>
  </div>
  <div class="node-meta">
    <span>{node.meta}</span>
    {#if node.branchCount}
      <span>{t('tree.branches', { count: node.branchCount })}</span>
    {:else if node.childCount}
      <span>{t('tree.next', { count: node.childCount })}</span>
    {/if}
  </div>
  {#if node.preview}
    <div class="node-tooltip">{node.preview}</div>
  {/if}
  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .tree-node-card {
    position: relative;
    display: grid;
    gap: 5px;
    width: 176px;
    min-height: 58px;
    border: 1px solid #d9e1db;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 8px 22px rgba(38, 52, 44, 0.08);
    color: #26362e;
    padding: 9px 10px;
  }

  .tree-node-card.active {
    border-color: #9fc9aa;
    background: #f2faf4;
  }

  .tree-node-card.leaf {
    border-color: #3f8d5a;
    box-shadow:
      inset 4px 0 0 #3f8d5a,
      0 10px 24px rgba(44, 110, 70, 0.14);
  }

  .tree-node-card.selected {
    outline: 2px solid rgba(63, 141, 90, 0.26);
    outline-offset: 2px;
  }

  .node-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .node-row strong,
  .node-meta span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .role-dot {
    width: 9px;
    height: 9px;
    border-radius: 999px;
    background: #7a857e;
  }

  .tree-node-card.user .role-dot {
    background: #328653;
  }

  .tree-node-card.assistant .role-dot {
    background: #4f6fa8;
  }

  .tree-node-card.root .role-dot {
    background: #2f3d35;
  }

  .node-meta {
    display: flex;
    gap: 8px;
    min-width: 0;
    color: #65716a;
    font-size: 11px;
  }

  .node-tooltip {
    position: absolute;
    z-index: 20;
    left: 16px;
    top: calc(100% + 8px);
    display: none;
    width: 280px;
    max-width: 70vw;
    border: 1px solid #dfe5df;
    border-radius: 8px;
    background: #fff;
    box-shadow: 0 16px 42px rgba(27, 39, 32, 0.16);
    color: #344139;
    font-size: 12px;
    line-height: 1.45;
    padding: 10px 12px;
    white-space: normal;
  }

  .tree-node-card:hover .node-tooltip,
  .tree-node-card:focus-within .node-tooltip {
    display: block;
  }

  :global(.svelte-flow__handle) {
    width: 8px;
    height: 8px;
    border-color: #f8faf8;
    background: #6f8175;
  }
</style>
