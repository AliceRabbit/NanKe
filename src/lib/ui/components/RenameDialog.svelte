<script lang="ts">
  import { Dialog } from 'bits-ui';
  import Pencil from '@lucide/svelte/icons/pencil';

  type Props = {
    title: string;
    description: string;
    label: string;
    initialValue: string;
    cancelLabel: string;
    confirmLabel: string;
    busy?: boolean;
    status?: string;
    onCancel: () => void;
    onConfirm: (value: string) => void | Promise<void>;
  };

  let {
    title,
    description,
    label,
    initialValue,
    cancelLabel,
    confirmLabel,
    busy = false,
    status = '',
    onCancel,
    onConfirm
  }: Props = $props();

  let open = $state(true);
  let value = $state('');
  let initialized = $state(false);
  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (!open) onCancel();
  });

  $effect(() => {
    if (!initialized) {
      value = initialValue;
      initialized = true;
    }
    if (!input) return;
    input.focus();
    input.select();
  });

  function submit() {
    const nextValue = value.trim();
    if (!nextValue || busy) return;
    void onConfirm(nextValue);
  }
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="rename-overlay" />
    <Dialog.Content class="rename-dialog" onEscapeKeydown={(event) => { if (busy) event.preventDefault(); }}>
      <header>
        <span class="rename-icon"><Pencil size={18} /></span>
        <div>
          <Dialog.Title>{title}</Dialog.Title>
          <Dialog.Description>{description}</Dialog.Description>
        </div>
      </header>

      <form onsubmit={(event) => { event.preventDefault(); submit(); }}>
        <label>
          <span>{label}</span>
          <input bind:this={input} bind:value maxlength="120" disabled={busy} aria-invalid={Boolean(status)} />
        </label>

        {#if status}<small role="alert">{status}</small>{/if}

        <div class="rename-actions">
          <Dialog.Close type="button" disabled={busy}>{cancelLabel}</Dialog.Close>
          <button class="primary" type="submit" disabled={busy || !value.trim()}>{confirmLabel}</button>
        </div>
      </form>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.rename-overlay) {
    position: fixed;
    inset: 0;
    z-index: 112;
    background: var(--nanke-overlay);
    backdrop-filter: blur(5px);
  }

  :global(.rename-dialog) {
    position: fixed;
    top: 50%;
    left: 50%;
    z-index: 113;
    display: grid;
    width: min(460px, calc(100vw - 32px));
    gap: var(--nanke-space-4);
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-lg);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-overlay);
    color: var(--nanke-ink);
    font-family: var(--app-font-family);
    padding: var(--nanke-space-5);
    outline: none;
    transform: translate(-50%, -50%);
  }

  header {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    gap: var(--nanke-space-3);
  }

  header div {
    display: grid;
    gap: 4px;
  }

  header :global(h2),
  header :global(p) {
    margin: 0;
  }

  header :global(h2) {
    font-size: var(--app-text-xl);
    letter-spacing: -0.015em;
  }

  header :global(p) {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-sm);
    line-height: 1.5;
  }

  .rename-icon {
    display: grid;
    place-items: center;
    width: 38px;
    height: 38px;
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-accent-soft);
    color: var(--nanke-ink);
  }

  form,
  label {
    display: grid;
    gap: var(--nanke-space-2);
  }

  label span {
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-sm);
    font-weight: 700;
  }

  input {
    min-height: 44px;
    width: 100%;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-field);
    color: var(--nanke-ink);
    box-shadow: var(--nanke-shadow-field);
    padding: 10px 12px;
    outline: none;
  }

  input:focus-visible {
    border-color: var(--nanke-accent);
    box-shadow: var(--nanke-shadow-field-focus);
  }

  small {
    color: var(--nanke-danger);
    font-size: var(--app-text-xs);
  }

  .rename-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--nanke-space-2);
    margin-top: var(--nanke-space-2);
  }

  .rename-actions :global(button) {
    min-height: 42px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-surface-raised);
    color: var(--nanke-ink);
    font-weight: 700;
  }

  .rename-actions :global(button.primary) {
    border-color: var(--nanke-accent);
    background: var(--nanke-accent);
    color: var(--nanke-accent-ink);
  }

  .rename-actions :global(button:disabled) {
    cursor: not-allowed;
    opacity: 0.48;
  }

  @media (max-width: 560px) {
    :global(.rename-dialog) {
      top: auto;
      right: 10px;
      bottom: 78px;
      left: 10px;
      width: auto;
      padding: var(--nanke-space-4);
      transform: none;
    }
  }
</style>
