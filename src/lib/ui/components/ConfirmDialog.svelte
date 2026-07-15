<script lang="ts">
  import { AlertDialog } from 'bits-ui';
  import Trash2 from '@lucide/svelte/icons/trash-2';

  type Props = {
    title: string;
    subject?: string;
    description: string;
    cancelLabel: string;
    confirmLabel: string;
    secondaryLabel?: string;
    busy?: boolean;
    status?: string;
    onCancel: () => void;
    onConfirm: () => void | Promise<void>;
    onSecondary?: () => void | Promise<void>;
  };

  let {
    title,
    subject,
    description,
    cancelLabel,
    confirmLabel,
    secondaryLabel,
    busy = false,
    status = '',
    onCancel,
    onConfirm,
    onSecondary
  }: Props = $props();

  let open = $state(true);

  $effect(() => {
    if (!open) onCancel();
  });
</script>

<AlertDialog.Root bind:open>
  <AlertDialog.Portal>
    <AlertDialog.Overlay class="confirm-overlay" />
    <AlertDialog.Content class="confirm-dialog" onEscapeKeydown={(event) => { if (busy) event.preventDefault(); }}>
      <header>
        <span class="confirm-icon"><Trash2 size={18} /></span>
        <AlertDialog.Title>{title}</AlertDialog.Title>
      </header>

      <AlertDialog.Description class="confirm-description">
        {#if subject}<strong>{subject}</strong>{/if}
        <span>{description}</span>
      </AlertDialog.Description>

      <div class="confirm-actions" class:three={Boolean(secondaryLabel)}>
        <AlertDialog.Cancel type="button" disabled={busy}>{cancelLabel}</AlertDialog.Cancel>
        {#if secondaryLabel && onSecondary}
          <AlertDialog.Action type="button" disabled={busy} onclick={onSecondary}>{secondaryLabel}</AlertDialog.Action>
        {/if}
        <AlertDialog.Action class="danger" type="button" disabled={busy} onclick={onConfirm}>{confirmLabel}</AlertDialog.Action>
      </div>

      {#if status}<small role="alert">{status}</small>{/if}
    </AlertDialog.Content>
  </AlertDialog.Portal>
</AlertDialog.Root>

<style>
  :global(.confirm-overlay) {
    position: fixed;
    inset: 0;
    z-index: 110;
    background: var(--nanke-overlay);
    backdrop-filter: blur(5px);
    opacity: 1;
    transition: opacity var(--nanke-duration) var(--nanke-ease-standard);
  }

  :global(.confirm-overlay[data-starting-style]),
  :global(.confirm-overlay[data-ending-style]) {
    opacity: 0;
  }

  :global(.confirm-dialog) {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 111;
    display: grid;
    width: min(440px, calc(100vw - 32px));
    gap: var(--nanke-space-4);
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-lg);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-overlay);
    color: var(--nanke-ink);
    outline: none;
    padding: var(--nanke-space-5);
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    transition:
      opacity var(--nanke-duration) var(--nanke-ease-standard),
      transform var(--nanke-duration) var(--nanke-spring);
  }

  :global(.confirm-dialog[data-starting-style]),
  :global(.confirm-dialog[data-ending-style]) {
    opacity: 0;
    transform: translate(-50%, calc(-50% + 8px)) scale(0.98);
  }

  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: center;
    gap: var(--nanke-space-3);
  }

  header :global(h2) {
    margin: 0;
    font-size: var(--app-text-xl, 17px);
    letter-spacing: -0.015em;
  }

  .confirm-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-danger-soft);
    color: var(--nanke-danger);
  }

  :global(.confirm-description) {
    display: grid;
    gap: 5px;
    margin: 0;
    border: 1px solid var(--nanke-border-soft);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-muted);
    color: var(--nanke-ink-muted);
    padding: var(--nanke-space-3);
    line-height: 1.55;
  }

  :global(.confirm-description) strong {
    color: var(--nanke-ink);
  }

  .confirm-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--nanke-space-2);
  }

  .confirm-actions.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .confirm-actions :global(button) {
    min-height: 42px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
    box-shadow: var(--nanke-shadow-field);
    padding: 8px 12px;
    font-weight: 700;
    transition:
      transform var(--nanke-duration-fast) var(--nanke-ease-standard),
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      background-color var(--nanke-duration) var(--nanke-ease-standard);
  }

  .confirm-actions :global(button:hover:not(:disabled)) {
    border-color: var(--nanke-border-strong);
    transform: translateY(-1px);
  }

  .confirm-actions :global(button.danger) {
    border-color: var(--nanke-danger);
    background: var(--nanke-danger-soft);
    color: var(--nanke-danger);
    box-shadow: none;
  }

  .confirm-actions :global(button:disabled) {
    cursor: not-allowed;
    opacity: 0.48;
  }

  small {
    color: var(--nanke-danger);
    font-size: var(--app-text-xs, 12px);
  }

  @media (max-width: 560px) {
    :global(.confirm-dialog) {
      top: auto;
      right: 10px;
      bottom: 78px;
      left: 10px;
      width: auto;
      padding: var(--nanke-space-4);
      transform: none;
    }

    :global(.confirm-dialog[data-starting-style]),
    :global(.confirm-dialog[data-ending-style]) {
      transform: translateY(12px) scale(0.98);
    }

    .confirm-actions,
    .confirm-actions.three {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.confirm-overlay),
    :global(.confirm-dialog) {
      transition: none;
    }
  }
</style>
