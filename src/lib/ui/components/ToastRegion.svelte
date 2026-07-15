<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Portal } from 'bits-ui';
  import Check from '@lucide/svelte/icons/check';
  import Circle from '@lucide/svelte/icons/circle';
  import CircleAlert from '@lucide/svelte/icons/circle-alert';
  import LoaderCircle from '@lucide/svelte/icons/loader-circle';
  import X from '@lucide/svelte/icons/x';
  import type { AppToast, ToastDismissReason } from '$lib/ui/state/status';

  type Props = {
    toasts: readonly AppToast[];
    onDismiss: (id: string, reason: ToastDismissReason) => void;
    ariaLabel?: string;
    dismissLabel?: string;
    position?: 'top-right' | 'bottom-right' | 'bottom-center';
  };

  let {
    toasts,
    onDismiss,
    ariaLabel = '通知',
    dismissLabel = '关闭通知',
    position = 'bottom-right'
  }: Props = $props();

  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearTimer(id: string) {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
  }

  function dismiss(toast: AppToast, reason: ToastDismissReason) {
    clearTimer(toast.id);
    onDismiss(toast.id, reason);
  }

  $effect(() => {
    const activeIds = new Set(toasts.map((toast) => toast.id));

    for (const id of timers.keys()) {
      if (!activeIds.has(id)) clearTimer(id);
    }

    for (const toast of toasts) {
      if (toast.duration === null || timers.has(toast.id)) continue;
      timers.set(
        toast.id,
        setTimeout(() => dismiss(toast, 'timeout'), toast.duration)
      );
    }
  });

  onDestroy(() => {
    for (const timer of timers.values()) clearTimeout(timer);
    timers.clear();
  });
</script>

<Portal>
  <section class="toast-region" data-position={position} aria-label={ariaLabel}>
    {#each toasts as toast (toast.id)}
      <article
        class="toast"
        data-kind={toast.kind}
        role={toast.kind === 'error' ? 'alert' : 'status'}
        aria-live={toast.kind === 'error' ? 'assertive' : 'polite'}
        aria-atomic="true"
        style:--toast-duration={toast.duration === null ? '0ms' : `${toast.duration}ms`}
      >
        <span class="toast-icon" aria-hidden="true">
          {#if toast.kind === 'loading'}
            <LoaderCircle size={18} strokeWidth={2.1} />
          {:else if toast.kind === 'success'}
            <Check size={18} strokeWidth={2.4} />
          {:else if toast.kind === 'warning'}
            <CircleAlert size={18} strokeWidth={2.1} />
          {:else if toast.kind === 'error'}
            <X size={18} strokeWidth={2.4} />
          {:else}
            <Circle size={9} fill="currentColor" strokeWidth={0} />
          {/if}
        </span>

        <span class="toast-copy">
          {#if toast.title}<strong>{toast.title}</strong>{/if}
          <span>{toast.message}</span>
          {#if toast.detail}<small>{toast.detail}</small>{/if}
        </span>

        {#if toast.dismissible}
          <button type="button" aria-label={dismissLabel} title={dismissLabel} onclick={() => dismiss(toast, 'manual')}>
            <X size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        {/if}

        {#if toast.duration !== null}
          <span class="toast-progress" aria-hidden="true"></span>
        {/if}
      </article>
    {/each}
  </section>
</Portal>

<style>
  .toast-region {
    position: fixed;
    z-index: 180;
    display: flex;
    width: min(390px, calc(100vw - 28px));
    max-height: min(70vh, 680px);
    flex-direction: column;
    gap: var(--nanke-space-2);
    pointer-events: none;
  }

  .toast-region[data-position='top-right'] {
    top: var(--nanke-space-4);
    right: var(--nanke-space-4);
  }

  .toast-region[data-position='bottom-right'] {
    right: var(--nanke-space-4);
    bottom: var(--nanke-space-4);
  }

  .toast-region[data-position='bottom-center'] {
    bottom: var(--nanke-space-4);
    left: 50%;
    transform: translateX(-50%);
  }

  .toast {
    --toast-color: var(--nanke-ink-muted);
    --toast-icon-background: var(--nanke-surface-muted);
    --toast-accent: var(--nanke-border-strong);

    position: relative;
    display: grid;
    overflow: hidden;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: start;
    gap: var(--nanke-space-3);
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-popover);
    color: var(--nanke-ink);
    padding: var(--nanke-space-3);
    pointer-events: auto;
    animation: toast-enter var(--nanke-duration-slow) var(--nanke-spring) both;
  }

  .toast[data-kind='loading'] {
    --toast-color: var(--nanke-ink);
    --toast-icon-background: var(--nanke-accent-soft);
    --toast-accent: var(--nanke-ink-muted);
  }

  .toast[data-kind='success'] {
    --toast-color: var(--nanke-success);
    --toast-icon-background: var(--nanke-success-soft);
    --toast-accent: var(--nanke-success);
  }

  .toast[data-kind='warning'] {
    --toast-color: var(--nanke-ink);
    --toast-icon-background: var(--nanke-accent-soft);
    --toast-accent: var(--nanke-ink);
  }

  .toast[data-kind='error'] {
    --toast-color: var(--nanke-danger);
    --toast-icon-background: var(--nanke-danger-soft);
    --toast-accent: var(--nanke-danger);
  }

  .toast-icon {
    display: grid;
    width: 34px;
    height: 34px;
    place-items: center;
    border-radius: var(--nanke-radius-sm);
    background: var(--toast-icon-background);
    color: var(--toast-color);
  }

  .toast[data-kind='loading'] .toast-icon :global(svg) {
    animation: toast-spin 900ms linear infinite;
  }

  .toast-copy {
    display: grid;
    min-width: 0;
    gap: 3px;
    padding-block: 1px;
    font-family: var(--nanke-font-sans);
    font-size: 13px;
    line-height: 1.42;
  }

  .toast-copy strong {
    font-size: 13px;
    font-weight: 800;
    letter-spacing: -0.01em;
  }

  .toast-copy > span {
    overflow-wrap: anywhere;
  }

  .toast-copy small {
    color: var(--nanke-ink-muted);
    font-size: 12px;
    line-height: 1.45;
  }

  button {
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    border: 0;
    border-radius: var(--nanke-radius-sm);
    background: transparent;
    color: var(--nanke-ink-muted);
    cursor: pointer;
    transition:
      background-color var(--nanke-duration-fast) var(--nanke-ease-standard),
      color var(--nanke-duration-fast) var(--nanke-ease-standard);
  }

  button:hover {
    background: var(--nanke-accent-soft);
    color: var(--nanke-ink);
  }

  button:focus-visible {
    outline: 2px solid var(--nanke-accent);
    outline-offset: 2px;
  }

  .toast-progress {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    height: 2px;
    background: var(--toast-accent);
    opacity: 0.52;
    transform-origin: left;
    animation: toast-progress var(--toast-duration) linear forwards;
  }

  @keyframes toast-enter {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.985);
    }
  }

  @keyframes toast-progress {
    to {
      transform: scaleX(0);
    }
  }

  @keyframes toast-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (max-width: 560px) {
    .toast-region,
    .toast-region[data-position='top-right'],
    .toast-region[data-position='bottom-right'],
    .toast-region[data-position='bottom-center'] {
      right: 12px;
      bottom: 76px;
      left: 12px;
      width: auto;
      transform: none;
    }

    .toast-region[data-position='top-right'] {
      top: 12px;
      bottom: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toast,
    .toast-progress,
    .toast[data-kind='loading'] .toast-icon :global(svg) {
      animation: none;
    }
  }
</style>
