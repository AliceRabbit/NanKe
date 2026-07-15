import path from 'node:path';
import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173';
const artifactRoot = path.resolve('output/playwright');

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  timeout: 60_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      maxDiffPixelRatio: 0.002
    }
  },
  outputDir: path.join(artifactRoot, 'test-results'),
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{testFilePath}/{arg}{ext}',
  reporter: process.env.CI
    ? [['line'], ['html', { outputFolder: path.join(artifactRoot, 'report'), open: 'never' }]]
    : [['list'], ['html', { outputFolder: path.join(artifactRoot, 'report'), open: 'never' }]],
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [
    {
      name: 'desktop-chromium',
      testMatch: /desktop\.visual\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 1440, height: 960 },
        deviceScaleFactor: 1
      }
    },
    {
      name: 'mobile-chromium',
      testMatch: /mobile\.visual\.spec\.ts/,
      use: {
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
        hasTouch: true,
        isMobile: true
      }
    }
  ],
  webServer: {
    command: 'node tests/e2e/start-test-server.mjs',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  }
});
