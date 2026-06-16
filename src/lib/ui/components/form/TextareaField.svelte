<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import type { HTMLTextareaAttributes } from 'svelte/elements';

  type Props = Omit<HTMLTextareaAttributes, 'class' | 'value'> & {
    class?: string;
    controlClass?: string;
    description?: string;
    error?: string;
    label?: string;
    value?: string;
  };

  let {
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
    <span class="text-[12px] font-medium leading-5 text-[var(--nanke-ink-muted)] transition-colors group-focus-within/grid:text-[var(--nanke-accent)]">{label}</span>
  {/if}
  <textarea
    {...rest}
    bind:value
    aria-invalid={error ? 'true' : undefined}
    class={cn(
      'min-h-24 w-full min-w-0 resize-y rounded-[var(--nanke-radius-md)] border border-transparent bg-[var(--nanke-field)] px-3 py-2.5 text-[13px] leading-6 text-[var(--nanke-ink)] shadow-[var(--nanke-shadow-field)] outline-none transition-all duration-300 ease-out',
      'hover:bg-[var(--nanke-field-hover)]',
      'placeholder:text-[var(--nanke-ink-subtle)]',
      'focus:border-[var(--nanke-accent)] focus:bg-[var(--nanke-field)] focus:shadow-[var(--nanke-shadow-field-focus)] focus:ring-2 focus:ring-[var(--nanke-accent-soft)]',
      'disabled:bg-[var(--nanke-field-disabled)] disabled:text-[var(--nanke-ink-subtle)] disabled:opacity-50 disabled:pointer-events-none',
      error && 'border-[var(--nanke-danger)] focus:border-[var(--nanke-danger)] focus:ring-[var(--nanke-danger-soft)]',
      controlClass
    )}
  ></textarea>
  {#if error}
    <span class="text-[12px] text-[var(--nanke-danger)]">{error}</span>
  {:else if description}
    <span class="text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</span>
  {/if}
</label>
