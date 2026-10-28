import { cloudflare } from '@cloudflare/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // cloudflare() builds the output `cf deploy` uploads; settings live in cloudflare.config.ts.
  plugins: [react(), cloudflare()],
})
