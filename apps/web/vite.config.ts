import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://localhost:2020', changeOrigin: true },
      '/health': { target: 'http://localhost:2020', changeOrigin: true },
      '/ready': { target: 'http://localhost:2020', changeOrigin: true },
    },
  },
  build: { sourcemap: true },
});
