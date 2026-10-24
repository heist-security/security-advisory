import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: "http://127.0.0.1:3039",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node --import tsx tests/browser/fixture-server.ts",
      url: "http://127.0.0.1:3038/rest/v1/events",
    },
    {
      command: "npm run start -- --hostname 127.0.0.1 --port 3039",
      url: "http://127.0.0.1:3039",
      env: {
        SUPABASE_URL: "http://127.0.0.1:3038",
        SUPABASE_SERVICE_ROLE_KEY: "browser-test-placeholder",
        PUBLIC_BASE_URL: "http://127.0.0.1:3039",
        CRON_SECRET: "browser-test-placeholder",
        OPENAI_API_KEY: "",
        OPENAI_MODEL: ""
      },
    }
  ],
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "mobile", use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
});
