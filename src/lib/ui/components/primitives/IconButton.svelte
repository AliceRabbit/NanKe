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
    secondary: 'border-transparent bg-[var(--nanke-surface)] text-[var(--nanke-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.05)] ring-1 ring-inset ring-[var(--nanke-border)] hover:bg-[var(--nanke-surface-raised)] active:scale-[0.95]',
    soft: 'border-transparent bg-[var(--nanke-accent-soft)] text-[var(--nanke-ink)] hover:bg-[var(--nanke-surface-muted)] active:scale-[0.95]',
    ghost: 'border-transparent bg-transparent text-[var(--nanke-ink-muted)] hover:bg-[var(--nanke-surface-muted)] hover:text-[var(--nanke-ink)] active:scale-[0.95]',
    danger: 'border-transparent bg-[var(--nanke-danger)] text-white hover:opacity-90 active:scale-[0.95]'
  };

  let { children, class: className = '', label, type = 'button', variant = 'secondary', ...rest }: Props = $props();
</script>

<button
  {...rest}
  {type}
  aria-label={label}
  title={label}
  class={cn(
    'inline-grid size-10 shrink-0 place-items-center rounded-[var(--nanke-radius-md)] border-transparent outline-none transition-all duration-300 ease-[var(--nanke-ease-apple)]',
    'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--nanke-page)] focus-visible:ring-[var(--nanke-accent)] disabled:opacity-50 disabled:pointer-events-none',
    variants[variant],
    className
  )}
>
  {@render children?.()}
</button>
