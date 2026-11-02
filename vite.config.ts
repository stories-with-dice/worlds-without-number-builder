import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

// Serves premium/premium.json (written by `npm run premium`) at /data/premium.json,
// but only on the local dev server. It is never copied into a production build,
// so Deluxe content cannot end up on a public host by accident.
function localPremium(): Plugin {
  const file = path.resolve(__dirname, 'premium/premium.json');
  return {
    name: 'local-premium-data',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/data/premium.json', (_req, res) => {
        if (!fs.existsSync(file)) { res.statusCode = 404; res.end(); return; }
        res.setHeader('Content-Type', 'application/json');
        res.end(fs.readFileSync(file));
      });
    },
  };
}

export default defineConfig({
  // Relative base so the build works on GitHub Pages or any sub-path.
  base: './',
  plugins: [localPremium()],
});
