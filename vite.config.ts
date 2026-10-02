import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config.
 * `base` must match the GitHub Pages sub-path (https://<user>.github.io/<repo>/),
 * otherwise the built JS/CSS/image URLs would point at the domain root and 404.
 */
export default defineConfig({
  base: '/travel-planner-prototype/',
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
