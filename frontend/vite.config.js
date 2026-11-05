import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    // Topologia de dev da plataforma: saga :8000, sgoa :3000/:5173, sgrf :3001/:5174,
    // SGTU :3003/:5175. :3002 está reservada pelo scripts/acceptance-gate.py.
    port: Number(process.env.VITE_PORT || 5175),
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET || 'http://localhost:3003',
        changeOrigin: true,
      },
    },
  },
});
