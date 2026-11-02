import { defineConfig, devices } from '@playwright/test';

// CI 에서는 로컬 서버(dist)를, 로컬에서는 dist 를 서빙하는 서버를 사용한다.
const useLocalServer = Boolean(process.env.CI || process.env.PW_LOCAL);

export default defineConfig({
  testDir: './tests',
  testMatch: '**/e2e/*.spec.js',
  timeout: 30000,
  expect: { timeout: 5000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never' }]]
    : 'html',
  use: {
    baseURL: useLocalServer ? 'http://localhost:8080' : 'http://localhost:8080',
    trace: 'on-first-retry',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul'
  },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }
  ],
  webServer: useLocalServer
    ? {
        command: 'npm run serve',
        url: 'http://localhost:8080',
        reuseExistingServer: true,
        timeout: 15000
      }
    : undefined
});
