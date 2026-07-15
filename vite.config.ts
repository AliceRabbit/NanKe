import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    warmup: {
      clientFiles: ['./src/routes/+layout.svelte', './src/routes/+page.svelte'],
      ssrFiles: ['./src/routes/+layout.svelte', './src/routes/+page.server.ts', './src/routes/+page.svelte']
    }
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
