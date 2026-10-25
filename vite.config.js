import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { SUPABASE_URL } from './src/config.js';

/* Content-Security-Policy nur im fertigen Build: Der Entwicklungsserver
   braucht Inline-Skripte, die eine strenge CSP blockieren würde. */
function cspPlugin() {
  const host = new URL(SUPABASE_URL).host;
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self' https://${host} wss://${host}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
  return {
    name: 'abis-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace('<!--CSP-->', `<meta http-equiv="Content-Security-Policy" content="${csp}">`);
    },
  };
}

export default defineConfig({
  base: './',            // relative Pfade: läuft unter https://<name>.github.io/<repo>/
  plugins: [react(), cspPlugin()],
  build: { sourcemap: false, chunkSizeWarningLimit: 900 },
});
