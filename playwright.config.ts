import { defineConfig, devices } from '@playwright/test';

const PORT = 8792;

export default defineConfig({
  testDir: 'tests/e2e',
  // Tests share one seeded database, so they run in order on a single worker
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://127.0.0.1:${PORT}`, trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: {
    // Fresh synthetic database on every run; serves the production build from dist/ (run `npm run build` first)
    command: `node -e "require('fs').rmSync('test-results/e2e-data',{recursive:true,force:true})" && node server/index.ts`,
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      NODE_ENV: 'development',
      PORT: String(PORT),
      PUBLIC_URL: `http://127.0.0.1:${PORT}`,
      DATABASE_PATH: 'test-results/e2e-data/apex.db',
      UPLOAD_DIR: 'test-results/e2e-data/uploads',
      SERVE_STATIC: 'true',
      DEMO_MODE: 'true',
      PAYMENT_PROVIDER: 'simulator',
      QR_SIGNING_SECRET: 'e2e-only-secret-not-for-production-use-0123456789',
    },
  },
});
