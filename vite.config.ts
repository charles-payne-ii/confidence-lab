import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/confidence-lab/',
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { supabase: ['@supabase/supabase-js'] } } } },
  test: {
    include: ['src/**/*.test.ts'],
  },
})
