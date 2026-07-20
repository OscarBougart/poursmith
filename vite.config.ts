import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    rollupOptions: {
      output: {
        // Split rarely-changing vendor code into its own chunk so app edits
        // don't bust the (larger, slower) dependency cache on repeat visits.
        manualChunks(id) {
          if (id.includes('/node_modules/@supabase/')) return 'supabase';
          if (id.includes('/node_modules/react')) return 'react';
          return undefined;
        },
      },
    },
  },
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
})
