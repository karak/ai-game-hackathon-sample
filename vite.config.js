import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  base: './',
  server: { port: 5173, host: '127.0.0.1' },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: { main: resolve(__dirname, 'index.html'), catalog: resolve(__dirname, 'catalog.html') },
    },
  },
  test: {
    include: ['test/**/*.test.js'],
    environment: 'node',
  },
});
