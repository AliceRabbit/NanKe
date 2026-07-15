<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
  import CircleStop from '@lucide/svelte/icons/circle-stop';
  import CornerDownRight from '@lucide/svelte/icons/corner-down-right';
  import Eraser from '@lucide/svelte/icons/eraser';
  import Send from '@lucide/svelte/icons/send';
  import Wrench from '@lucide/svelte/icons/wrench';
  import { t } from '$lib/i18n';

  type Props = {
    input?: string;
    isGenerating?: boolean;
    canContinue?: boolean;
    onSend: () => void | Promise<void>;
    onStop: () => void;
    onContinue: () => void | Promise<void>;
    onClear: () => void;
  };

  let {
    input = $bindable(''),
    isGenerating = false,
    canContinue = false,
    onSend,
    onStop,
    onContinue,
    onClear
  }: Props = $props();

  function submit(event: SubmitEvent) {
    event.preventDefault();
    void onSend();
  }
</script>

<form class="composer" onsubmit={submit}>
  <div class="composer-dock">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        class="composer-toolbox-trigger"
        title={t('chat.tools')}
        aria-label={t('chat.tools')}
      >
        <Wrench size={18} />
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          class="composer-menu-popover"
          side="top"
          align="start"
          sideOffset={10}
          loop
          aria-label={t('chat.composerTools')}
        >
          <DropdownMenu.Item
            class="composer-menu-item"
            disabled={!canContinue}
            textValue={t('common.continue')}
            onSelect={() => void onContinue()}
          >
            <CornerDownRight size={16} />
            <span><strong>{t('common.continue')}</strong><small>{t('chat.extendLastReply')}</small></span>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            class="composer-menu-item"
            disabled={!input.trim()}
            textValue={t('chat.clear')}
            onSelect={onClear}
          >
            <Eraser size={16} />
            <span><strong>{t('chat.clear')}</strong><small>{t('chat.discardDraft')}</small></span>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>

    <textarea
      class="composer-input"
      bind:value={input}
      rows="1"
      placeholder={t('chat.messagePlaceholder')}
      aria-label={t('chat.messagePlaceholder')}
    ></textarea>

    <button
      class="composer-action"
      class:stopping={isGenerating}
      type={isGenerating ? 'button' : 'submit'}
      title={isGenerating ? t('chat.stopGeneration') : t('chat.sendMessage')}
      aria-label={isGenerating ? t('chat.stopGeneration') : t('chat.sendMessage')}
      disabled={!isGenerating && !input.trim()}
      onclick={() => isGenerating && onStop()}
    >
      {#if isGenerating}<CircleStop size={20} />{:else}<Send size={20} />{/if}
    </button>
  </div>
</form>

<style>
  .composer {
    z-index: 10;
    grid-column: 1;
    grid-row: 2;
    align-self: end;
    display: flex;
    justify-content: center;
    padding: 8px 24px 20px;
    background: transparent;
    pointer-events: none;
  }

  .composer-dock {
    position: relative;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: end;
    gap: 8px;
    width: min(100%, 900px);
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-lg);
    background: var(--nanke-surface-acrylic);
    box-shadow: var(--nanke-shadow-popover);
    backdrop-filter: blur(22px) saturate(140%);
    padding: 8px;
    pointer-events: auto;
  }

  :global(.composer-toolbox-trigger),
  .composer-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: var(--nanke-radius-sm);
    transition:
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      background-color var(--nanke-duration) var(--nanke-ease-standard),
      color var(--nanke-duration) var(--nanke-ease-standard),
      transform var(--nanke-duration-fast) var(--nanke-ease-standard);
  }

  :global(.composer-toolbox-trigger) {
    border: 1px solid transparent;
    background: transparent;
    color: var(--nanke-ink-muted);
  }

  :global(.composer-toolbox-trigger:hover),
  :global(.composer-toolbox-trigger:focus-visible),
  :global(.composer-toolbox-trigger[data-state='open']) {
    border-color: var(--nanke-border);
    background: var(--nanke-surface-muted);
    color: var(--nanke-ink);
    outline: 0;
  }

  .composer-input {
    appearance: none;
    min-height: 44px;
    max-height: 38vh;
    border: 0 !important;
    border-radius: var(--nanke-radius-sm);
    background: transparent !important;
    box-shadow: none !important;
    color: var(--nanke-ink);
    field-sizing: content;
    font-family: var(--app-chat-font-family);
    font-size: var(--app-chat-font-size);
    line-height: 1.55;
    overflow: auto;
    padding: 10px 6px;
    resize: none;
  }

  .composer-input:focus,
  .composer-input:focus-visible {
    outline: 0 !important;
    box-shadow: none !important;
  }

  .composer-dock:focus-within {
    border-color: var(--nanke-border-strong);
    box-shadow: 0 0 0 3px var(--nanke-focus), var(--nanke-shadow-popover);
  }

  .composer-action {
    border: 1px solid var(--nanke-accent);
    background: var(--nanke-accent);
    color: var(--nanke-accent-ink);
    box-shadow: 0 8px 18px rgb(24 25 24 / 14%);
  }

  .composer-action:hover:not(:disabled),
  .composer-action:focus-visible {
    background: var(--nanke-accent-strong);
    transform: translateY(-1px);
    outline: 0;
  }

  .composer-action:disabled {
    border-color: transparent;
    background: var(--nanke-surface-muted);
    box-shadow: none;
    color: var(--nanke-ink-subtle);
  }

  .composer-action.stopping {
    border-color: var(--nanke-danger);
    background: var(--nanke-danger-soft);
    box-shadow: none;
    color: var(--nanke-danger);
  }

  :global(.composer-menu-popover) {
    z-index: 120;
    display: grid;
    width: 224px;
    gap: 3px;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-md);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-popover);
    color: var(--nanke-ink);
    outline: none;
    padding: 6px;
    opacity: 1;
    transform: translateY(0) scale(1);
    transform-origin: bottom left;
    transition:
      opacity var(--nanke-duration-fast) var(--nanke-ease-standard),
      transform var(--nanke-duration-fast) var(--nanke-spring);
  }

  :global(.composer-menu-popover[data-starting-style]),
  :global(.composer-menu-popover[data-ending-style]) {
    opacity: 0;
    transform: translateY(5px) scale(0.98);
  }

  :global(.composer-menu-item) {
    display: grid;
    grid-template-columns: 20px minmax(0, 1fr);
    align-items: center;
    gap: 9px;
    min-height: 48px;
    border-radius: var(--nanke-radius-sm);
    color: var(--nanke-ink);
    outline: none;
    padding: 7px 9px;
    user-select: none;
  }

  :global(.composer-menu-item[data-highlighted]) {
    background: var(--nanke-surface-muted);
  }

  :global(.composer-menu-item[data-disabled]) {
    opacity: 0.42;
  }

  :global(.composer-menu-item span) {
    display: grid;
    min-width: 0;
    gap: 2px;
  }

  :global(.composer-menu-item strong) {
    font-size: var(--app-text-sm);
  }

  :global(.composer-menu-item small) {
    overflow: hidden;
    color: var(--nanke-ink-muted);
    font-size: var(--app-text-2xs);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 860px) {
    .composer {
      padding: 8px 9px 10px;
    }

    .composer-dock {
      gap: 6px;
      border-radius: var(--nanke-radius-md);
      padding: 6px;
    }

    :global(.composer-menu-popover) {
      width: min(224px, calc(100vw - 32px));
    }
  }
</style>
