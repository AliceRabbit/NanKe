<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import { Eye, EyeOff } from '@lucide/svelte';
  import type { HTMLInputAttributes } from 'svelte/elements';

  type Props = Omit<HTMLInputAttributes, 'class' | 'type' | 'value'> & {
    class?: string;
    controlClass?: string;
    description?: string;
    error?: string;
    label?: string;
    revealLabel?: string;
    value?: string;
  };

  let {
    class: className = '',
    controlClass = '',
    description,
    error,
    label,
    revealLabel = '显示或隐藏密钥',
    value = $bindable(''),
    ...rest
  }: Props = $props();

  let revealed = $state(false);
</script>

<label class={cn('group/grid grid min-w-0 gap-1.5 text-[13px] text-[var(--nanke-ink)]', className)}>
  {#if label}
    <span class="text-[12px] font-semibold leading-5 text-[var(--nanke-ink-muted)] transition group-focus-within/grid:text-[var(--nanke-accent-strong)]">{label}</span>
  {/if}
  <span
    class={cn(
      'grid h-10 grid-cols-[minmax(0,1fr)_auto] overflow-hidden rounded-[var(--nanke-radius-md)] border border-[var(--nanke-border)] bg-[var(--nanke-field)] shadow-[var(--nanke-shadow-field)] transition',
      'hover:border-[var(--nanke-border-strong)] hover:bg-[var(--nanke-field-hover)]',
      'focus-within:border-[var(--nanke-accent)] focus-within:shadow-[var(--nanke-shadow-field-focus)] focus-within:ring-4 focus-within:ring-[var(--nanke-focus)]',
      error && 'border-[var(--nanke-danger)] focus-within:border-[var(--nanke-danger)] focus-within:ring-[rgb(163_50_39_/_18%)]',
      controlClass
    )}
  >
    <input
      {...rest}
      type={revealed ? 'text' : 'password'}
      bind:value
      aria-invalid={error ? 'true' : undefined}
      class="min-w-0 border-0 bg-transparent px-3 py-2 text-[13px] text-[var(--nanke-ink)] shadow-none outline-none placeholder:text-[var(--nanke-ink-subtle)] disabled:text-[var(--nanke-ink-subtle)]"
    />
    <button
      class="grid w-10 place-items-center border-l border-[var(--nanke-border-soft)] bg-[rgb(248_250_247_/_74%)] text-[var(--nanke-ink-muted)] transition hover:bg-[var(--nanke-accent-soft)] hover:text-[var(--nanke-accent-strong)]"
      type="button"
      aria-label={revealLabel}
      onclick={() => (revealed = !revealed)}
    >
      {#if revealed}
        <EyeOff size={16} />
      {:else}
        <Eye size={16} />
      {/if}
    </button>
  </span>
  {#if error}
    <span class="text-[12px] text-[var(--nanke-danger)]">{error}</span>
  {:else if description}
    <span class="text-[12px] leading-5 text-[var(--nanke-ink-muted)]">{description}</span>
  {/if}
</label>
