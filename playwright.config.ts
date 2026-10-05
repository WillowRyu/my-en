import { defineConfig } from '@playwright/test'
export default defineConfig({
  testDir: './tests', timeout: 60000, expect: { timeout: 15000 }, fullyParallel: true,
  workers: 2, retries: 0, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:4186', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-desktop', use: { browserName: 'chromium', viewport: { width: 1365, height: 1000 } } },
    { name: 'chromium-mobile', use: { browserName: 'chromium', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'webkit-desktop', use: { browserName: 'webkit', viewport: { width: 1365, height: 1000 } } },
    { name: 'webkit-mobile', use: { browserName: 'webkit', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: { command: 'npm run preview', url: 'http://127.0.0.1:4186', reuseExistingServer: false, timeout: 20000 },
})
