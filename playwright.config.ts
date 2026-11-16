import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e',timeout:30000,fullyParallel:false,workers:1,
 use:{baseURL:'http://127.0.0.1:4317',trace:'off',video:'off',screenshot:'off'},
 projects:[{name:'chromium',use:{...devices['Desktop Chrome']}},{name:'firefox',use:{...devices['Desktop Firefox']}},{name:'webkit',use:{...devices['Desktop Safari']}},{name:'mobile',use:{...devices['Pixel 7']}}],
});

