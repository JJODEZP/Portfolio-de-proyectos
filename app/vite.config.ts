import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Base relativa + HashRouter: el build funciona en cualquier subcarpeta de GitHub Pages.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../dashboard', emptyOutDir: true },
});
