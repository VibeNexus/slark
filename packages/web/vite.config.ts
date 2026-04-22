import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwind()],
  server: {
    port: 4178,
    // strict：如果 4178 被占用直接报错，不自动切到其他端口（避免撞 server 的 4179）
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4179',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://127.0.0.1:4179',
        ws: true,
      },
    },
  },
});
