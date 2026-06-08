<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type IconButtonVariant = 'danger' | 'ghost' | 'secondary' | 'soft';

  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    children?: Snippet;
    class?: string;
    label: string;
    variant?: IconButtonVariant;
  };

  const variants: Record<IconButtonVariant, string> = {
    secondary: 'border-[var(--nanke-border)] bg-[var(--nanke-surface)] text-[var(--nanke-ink)] hover:bg-[var(--nanke-surface-muted)]',
    soft: 'border-[var(--nanke-accent-soft)] bg-[var(--nanke-accent-soft)] text-[var(--nanke-accent-strong)] hover:border-[var(--nanke-accent)]',
    ghost: 'border-transparent bg-transparent text-[var(--nanke-ink-muted)] hover:bg-[var(--nanke-surface-muted)] hover:text-[var(--nanke-ink)]',
    danger: 'border-[#e2b9b2] bg-[var(--nanke-danger-soft)] text-[var(--nanke-danger)] hover:border-[#cf8e84]'
  };

  let { children, class: className = '', label, type = 'button', variant = 'secondary', ...rest }: Props = $props();
</script>

<button
  {...rest}
  {type}
  aria-label={label}
  title={label}
  class={cn(
    'inline-grid size-10 shrink-0 place-items-center rounded-[var(--nanke-radius-md)] border outline-none transition',
    'focus-visible:ring-4 focus-visible:ring-[var(--nanke-focus)] disabled:opacity-50',
    variants[variant],
    className
  )}
>
  {@render children?.()}
</button>
