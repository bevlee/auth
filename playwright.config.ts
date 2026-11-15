import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/browser',
	fullyParallel: true,
	workers: 4,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: 'list',
	use: {
		baseURL: 'http://127.0.0.1:4179',
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm dev --host 127.0.0.1 --port 4179 --strictPort',
		url: 'http://127.0.0.1:4179/login',
		reuseExistingServer: false,
		env: {
			BETTER_AUTH_URL: 'http://127.0.0.1:4179',
			BETTER_AUTH_SECRET: 'profile-browser-test-secret-not-for-deployment',
			ORIGIN: 'http://127.0.0.1:4179',
			RESEND_KEY: 're_browser_test_placeholder',
			AUTH_EMAIL: 'auth@example.invalid',
			GOOGLE_CLIENT_ID: 'browser-test-placeholder',
			GOOGLE_CLIENT_SECRET: 'browser-test-placeholder',
			COOKIE_DOMAIN: ''
		}
	}
});
