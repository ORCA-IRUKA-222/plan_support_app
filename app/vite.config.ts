import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Capacitor は file:// から index.html を読み込むため相対パスで出力する。
  base: './',
  build: { outDir: 'dist', sourcemap: true },
  server: { port: 5173, host: true },
});
