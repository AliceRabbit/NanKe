<script lang="ts">
  export let variant: 'primary' | 'secondary' | 'ghost' | 'danger' = 'secondary';
  export let size: 'sm' | 'md' | 'lg' = 'md';
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let disabled = false;
  export let full = false;
  export let className = '';
  export let title: string | undefined = undefined;
  export let ariaLabel: string | undefined = undefined;
</script>

<button
  {type}
  {disabled}
  {title}
  aria-label={ariaLabel}
  class="nk-button nk-button--{variant} nk-button--{size} {className}"
  class:nk-button--full={full}
  on:click
>
  <slot />
</button>
