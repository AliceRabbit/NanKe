<script lang="ts">
  import Check from '@lucide/svelte/icons/check';
  import Circle from '@lucide/svelte/icons/circle';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import X from '@lucide/svelte/icons/x';
  import type { AppStatus } from '$lib/ui/state/status';

  type Props = {
    status: AppStatus;
    compact?: boolean;
    ariaLive?: 'off' | 'polite' | 'assertive';
    className?: string;
  };

  let { status, compact = false, ariaLive, className = '' }: Props = $props();

  let resolvedLive = $derived(ariaLive ?? (status.kind === 'error' ? 'assertive' : 'polite'));
  let accessibleLabel = $derived(status.detail ? `${status.message}。${status.detail}` : status.message);
</script>

<span
  class="status-badge {className}"
  class:compact
  data-kind={status.kind}
  role="status"
  aria-live={resolvedLive}
  aria-atomic="true"
  aria-label={compact ? accessibleLabel : undefined}
  title={status.detail}
>
  <span class="status-icon" aria-hidden="true">
    {#if status.kind === 'loading'}
      <LoaderCircle size={14} strokeWidth={2.2} />
    {:else if status.kind === 'success'}
      <Check size={14} strokeWidth={2.4} />
    {:else if status.kind === 'warning'}
      <CircleAlert size={14} strokeWidth={2.1} />
    {:else if status.kind === 'error'}
      <X size={14} strokeWidth={2.4} />
    {:else}
      <Circle size={8} fill="currentColor" strokeWidth={0} />
    {/if}
  </span>

  {#if !compact}
    <span class="status-message">{status.message}</span>
  {/if}
</span>

<style>
  .status-badge {
    --status-color: var(--nanke-ink-muted);
    --status-background: var(--nanke-surface-muted);
    --status-border: var(--nanke-border-soft);

    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    min-height: 28px;
    align-items: center;
    gap: 7px;
    border: 1px solid var(--status-border);
    border-radius: var(--nanke-radius-full);
    background: var(--status-background);
    color: var(--status-color);
    padding: 4px 10px 4px 7px;
    font-family: var(--nanke-font-sans);
    font-size: 12px;
    font-weight: 700;
    line-height: 1.25;
  }

  .status-badge[data-kind='loading'] {
    --status-color: var(--nanke-ink);
    --status-border: var(--nanke-border);
  }

  .status-badge[data-kind='success'] {
    --status-color: var(--nanke-success);
    --status-background: var(--nanke-success-soft);
    --status-border: color-mix(in srgb, var(--nanke-success) 24%, transparent);
  }

  .status-badge[data-kind='warning'] {
    --status-color: var(--nanke-ink);
    --status-background: var(--nanke-accent-soft);
    --status-border: var(--nanke-border-strong);
  }

  .status-badge[data-kind='error'] {
    --status-color: var(--nanke-danger);
    --status-background: var(--nanke-danger-soft);
    --status-border: color-mix(in srgb, var(--nanke-danger) 24%, transparent);
  }

  .status-badge.compact {
    width: 28px;
    min-width: 28px;
    justify-content: center;
    padding: 0;
  }

  .status-icon {
    display: inline-grid;
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    place-items: center;
  }

  .status-badge[data-kind='loading'] .status-icon :global(svg) {
    animation: status-spin 900ms linear infinite;
  }

  .status-message {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @keyframes status-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .status-badge[data-kind='loading'] .status-icon :global(svg) {
      animation: none;
    }
  }
</style>
