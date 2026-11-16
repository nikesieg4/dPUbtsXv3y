import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SUPABASE_URL } from './src/config.js';

/* Content-Security-Policy nur im fertigen Build: Der Entwicklungsserver
   braucht Inline-Skripte, die eine strenge CSP blockieren würde. */
function cspPlugin() {
  const host = new URL(SUPABASE_URL).host;
  const base = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  /* Konsole: nichts Fremdes. */
  const konsole = [...base, "img-src 'self' data: blob:", `connect-src 'self' https://${host} wss://${host}`].join('; ');
  /* Spieleportal: darf fremde https-Seiten in Rahmen laden (die Spiele) und fremde
     Vorschaubilder zeigen – eigene Skripte und Verbindungen bleiben eingeschränkt. */
  const spiele = [...base, "img-src 'self' data: https:", `connect-src 'self' https://${host}`, 'frame-src https:'].join('; ');
  return {
    name: 'abis-csp',
    apply: 'build',
    transformIndexHtml(html, ctx) {
      const csp = /(^|\/)spiele\//.test(ctx.path || '') ? spiele : konsole;
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  };
}

export default defineConfig({
  base: './',            // relative Pfade: läuft unter https://<name>.github.io/<repo>/
  plugins: [react(), cspPlugin()],
  build: {
    sourcemap: false, chunkSizeWarningLimit: 900,
    rollupOptions: { input: { main: 'index.html', spiele: 'spiele/index.html' } },   // Konsole + Spieleportal
  },
});
