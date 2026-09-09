import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';

// 生成スプライト（manifest.json の src = assets/sprites/…）は実行時に URL で読むため Vite のバンドル対象にならない。
// build 後に dist/assets/sprites へそのままコピーする（M7。raw やフォントはコピーしない: フォントは静的 import で同梱される）
const copySprites = () => ({ name: 'copy-sprites', apply: 'build', closeBundle() { cpSync(resolve(__dirname, 'assets/sprites'), resolve(__dirname, 'dist/assets/sprites'), { recursive: true }); } });

export default defineConfig({
  base: './',
  plugins: [copySprites()],
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
