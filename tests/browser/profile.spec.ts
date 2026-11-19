import { expect, test, type Page } from '@playwright/test';

const callbackURL = '/account?source=profile%20tests&tab=security#password';
const email = 'profile-test@example.invalid';
const password = 'TemporaryPassword123!';
const withDestination = (path: string, to: string) => `${path}?callbackURL=${encodeURIComponent(to)}`;
/** Signup sends verification links via /verify-email, which forwards to the destination. */
const sentCallback = (kind: 'login' | 'signup', to: string) =>
	kind === 'signup' ? withDestination('/verify-email', to) : to;
let signedIn = false;
const sessionBody = () => ({
	session: { id: 's', userId: 'test-user', token: 't', expiresAt: new Date(Date.now() + 86_400_000).toISOString() },
	user: { id: 'test-user', name: 'Profile Tester', email, emailVerified: true }
});

type AuthScenario =
	| { kind: 'login'; path: '/login'; endpoint: '/sign-in/email'; submit: 'Login' }
	| { kind: 'signup'; path: '/signup'; endpoint: '/sign-up/email'; submit: 'Create Account' };

const authScenarios: AuthScenario[] = [
	{ kind: 'login', path: '/login', endpoint: '/sign-in/email', submit: 'Login' },
	{ kind: 'signup', path: '/signup', endpoint: '/sign-up/email', submit: 'Create Account' }
];

test.beforeEach(async ({ page }) => {
	signedIn = false;
	await page.route('**/api/auth/**', async (route) => {
		if (new URL(route.request().url()).pathname === '/api/auth/get-session') {
			await route.fulfill({ json: signedIn ? sessionBody() : null });
			return;
		}
		throw new Error(`Unexpected auth request: ${route.request().method()} ${route.request().url()}`);
	});
});

async function fillAuthForm(page: Page, scenario: AuthScenario) {
	if (scenario.kind === 'signup') await page.getByLabel('Name', { exact: true }).fill('Profile Tester');
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	if (scenario.kind === 'signup') await page.getByLabel('Confirm Password', { exact: true }).fill(password);
}

test('login submits an existing short password unchanged', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Password', { exact: true }).fill('short');
	await page.route('**/api/auth/sign-in/email', route => route.fulfill({
		status: 401, json: { message: 'Test credentials rejected' }
	}));
	const request = page.waitForRequest('**/api/auth/sign-in/email');
	await page.getByRole('button', { name: 'Login', exact: true }).click();
	expect((await request).postDataJSON()).toEqual({ email, password: 'short', callbackURL: '/account' });
	await expect(page.getByText('Test credentials rejected', { exact: true })).toBeVisible();
});

