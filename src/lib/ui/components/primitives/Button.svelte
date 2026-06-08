<script lang="ts">
  import { cn } from '$lib/ui/cn';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  type ButtonSize = 'sm' | 'md';
  type ButtonVariant = 'danger' | 'ghost' | 'primary' | 'secondary' | 'soft';

  type Props = Omit<HTMLButtonAttributes, 'class'> & {
    children?: Snippet;
    class?: string;
    size?: ButtonSize;
    variant?: ButtonVariant;
  };

  const variants: Record<ButtonVariant, string> = {
    primary: 'border-[var(--nanke-accent)] bg-[var(--nanke-accent)] text-white hover:bg-[var(--nanke-accent-strong)]',
    secondary: 'border-[var(--nanke-border)] bg-[var(--nanke-surface)] text-[var(--nanke-ink)] hover:bg-[var(--nanke-surface-muted)]',
    soft: 'border-[var(--nanke-accent-soft)] bg-[var(--nanke-accent-soft)] text-[var(--nanke-accent-strong)] hover:border-[var(--nanke-accent)]',
    ghost: 'border-transparent bg-transparent text-[var(--nanke-ink-muted)] hover:bg-[var(--nanke-surface-muted)] hover:text-[var(--nanke-ink)]',
    danger: 'border-[#e2b9b2] bg-[var(--nanke-danger-soft)] text-[var(--nanke-danger)] hover:border-[#cf8e84]'
  };

  const sizes: Record<ButtonSize, string> = {
    sm: 'h-8 px-3 text-[12px]',
    md: 'h-10 px-4 text-[13px]'
  };

  let { children, class: className = '', size = 'md', type = 'button', variant = 'secondary', ...rest }: Props = $props();
</script>

<button
  {...rest}
  {type}
  class={cn(
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--nanke-radius-md)] border font-semibold outline-none transition',
    'focus-visible:ring-4 focus-visible:ring-[var(--nanke-focus)] disabled:opacity-50',
    variants[variant],
    sizes[size],
    className
  )}
>
  {@render children?.()}
</button>
