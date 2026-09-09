import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { cpSync } from 'node:fs';

// 生成スプライト（manifest.json の src = assets/sprites/…）は実行時に URL で読むため Vite のバンドル対象にならない。
// build 後に dist/assets/sprites へそのままコピーする（M7。raw やフォントはコピーしない: フォントは静的 import で同梱される）
const copySprites = () => ({ name: 'copy-sprites', apply: 'build', closeBundle() { cpSync(resolve(__dirname, 'assets/sprites'), resolve(__dirname, 'dist/assets/sprites'), { recursive: true }); } });

// ビルド ID（スプライト URL の ?v= に付く。public/_headers で /assets/* を immutable にしているため、内容が変わり得る PNG はデプロイごとに URL を変える）
const BUILD_ID = process.env.BUILD_ID ?? Date.now().toString(36);

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
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
