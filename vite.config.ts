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
      manifest: false, // servi depuis public/manifest.json (lié dans index.html)
      // injectManifest : service worker CUSTOM (src/sw.ts) — indispensable pour
      // gérer les événements push/notificationclick, impossibles avec generateSW.
      // Le pré-cache Workbox est conservé à l'identique.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
