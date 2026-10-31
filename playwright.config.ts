import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests run against the production build (vite build + vite preview), not
 * the dev server: what ships is static files, and the dev server's module loading
 * and hot reload are not what a reader gets.
 *
 * Under Tilt the "prod" resource is already serving it, and is reused. Run alone
 * (or in CI), Playwright builds and serves it itself.
 */
const PORT = 4180;
const baseURL = process.env.WORKSHOP_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  // Playwright's default is half the cores: 14 WebKit instances on this machine, which
  // starved each other (clicks timed out waiting for a stable page) while the rest of
  // the Tilt loop ran. Four is fast and steady here; CI runners have two cores.
  workers: process.env.CI ? 2 : 4,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  // The workshop is made for an iPad, so most projects run WebKit, the engine iPad
  // Safari uses; Chromium covers the laptop.
  projects: [
    { name: 'ipad-landscape', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'ipad-portrait', use: { ...devices['iPad Pro 11'] } },
    { name: 'phone', use: { ...devices['iPhone 13'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1366, height: 860 } } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
