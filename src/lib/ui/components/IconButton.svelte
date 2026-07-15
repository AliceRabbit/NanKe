<script lang="ts">
  import { Tooltip } from 'bits-ui';

  export let variant: 'default' | 'ghost' = 'default';
  export let size: 'sm' | 'md' = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  export let className = '';
  export let title: string | undefined = undefined;
  export let ariaLabel: string;
</script>

<Tooltip.Root disabled={!title}>
  <Tooltip.Trigger>
    {#snippet child({ props })}
      <button
        {...props}
        {type}
        {disabled}
        aria-label={ariaLabel}
        class="nk-icon-button nk-icon-button--{variant} nk-icon-button--{size} {className}"
        on:click
      >
        <slot />
      </button>
    {/snippet}
  </Tooltip.Trigger>
  {#if title}
    <Tooltip.Portal>
      <Tooltip.Content class="nk-tooltip" side="bottom" sideOffset={8}>
        {title}
        <Tooltip.Arrow class="nk-tooltip-arrow" />
      </Tooltip.Content>
    </Tooltip.Portal>
  {/if}
</Tooltip.Root>

<style>
  .nk-tooltip {
    z-index: 150;
    border: 1px solid var(--nanke-border);
    border-radius: var(--nanke-radius-sm);
    background: var(--nanke-accent);
    box-shadow: var(--nanke-shadow-popover);
    color: var(--nanke-accent-ink);
    padding: 7px 9px;
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
  }

  .nk-tooltip-arrow {
    fill: var(--nanke-accent);
  }
</style>
