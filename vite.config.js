import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Use relative paths for GitHub Pages compatibility
  base: './',

  // Source files are in src/
  root: 'src',

  build: {
    // Output to docs/ for GitHub Pages
    outDir: '../docs',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        confirmed: resolve(__dirname, 'src/confirmed.html'),
        subscribed: resolve(__dirname, 'src/subscribed.html'),
      },
    },
  },
});
