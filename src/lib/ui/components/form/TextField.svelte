<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'value'> & {
    class?: string;
    controlClass?: string;
    description?: string;
    error?: string;
    label?: string;
    value?: string | number;
  };

  let {
    class: className = '',
    controlClass = '',
    description,
    error,
    label,
    type = 'text',
    value = $bindable(''),
    ...rest
  }: Props = $props();
</script>

<label class={cn('grid min-w-0 gap-1.5 text-[13px] text-[var(--nanke-ink)]', className)}>
  {#if label}
    <span class="font-semibold text-[var(--nanke-ink)]">{label}</span>
  {/if}
  <input
    {...rest}
    {type}
    bind:value
    aria-invalid={error ? 'true' : undefined}
    class={cn(
      'h-10 w-full min-w-0 rounded-[var(--nanke-radius-md)] border border-[var(--nanke-border)] bg-[var(--nanke-surface)] px-3 py-2 text-[13px] text-[var(--nanke-ink)] shadow-[var(--nanke-shadow-field)] outline-none transition',
      'placeholder:text-[var(--nanke-ink-subtle)]',
      'focus:border-[var(--nanke-accent)] focus:ring-4 focus:ring-[var(--nanke-focus)]',
      'disabled:bg-[var(--nanke-surface-muted)] disabled:text-[var(--nanke-ink-subtle)] disabled:opacity-70',
      error && 'border-[var(--nanke-danger)] focus:border-[var(--nanke-danger)] focus:ring-[rgb(163_50_39_/_18%)]',
      controlClass
    )}
  />
  {#if error}
    <span class="text-[12px] text-[var(--nanke-danger)]">{error}</span>
  {:else if description}
    <span class="text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</span>
  {/if}
</label>
