<script lang="ts">
  import { Tooltip } from 'bits-ui';
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    active?: boolean;
    kind?: 'core' | 'secondary' | 'more';
    expanded?: boolean;
    children: Snippet;
    onActivate: () => void | Promise<void>;
  };

  let { label, active = false, kind = 'core', expanded, children, onActivate }: Props = $props();
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        class="rail-button rail-{kind}"
        class:active
        type="button"
        aria-label={label}
        aria-pressed={active}
        aria-expanded={expanded}
        onclick={() => void onActivate()}
      >
        {@render children()}
        <span class="rail-label">{label}</span>
      </button>
    {/snippet}
  </Tooltip.Trigger>
  <Tooltip.Portal>
    <Tooltip.Content class="rail-tooltip" side="right" sideOffset={14}>
      {label}
      <Tooltip.Arrow class="rail-tooltip-arrow" />
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>

<style>
  :global(.rail-button) {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border: 1px solid transparent;
    border-radius: var(--nanke-radius-sm);
    background: transparent;
    color: var(--nanke-ink-muted);
    transition:
      transform var(--nanke-duration-fast) var(--nanke-ease-standard),
      border-color var(--nanke-duration) var(--nanke-ease-standard),
      background-color var(--nanke-duration) var(--nanke-ease-standard),
      color var(--nanke-duration) var(--nanke-ease-standard),
      box-shadow var(--nanke-duration) var(--nanke-ease-standard);
  }

  :global(.rail-button:hover),
  :global(.rail-button.active) {
    border-color: var(--nanke-border);
    background: var(--nanke-surface-raised);
    box-shadow: var(--nanke-shadow-field);
    color: var(--nanke-ink);
  }

  :global(.rail-button:hover) {
    transform: translateY(-1px);
  }

  :global(.rail-button.active::before) {
    position: absolute;
    left: -11px;
    width: 3px;
    height: 18px;
    border-radius: var(--nanke-radius-full);
    background: var(--nanke-accent);
    content: '';
  }

  :global(.rail-more) {
    display: none;
  }

  .rail-label {
    display: none;
  }

  :global(.rail-tooltip) {
    z-index: 150;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-accent);
    box-shadow: var(--nanke-shadow-popover);
    color: var(--nanke-accent-ink);
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  :global(.rail-tooltip-arrow) {
    fill: var(--nanke-accent);
  }

  @media (max-width: 860px) {
    :global(.rail-secondary) {
      display: none;
    }

    :global(.rail-more) {
      display: inline-flex;
    }

    :global(.rail-core),
    :global(.rail-more) {
      width: 100%;
      height: 56px;
      flex-direction: column;
      gap: 3px;
      border: 0;
      border-radius: var(--nanke-radius-sm);
      background: transparent;
      box-shadow: none;
      font-size: 10px;
      transform: none;
    }

    :global(.rail-button.active) {
      background: var(--nanke-accent-soft);
      color: var(--nanke-ink);
    }

    :global(.rail-button.active::before) {
      inset: 0 auto auto 50%;
      width: 18px;
      height: 3px;
      transform: translateX(-50%);
    }

    .rail-label {
      display: block;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    :global(.rail-tooltip) {
      display: none;
    }
  }
</style>
