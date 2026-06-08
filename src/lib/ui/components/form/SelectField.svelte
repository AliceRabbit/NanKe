<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import { ChevronDown } from '@lucide/svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLSelectAttributes } from 'svelte/elements';

  type Props = Omit<HTMLSelectAttributes, 'class' | 'value'> & {
    children?: Snippet;
    class?: string;
    controlClass?: string;
    description?: string;
    error?: string;
    label?: string;
    value?: string;
  };

  let {
    children,
    class: className = '',
    controlClass = '',
    description,
    error,
    label,
    value = $bindable(''),
    ...rest
  }: Props = $props();
</script>

<label class={cn('group/grid grid min-w-0 gap-1.5 text-[13px] text-[var(--nanke-ink)]', className)}>
  {#if label}
    <span class="text-[12px] font-semibold leading-5 text-[var(--nanke-ink-muted)] transition group-focus-within/grid:text-[var(--nanke-accent-strong)]">{label}</span>
  {/if}
  <span class="relative min-w-0">
    <select
      {...rest}
      bind:value
      aria-invalid={error ? 'true' : undefined}
      class={cn(
        'h-10 w-full min-w-0 appearance-none rounded-[var(--nanke-radius-md)] border border-[var(--nanke-border)] bg-[var(--nanke-field)] py-2 pl-3 pr-9 text-[13px] text-[var(--nanke-ink)] shadow-[var(--nanke-shadow-field)] outline-none transition',
        'hover:border-[var(--nanke-border-strong)] hover:bg-[var(--nanke-field-hover)]',
        'focus:border-[var(--nanke-accent)] focus:shadow-[var(--nanke-shadow-field-focus)] focus:ring-4 focus:ring-[var(--nanke-focus)]',
        'disabled:bg-[var(--nanke-field-disabled)] disabled:text-[var(--nanke-ink-subtle)] disabled:opacity-70',
        error && 'border-[var(--nanke-danger)] focus:border-[var(--nanke-danger)] focus:ring-[rgb(163_50_39_/_18%)]',
        controlClass
      )}
    >
      {@render children?.()}
    </select>
    <ChevronDown class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nanke-ink-muted)]" size={16} />
  </span>
  {#if error}
    <span class="text-[12px] text-[var(--nanke-danger)]">{error}</span>
  {:else if description}
    <span class="text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</span>
  {/if}
</label>
