import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// Generate build timestamp for cache busting and version display
const buildTimestamp = new Date().toISOString()
const buildId = buildTimestamp.replace(/[-:T]/g, '').slice(0, 14) // YYYYMMDDHHmmss

export default defineConfig({
  // Inject build-time constants
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp),
    __BUILD_ID__: JSON.stringify(buildId),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '0.1.0'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      workbox: {
        // Don't cache API calls
        navigateFallbackDenylist: [/^\/api/],
        // Force update on any change
        cleanupOutdatedCaches: true,
        // Immediately activate new service worker
        skipWaiting: true,
        clientsClaim: true,
        // Don't precache index.html - let it always fetch fresh
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        // Add runtime caching for HTML with network-first strategy
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/?$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24, // 1 day
              },
              networkTimeoutSeconds: 3,
            },
          },
        ],
      },
      manifest: {
        name: 'Skipper Mobile',
        short_name: 'Skipper',
        description: 'Your AI assistant, in your pocket',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: [
      'localhost',
      'skipper-assistant-1968.tail5697f1.ts.net',
      '.tail5697f1.ts.net'
    ]
  }
})
