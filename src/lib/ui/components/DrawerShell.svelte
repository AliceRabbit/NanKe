<script lang="ts">
  import { Dialog } from 'bits-ui';
  import X from '@lucide/svelte/icons/x';
  import type { Snippet } from 'svelte';

  type Props = {
    title: string;
    closeLabel: string;
    side?: 'left' | 'right';
    size?: 'compact' | 'medium' | 'wide' | 'large' | 'full';
    showOverlay?: boolean;
    trapFocus?: boolean;
    preventScroll?: boolean;
    onClose: () => void;
    children: Snippet;
  };

  let {
    title,
    closeLabel,
    side = 'left',
    size = 'medium',
    showOverlay = true,
    trapFocus = true,
    preventScroll = true,
    onClose,
    children
  }: Props = $props();
  let open = $state(true);

  function handleOpenChangeComplete(nextOpen: boolean) {
    if (!nextOpen) onClose();
  }
</script>

<Dialog.Root bind:open onOpenChangeComplete={handleOpenChangeComplete}>
  <Dialog.Portal>
    {#if showOverlay}
      <Dialog.Overlay class="drawer-shell-overlay" />
    {/if}
    <Dialog.Content
      class="nanke-app-scope drawer-shell"
      data-side={side}
      data-size={size}
      data-testid="drawer-shell"
      {trapFocus}
      {preventScroll}
    >
      <header class="drawer-shell-header">
        <Dialog.Title>{title}</Dialog.Title>
        <Dialog.Close class="drawer-shell-close" aria-label={closeLabel} title={closeLabel}>
          <X size={18} />
        </Dialog.Close>
      </header>

      <div class="drawer-shell-body">
        {@render children()}
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.drawer-shell-overlay) {
    position: fixed;
    inset: 0 0 0 72px;
    z-index: 90;
    background: var(--nanke-overlay);
    backdrop-filter: blur(3px);
    opacity: 1;
    transition: opacity var(--nanke-duration) var(--nanke-ease-standard);
  }

  :global(.drawer-shell-overlay[data-starting-style]),
  :global(.drawer-shell-overlay[data-ending-style]) {
    opacity: 0;
  }

  :global(.drawer-shell) {
    position: fixed;
    top: 12px;
    bottom: 12px;
    z-index: 91;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    overflow: hidden;
    width: min(400px, calc(100vw - 108px));
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-lg);
    background: var(--nanke-surface-acrylic);
    box-shadow: var(--nanke-shadow-overlay);
    color: var(--nanke-ink);
    font-family: var(--app-font-family);
    font-size: var(--app-ui-font-size);
    font-weight: var(--app-font-weight);
    outline: none;
    backdrop-filter: blur(26px) saturate(140%);
    opacity: 1;
    transition:
      opacity var(--nanke-duration) var(--nanke-ease-standard),
      transform var(--nanke-duration-slow) var(--nanke-spring);
  }

  :global(.drawer-shell[data-side='left']) {
    left: 84px;
  }

  :global(.drawer-shell[data-side='right']) {
    right: 12px;
  }

  :global(.drawer-shell[data-side='right'][data-size='medium']) {
    width: min(452px, calc(100vw - 108px));
  }

  :global(.drawer-shell[data-size='compact']) {
    width: min(360px, calc(100vw - 108px));
  }

  :global(.drawer-shell[data-size='wide']) {
    width: min(740px, calc(100vw - 108px));
  }

  :global(.drawer-shell[data-size='large']) {
    width: min(940px, calc(100vw - 108px));
  }

  :global(.drawer-shell[data-size='full']) {
    width: min(1080px, calc(100vw - 108px));
  }

  :global(.drawer-shell[data-side='left'][data-starting-style]),
  :global(.drawer-shell[data-side='left'][data-ending-style]) {
    opacity: 0;
    transform: translateX(-18px) scale(0.992);
  }

  :global(.drawer-shell[data-side='right'][data-starting-style]),
  :global(.drawer-shell[data-side='right'][data-ending-style]) {
    opacity: 0;
    transform: translateX(18px) scale(0.992);
  }

  .drawer-shell-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 68px;
    gap: var(--nanke-space-3);
    border-bottom: 1px solid var(--nanke-border-soft);
    background: color-mix(in srgb, var(--nanke-surface-raised) 64%, transparent);
    padding: 12px 18px;
    backdrop-filter: blur(18px);
  }

  .drawer-shell-header :global(h2) {
    margin: 0;
    font-family: var(--nanke-font-serif);
    font-size: var(--app-text-3xl);
    letter-spacing: -0.025em;
  }

  :global(.drawer-shell-close) {
    display: inline-grid;
    flex: 0 0 auto;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
    box-shadow: var(--nanke-shadow-field);
    transition:
      transform var(--nanke-duration-fast) var(--nanke-ease-standard),
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      box-shadow var(--nanke-duration) var(--nanke-ease-standard);
  }

  :global(.drawer-shell-close:hover) {
    border-color: var(--nanke-border-strong);
    box-shadow: var(--nanke-shadow-card);
    transform: translateY(-1px);
  }

  .drawer-shell-body {
    min-height: 0;
    overflow: auto;
  }

  @media (max-width: 860px) {
    :global(.drawer-shell-overlay) {
      inset: 0 0 68px;
    }

    :global(.drawer-shell),
    :global(.drawer-shell[data-side='left']),
    :global(.drawer-shell[data-side='right']),
    :global(.drawer-shell[data-size='compact']),
    :global(.drawer-shell[data-size='wide']),
    :global(.drawer-shell[data-size='large']),
    :global(.drawer-shell[data-size='full']) {
      inset: 8px 8px 76px;
      width: auto;
    }
  }

  @media (max-width: 560px) {
    .drawer-shell-header {
      min-height: 58px;
      padding: 9px 12px;
    }

    .drawer-shell-header :global(h2) {
      font-size: var(--app-text-2xl);
    }

    :global(.drawer-shell-close) {
      width: 40px;
      height: 40px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.drawer-shell-overlay),
    :global(.drawer-shell) {
      transition: none;
    }
  }
</style>
