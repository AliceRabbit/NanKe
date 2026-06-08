<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'type' | 'value'> & {
    class?: string;
    description?: string;
    label?: string;
    value?: number | string;
    valueLabel?: string;
  };

  let { class: className = '', description, label, value = $bindable(0), valueLabel, ...rest }: Props = $props();
</script>

<label class={cn('grid min-w-0 gap-2 text-[13px] text-[var(--nanke-ink)]', className)}>
  {#if label || valueLabel}
    <span class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
      {#if label}
        <span class="font-semibold text-[var(--nanke-ink)]">{label}</span>
      {/if}
      <output class="tabular-nums text-[12px] font-semibold text-[var(--nanke-ink-muted)]">{valueLabel ?? value}</output>
    </span>
  {/if}
  <input
    {...rest}
    type="range"
    bind:value
    class="h-2 w-full cursor-pointer appearance-none rounded-full bg-[var(--nanke-border)] accent-[var(--nanke-accent)] outline-none transition focus:ring-4 focus:ring-[var(--nanke-focus)] disabled:cursor-not-allowed disabled:opacity-50"
  />
  {#if description}
    <span class="text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</span>
  {/if}
</label>
