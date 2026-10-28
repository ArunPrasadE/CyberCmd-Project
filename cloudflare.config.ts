// Cloudflare settings (read by the `cf` CLI). Static site: Vite builds it, Cloudflare serves the files.
import { defineConfig } from 'cf/config'

export default defineConfig({
  worker: {
    name: 'cybercmd',
    compatibilityDate: '2026-10-19',
    // To serve on your own domain, add: domains: ['cybercmd.example.com'],
    observability: { enabled: true },
    assets: {
      notFoundHandling: 'single-page-application',
    },
  },
})