for (const scenario of authScenarios) {
	test(`${scenario.kind} blocks invalid credentials and accepts a valid form`, async ({ page }) => {
		await page.goto(scenario.path);
		const submit = page.getByRole('button', { name: scenario.submit, exact: true });
		await expect(submit).toBeDisabled();
		await fillAuthForm(page, scenario);
		await page.getByLabel('Email', { exact: true }).fill('invalid-email');
		await expect(submit).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill(email);
		await page.getByLabel('Password', { exact: true }).fill('short');
		if (scenario.kind === 'login') await expect(submit).toBeEnabled();
		else await expect(submit).toBeDisabled();
		await page.getByLabel('Password', { exact: true }).fill('');
		await expect(submit).toBeDisabled();
		await page.getByLabel('Password', { exact: true }).fill(password);
		if (scenario.kind === 'signup') {
			await page.getByLabel('Name', { exact: true }).fill('A');
			await expect(submit).toBeDisabled();
			await page.getByLabel('Name', { exact: true }).fill('Profile Tester');
			await page.getByLabel('Confirm Password', { exact: true }).fill('DoesNotMatch123!');
			await expect(submit).toBeDisabled();
			await page.getByLabel('Confirm Password', { exact: true }).fill(password);
		}
		await expect(submit).toBeEnabled();
	});

	test(`${scenario.kind} sends the Account default when this browser context has no callback`, async ({ page }) => {
		await page.goto(scenario.path);
		await fillAuthForm(page, scenario);
		await page.route(`**/api/auth${scenario.endpoint}`, async (route) => {
			await route.fulfill({ status: 400, json: { message: 'Test account rejected' } });
		});
		const request = page.waitForRequest(`**/api/auth${scenario.endpoint}`);
		await page.getByRole('button', { name: scenario.submit, exact: true }).click();
		expect((await request).postDataJSON()).toEqual({
			...(scenario.kind === 'signup' ? { name: 'Profile Tester' } : {}), email, password,
			callbackURL: sentCallback(scenario.kind, '/account')
		});
		await expect(page.getByText('Test account rejected', { exact: true })).toBeVisible();
		await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBeNull();
	});

	test(`${scenario.kind} keeps the callback through reload and an API error, then consumes it on success`, async ({ page }) => {
		await page.goto(`${scenario.path}?callbackURL=${encodeURIComponent(callbackURL)}`);
		await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
		await page.goto(scenario.path);
		await page.reload();
		await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
		await fillAuthForm(page, scenario);
		const errorMessage = scenario.kind === 'login' ? 'Email or password is incorrect' : 'Account already exists';
		let attempt = 0;
		await page.route(`**/api/auth${scenario.endpoint}`, async (route) => {
			attempt++;
			if (attempt === 2) signedIn = true;
			if (attempt === 1) {
				await route.fulfill({ status: 400, json: { code: 'TEST_AUTH_ERROR', message: errorMessage } });
			} else {
				await route.fulfill({ json: {
					user: { id: 'test-user', name: 'Profile Tester', email, emailVerified: false },
					token: 'test-token',
					...(scenario.kind === 'login' ? { redirect: true, url: 'http://127.0.0.1:4179' + callbackURL } : {})
				} });
			}
		});
		const submit = page.getByRole('button', { name: scenario.submit, exact: true });
		const expectedPayload = {
			...(scenario.kind === 'signup' ? { name: 'Profile Tester' } : {}),
			email, password, callbackURL: sentCallback(scenario.kind, callbackURL)
		};
		for (const outcome of ['error', 'success']) {
			const request = page.waitForRequest(`**/api/auth${scenario.endpoint}`);
			await submit.click();
			expect((await request).postDataJSON()).toEqual(expectedPayload);
			if (outcome === 'error') {
				await expect(page.getByText(errorMessage, { exact: true })).toBeVisible();
				await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
			} else {
				if (scenario.kind === 'login') {
					await expect(page).toHaveURL('http://127.0.0.1:4179' + callbackURL);
					await expect(page.getByRole('link', { name: 'Change Password', exact: true })).toBeVisible();
				} else {
					await expect(page).toHaveURL('http://127.0.0.1:4179' + callbackURL);
				}
				await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBeNull();
			}
		}
	});
}

