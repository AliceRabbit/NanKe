import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  optimizeDeps: {
    entries: ['src/routes/**/*.svelte', 'src/lib/ui/components/**/*.svelte', 'src/lib/ui/features/**/*.svelte']
  },
  server: {
    warmup: {
      clientFiles: ['./src/routes/**/*.svelte', './src/lib/ui/components/**/*.svelte', './src/lib/ui/features/**/*.svelte'],
      ssrFiles: ['./src/routes/+layout.svelte', './src/routes/+page.server.ts', './src/routes/+page.svelte']
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
