import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves this app from a subpath (/Wache-2.0/), everything
// else (local dev, a future custom domain) uses the root.
const base = process.env.GITHUB_PAGES ? '/Wache-2.0/' : '/'

// Fortlaufende Build-Nummer (Navi-Fußzeile): die Anzahl der Commits auf
// HEAD. Sie wächst mit jedem Push von selbst weiter und braucht keine
// gepflegte Zählerdatei. Der Deploy-Workflow klont deshalb mit voller
// Historie (fetch-depth: 0) — ein flacher Klon kennt nur einen Commit.
function buildNummer(): string {
  try {
    const anzahl = Number(execSync('git rev-list --count HEAD', { encoding: 'utf8' }).trim())
    return Number.isFinite(anzahl) ? String(anzahl).padStart(3, '0') : '000'
  } catch {
    return '000'
  }
}

// https://vite.dev/config/
export default defineConfig({
  base,
  // Sichtbarer Build-Zeitstempel (z.B. Wachbeginn-Seite): macht auf dem
  // iPad sofort erkennbar, ob noch eine alte PWA-Cache-Version läuft.
  define: {
    __BUILD_STAND__: JSON.stringify(
      new Date().toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Europe/Berlin' }),
    ),
    __APP_VERSION__: JSON.stringify('v 01.1'),
    __BUILD_NR__: JSON.stringify(buildNummer()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Wache 2.0',
        short_name: 'Wache',
        description: 'Live-Einsatzplanung für Lotsen',
        theme_color: '#101b1d',
        background_color: '#101b1d',
        display: 'standalone',
        orientation: 'any',
        start_url: base,
        scope: base,
        icons: [
          { src: `${base}icons/icon-192.png`, sizes: '192x192', type: 'image/png' },
          { src: `${base}icons/icon-512.png`, sizes: '512x512', type: 'image/png' },
          { src: `${base}icons/icon-512-maskable.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
