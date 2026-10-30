import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

/** See https://playwright.dev/docs/test-configuration */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // Every test opens its own page and storage, so tests can spread across all workers.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // On CI: inline annotations plus an HTML report that the workflow uploads.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  expect: {
    // Visual tests: freeze CSS animations and tolerate sub-pixel font noise only.
    toHaveScreenshot: { animations: 'disabled', maxDiffPixelRatio: 0.005 },
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    // Firefox and Safari run every functional and a11y test. Screenshots differ per engine,
    // so of these only mobile Safari, the phone engine furthest from Chrome, keeps baselines.
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1440, height: 900 } },
      testIgnore: /visual\.spec\.ts/,
    },
    {
      name: 'safari',
      use: { ...devices['Desktop Safari'], viewport: { width: 1440, height: 900 } },
      testIgnore: /visual\.spec\.ts/,
    },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
  // Test the production build, as users get it (no dev overlays, minified output).
  webServer: {
    command: 'npm run build-only && npm run preview',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
})
