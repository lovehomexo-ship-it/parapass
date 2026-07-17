import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Horodatage du build, affiché en pied de page : permet d'identifier d'un coup
// d'œil quel bundle un appareil exécute réellement (diagnostic du cache PWA).
const buildVersion = new Date().toISOString().substring(0, 16).replace('T', ' ') + ' UTC';

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(buildVersion),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // served from public/manifest.json
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/parapass\.fr\/v\//,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'verify-offline', expiration: { maxEntries: 1 } },
          },
        ],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
