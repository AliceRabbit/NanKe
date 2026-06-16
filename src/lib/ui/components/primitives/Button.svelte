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
    primary: 'border-transparent bg-[var(--nanke-accent)] text-[var(--nanke-page)] shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_1px_2px_rgba(0,0,0,0.2)] hover:opacity-90 active:scale-[0.98]',
    secondary: 'border-transparent bg-[var(--nanke-surface)] text-[var(--nanke-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-[var(--nanke-border)] hover:bg-[var(--nanke-surface-raised)] active:scale-[0.98]',
    soft: 'border-transparent bg-[var(--nanke-accent-soft)] text-[var(--nanke-ink)] hover:bg-[var(--nanke-surface-muted)] active:scale-[0.98]',
    ghost: 'border-transparent bg-transparent text-[var(--nanke-ink-muted)] hover:bg-[var(--nanke-surface-muted)] hover:text-[var(--nanke-ink)] active:scale-[0.98]',
    danger: 'border-transparent bg-[var(--nanke-danger)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] hover:opacity-90 active:scale-[0.98]'
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
    'inline-flex min-w-0 items-center justify-center gap-2 rounded-[var(--nanke-radius-md)] border font-medium outline-none transition-all duration-300 ease-[var(--nanke-ease-apple)]',
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nanke-page)] focus-visible:ring-[var(--nanke-accent)] disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    sizes[size],
    className
  )}
>
  {@render children?.()}
</button>
