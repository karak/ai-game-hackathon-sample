// E2E（ボット自走）。`npm run e2e`。Vite を 5174 で起こし、Chromium headless で window.__game を回す
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 180_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:5174', headless: true, viewport: { width: 900, height: 760 } },
  webServer: { command: 'npx vite --port 5174 --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:5174/index.html', reuseExistingServer: true, timeout: 60_000 },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
