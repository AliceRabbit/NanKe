<script lang="ts">
  import '../app.css';
  import { Tooltip } from 'bits-ui';

  let { children } = $props();
</script>

<Tooltip.Provider delayDuration={350} skipDelayDuration={120}>
  {@render children()}
</Tooltip.Provider>
