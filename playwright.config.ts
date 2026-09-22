import { defineConfig } from '@playwright/test';

// Used to run harness-generated test files (results/<run-id>/tests/*.spec.ts),
// via harness/src/lib/run-test-tool.ts and directly with `npx playwright test <path>`.
// storageState comes from harness/src/seed.ts - generated tests assume an
// already-authenticated context and should not write their own login step.
export default defineConfig({
  timeout: 30_000,
  use: {
    baseURL: process.env.TARGET_APP_URL ?? 'http://localhost:8081/',
    storageState: 'harness/.auth/state.json',
    headless: true,
  },
});