test('callback survives navigation between login, signup, and forgot password', async ({ page }) => {
	await page.goto(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
	await page.getByRole('link', { name: 'Sign up', exact: true }).click();
	await expect(page).toHaveURL(/\/signup\?/);
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
	await page.getByRole('link', { name: 'Sign in', exact: true }).click();
	await page.getByRole('link', { name: 'Forgot your password?', exact: true }).click();
	await expect(page).toHaveURL(/\/request-password-reset\?/);
	await page.reload();
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
	await page.getByRole('link', { name: 'Sign up', exact: true }).click();
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
});

test('a new callback URL replaces a previously saved callback', async ({ page }) => {
	await page.goto('/login?callbackURL=%2Fold-destination');
	await page.goto(`/signup?callbackURL=${encodeURIComponent(callbackURL)}`);
	await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
});

for (const outcome of ['success', 'error']) {
	test(`forgot password shows the ${outcome} outcome after submitting a valid email`, async ({ page }) => {
		await page.goto(`/login?callbackURL=${encodeURIComponent(callbackURL)}`);
		await page.getByRole('link', { name: 'Forgot your password?', exact: true }).click();
		const submit = page.getByRole('button', { name: 'Send password reset email', exact: true });
		await expect(submit).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill('invalid-email');
		await expect(submit).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill(email);
		await page.route('**/api/auth/request-password-reset', async (route) => {
			await route.fulfill(outcome === 'success'
				? { json: { status: true } }
				: { status: 429, json: { message: 'Too many requests' } });
		});
		const request = page.waitForRequest('**/api/auth/request-password-reset');
		await submit.click();
		expect((await request).postDataJSON()).toEqual({ email, redirectTo: withDestination('/reset-password', callbackURL) });
		await expect(page.getByText(outcome === 'success'
			? 'If an account exists with that email, we have sent a reset link'
			: /couldn't send the reset email \(Too many requests\)/)).toBeVisible();
		if (outcome === 'success') await expect(submit).toHaveCount(0);
		else await expect(submit).toBeEnabled();
		await expect.poll(() => page.evaluate(() => sessionStorage.getItem('redirect_to'))).toBe(callbackURL);
	});
}

for (const url of ['/reset-password', '/reset-password?token=test-token&error=INVALID_TOKEN']) {
	test(`reset password rejects an invalid link ${url}`, async ({ page }) => {
		await page.goto(url);
		await expect(page.getByText(/Invalid Password Reset request/)).toBeVisible();
		await expect(page.getByRole('link', { name: 'Send a new reset link', exact: true })).toHaveAttribute('href', /^\/request-password-reset\?/);
		await expect(page.getByRole('button', { name: 'Change password', exact: true })).toHaveCount(0);
	});
}

for (const outcome of ['success', 'error']) {
	test(`reset password submits its token and displays the ${outcome} outcome`, async ({ page }) => {
		await page.goto('/reset-password?token=reset-test-token');
		const submit = page.getByRole('button', { name: 'Change password', exact: true });
		await expect(submit).toBeDisabled();
		await page.getByLabel('Password', { exact: true }).fill('NewPassword123!');
		await page.getByLabel('Confirm Password', { exact: true }).fill('DifferentPassword123!');
		await expect(submit).toBeDisabled();
		await page.getByLabel('Confirm Password', { exact: true }).fill('NewPassword123!');
		await page.route('**/api/auth/reset-password', async (route) => {
			await route.fulfill(outcome === 'success'
				? { json: { status: true } }
				: { status: 400, json: { message: 'Invalid token' } });
		});
		const request = page.waitForRequest('**/api/auth/reset-password');
		await submit.click();
		expect((await request).postDataJSON()).toEqual({ newPassword: 'NewPassword123!', token: 'reset-test-token' });
		await expect(outcome === 'success'
			? page.getByRole('heading', { name: 'Password updated' })
			: page.getByText('Invalid token', { exact: true })).toBeVisible();
		if (outcome === 'success') {
			await expect(submit).toHaveCount(0);
			await page.getByRole('link', { name: 'Sign in', exact: true }).click();
			await expect(page).toHaveURL(/\/login\?.*reset=success/);
			await expect(page.getByRole('button', { name: 'Login', exact: true })).toBeVisible();
		} else {
			await expect(submit).toBeEnabled();
		}
	});
}

for (const outcome of ['success', 'error']) {
	test(`change password validates the form and displays the ${outcome} outcome`, async ({ page }) => {
		signedIn = true;
		await page.goto('/change-password');
		const current = page.getByLabel('Current Password', { exact: true });
		const next = page.getByLabel('New Password', { exact: true });
		const confirmation = page.getByLabel('Confirm New Password', { exact: true });
		const submit = page.getByRole('button', { name: 'Change Password', exact: true });
		await expect(submit).toBeDisabled();
		await next.fill('NewPassword123!');
		await confirmation.fill('NewPassword123!');
		await expect(submit).toBeDisabled();
		await current.fill('CurrentPassword123!');
		await next.fill('short');
		await confirmation.fill('short');
		await expect(submit).toBeDisabled();
		await next.fill('NewPassword123!');
		await confirmation.fill('DifferentPassword123!');
		await expect(submit).toBeDisabled();
		await confirmation.fill('NewPassword123!');
		await expect(submit).toBeEnabled();
		await page.route('**/api/auth/change-password', async (route) => {
			await route.fulfill(outcome === 'success'
				? { json: { token: 'test-token', user: { id: 'test-user' } } }
				: { status: 400, json: { message: 'Current password is incorrect' } });
		});
		const request = page.waitForRequest('**/api/auth/change-password');
		await submit.click();
		expect((await request).postDataJSON()).toEqual({
			currentPassword: 'CurrentPassword123!', newPassword: 'NewPassword123!', revokeOtherSessions: false
		});
		await expect(page.getByText(outcome === 'success'
			? 'password changed successfully!' : 'Current password is incorrect', { exact: true })).toBeVisible();
		if (outcome === 'success') {
			await expect(current).toHaveValue('');
			await expect(next).toHaveValue('');
			await expect(confirmation).toHaveValue('');
			await expect(submit).toBeDisabled();
		} else {
			await expect(current).toHaveValue('CurrentPassword123!');
			await expect(next).toHaveValue('NewPassword123!');
			await expect(confirmation).toHaveValue('NewPassword123!');
		}
	});
}
