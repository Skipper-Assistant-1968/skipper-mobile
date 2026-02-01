/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// Build-time constants injected by Vite
declare const __BUILD_TIMESTAMP__: string
declare const __BUILD_ID__: string
declare const __APP_VERSION__: string

// Global build info
interface Window {
  __SKIPPER_BUILD__: {
    version: string
    buildId: string
    timestamp: string
  }
}
