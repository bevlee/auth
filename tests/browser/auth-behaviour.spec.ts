/**
 * Auth behaviour table, one test per row.
 *
 * Title format:  <starting state> | <user action> → <expected result>
 *
 * - `test(...)`        rows the app already satisfies.
 * - `test(...)`  rows not built yet. The body describes the expected
 *                      behaviour; delete `.fixme` once the row is implemented.
 *
 * Better Auth's HTTP API is mocked at the browser boundary, so these tests
 * check what the UI sends and what the user sees. Rows that need a real
 * database and a captured email (marked "journey") belong in a separate
 * end-to-end suite and have no body here yet.
 */
import { expect, test, type Page, type Route } from '@playwright/test';

const origin = 'http://127.0.0.1:4179';
const email = 'behaviour-test@example.invalid';
const password = 'TemporaryPassword123!';
const newPassword = 'NewPassword123!';
/** An in-app destination, so redirects stay on the test server. */
const destination = '/account?tab=security';
/** An approved external app destination. */
const appDestination = 'https://tax.bevsoft.com/dashboard';
const defaultDestination = '/account';

const now = new Date().toISOString();
const sessionBody = {
	session: {
		id: 'test-session', userId: 'test-user', token: 'test-token',
		expiresAt: new Date(Date.now() + 86_400_000).toISOString(), createdAt: now, updatedAt: now
	},
	user: {
		id: 'test-user', name: 'Behaviour Tester', email, emailVerified: true,
		image: null, createdAt: now, updatedAt: now
	}
};

const withDestination = (path: string, to = destination) =>
	`${path}?callbackURL=${encodeURIComponent(to)}`;

/** Fail loudly on any auth call a test didn't expect; report signed out by default. */
test.beforeEach(async ({ page }) => {
	await page.route('**/api/auth/**', async (route) => {
		const { pathname } = new URL(route.request().url());
		if (pathname === '/api/auth/get-session') {
			await route.fulfill({ json: null });
			return;
		}
		if (pathname === '/api/auth/list-accounts') {
			await route.fulfill({ json: [{ id: 'acc', providerId: 'credential', accountId: 'test-user', userId: 'test-user' }] });
			return;
		}
		throw new Error(`Unexpected auth request: ${route.request().method()} ${route.request().url()}`);
	});
});

/** Routes registered later take precedence over the catch-all above. */
async function mockEndpoint(page: Page, endpoint: string, respond: (route: Route) => Promise<void>) {
	await page.route(`**/api/auth${endpoint}`, respond);
}

async function signedIn(page: Page) {
	let active = true;
	await mockEndpoint(page, '/get-session', (route) => route.fulfill({ json: active ? sessionBody : null }));
	return { signOut: () => { active = false; } };
}

const storedDestination = (page: Page) => page.evaluate(() => sessionStorage.getItem('redirect_to'));

async function fillLogin(page: Page, pw = password) {
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Password', { exact: true }).fill(pw);
}

async function fillSignup(page: Page) {
	await page.getByLabel('Email', { exact: true }).fill(email);
	await page.getByLabel('Password', { exact: true }).fill(password);
	await page.getByLabel('Confirm password', { exact: true }).fill(password);
}

async function fillReset(page: Page) {
	await page.getByLabel('Password', { exact: true }).fill(newPassword);
	await page.getByLabel('Confirm Password', { exact: true }).fill(newPassword);
}

const loginButton = (page: Page) => page.getByRole('button', { name: 'Sign in', exact: true });
const signupButton = (page: Page) => page.getByRole('button', { name: 'Create account', exact: true });
const sendResetButton = (page: Page) => page.getByRole('button', { name: 'Send password reset email', exact: true });
const resetButton = (page: Page) => page.getByRole('button', { name: 'Change password', exact: true });

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

test.describe('Sign in', () => {
	test('Signed out, arriving from an app | open sign-in → names the app being continued to', async ({ page }) => {
		await page.goto(withDestination('/login', appDestination));
		await expect(page.getByText(/continue to tax\.bevsoft\.com/i)).toBeVisible();
	});

	test('Signed out, arriving from EK | open sign-in → names EK, not its hostname', async ({ page }) => {
		await page.goto(withDestination('/login', 'https://ek.bevsoft.com/?menu=account'));
		await expect(page.getByText('Sign in to continue to EK', { exact: true })).toBeVisible();
		await expect(page.locator('header')).toContainText('for EK');
	});

	test('Signed out, visiting auth directly | sign in → defaults the destination to Account', async ({ page }) => {
		await page.goto('/login');
		await fillLogin(page);
		await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({ status: 401, json: { message: 'stop' } }));
		const request = page.waitForRequest('**/api/auth/sign-in/email');
		await loginButton(page).click();
		expect((await request).postDataJSON()).toMatchObject({ callbackURL: defaultDestination });
	});

	test('Sign-in form | submit valid credentials → redirect to the requested destination', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await fillLogin(page);
		await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({
			json: { redirect: true, url: origin + destination, token: 'test-token', user: sessionBody.user }
		}));
		const request = page.waitForRequest('**/api/auth/sign-in/email');
		await loginButton(page).click();
		expect((await request).postDataJSON()).toEqual({ email, password, callbackURL: destination });
		await expect(page).toHaveURL(origin + destination);
	});

	test('Sign-in form | submit incorrect credentials → error shown, email and destination kept', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await fillLogin(page);
		await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({
			status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }
		}));
		await loginButton(page).click();
		await expect(page.getByText('Invalid email or password', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
		await expect(loginButton(page)).toBeEnabled();
		expect(await storedDestination(page)).toBe(destination);
	});

	test('Sign-in form | submit incorrect credentials → error shown inline in the form, not only as a toast', async ({ page }) => {
		await page.goto('/login');
		await fillLogin(page);
		await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({
			status: 401, json: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'Invalid email or password' }
		}));
		await loginButton(page).click();
		await expect(page.locator('form').getByRole('alert')).toContainText(/invalid email or password/i);
	});

	test('Sign-in form | submit incomplete fields → submit stays disabled, nothing sent', async ({ page }) => {
		await page.goto('/login');
		await expect(loginButton(page)).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill(email);
		await expect(loginButton(page)).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill('');
		await page.getByLabel('Password', { exact: true }).fill(password);
		await expect(loginButton(page)).toBeDisabled();
		await page.getByLabel('Email', { exact: true }).fill('not-an-email');
		await expect(loginButton(page)).toBeDisabled();
	});

	test('Sign-in form | choose Google → Google sign-in receives the destination', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await page.route('**/fake-google', (route) => route.fulfill({ contentType: 'text/html', body: 'Google' }));
		await mockEndpoint(page, '/sign-in/social', (route) => route.fulfill({
			json: { url: origin + '/fake-google', redirect: true }
		}));
		const request = page.waitForRequest('**/api/auth/sign-in/social');
		await page.getByRole('button', { name: 'Continue with Google' }).click();
		expect((await request).postDataJSON()).toMatchObject({ provider: 'google', callbackURL: destination });
	});

	test('Google sign-in | cancel or error → back on sign-in with a retryable message, destination kept', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await mockEndpoint(page, '/sign-in/social', (route) => route.fulfill({ status: 400, json: { message: 'stop' } }));
		const request = page.waitForRequest('**/api/auth/sign-in/social');
		await page.getByRole('button', { name: 'Continue with Google' }).click();
		expect((await request).postDataJSON()).toMatchObject({ errorCallbackURL: expect.stringContaining('/login') });

		await page.goto('/login?error=access_denied');
		await expect(page.getByRole('alert')).toContainText(/google/i);
		await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeEnabled();
		expect(await storedDestination(page)).toBe(destination);
	});

	test('Sign-in form | choose "Create an account" → signup keeps the destination', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await page.getByRole('link', { name: 'Create an account', exact: true }).click();
		await expect(page).toHaveURL(/\/signup/);
		expect(new URL(page.url()).searchParams.get('callbackURL')).toBe(destination);
		expect(await storedDestination(page)).toBe(destination);
	});

	test('Google sign-in | email already has a password account → explains to sign in with the password', async ({ page }) => {
		await page.goto(withDestination('/login') + '&error=account_not_linked');
		await expect(page.getByRole('alert')).toContainText(/already exists\. sign in with your password/i);
	});
});

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

test.describe('Sign up', () => {
	test('Signup form | submit valid details → signed in and sent to the destination', async ({ page }) => {
		let created = false;
		await mockEndpoint(page, '/get-session', (route) => route.fulfill({ json: created ? sessionBody : null }));
		await page.goto(withDestination('/signup'));
		await fillSignup(page);
		await mockEndpoint(page, '/sign-up/email', async (route) => {
			created = true;
			await route.fulfill({ json: { token: 'test-token', user: { ...sessionBody.user, emailVerified: false } } });
		});
		await signupButton(page).click();
		await expect(page).toHaveURL(origin + destination);
	});

	test('Signup form | no name asked → account created with an empty name, no verification callback', async ({ page }) => {
		await page.goto(withDestination('/signup'));
		await expect(page.getByLabel('Name', { exact: true })).toHaveCount(0);
		await fillSignup(page);
		await mockEndpoint(page, '/sign-up/email', (route) => route.fulfill({ status: 400, json: { message: 'stop' } }));
		const request = page.waitForRequest('**/api/auth/sign-up/email');
		await signupButton(page).click();
		expect((await request).postDataJSON()).toEqual({ name: '', email, password });
	});

	test('Signup form | invalid email → field explains the problem', async ({ page }) => {
		await page.goto('/signup');
		await page.getByLabel('Email', { exact: true }).fill('not-an-email');
		await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
		await expect(signupButton(page)).toBeDisabled();
	});

	test('Signup form | mismatched passwords → field explains the mismatch, other fields kept', async ({ page }) => {
		await page.goto('/signup');
		await fillSignup(page);
		await page.getByLabel('Confirm password', { exact: true }).fill('DoesNotMatch123!');
		await expect(page.getByText(/passwords (do not|don't) match/i)).toBeVisible();
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
		await expect(signupButton(page)).toBeDisabled();
	});

	test('Signup request fails | retry → error shown, form still filled and submittable', async ({ page }) => {
		await page.goto('/signup');
		await fillSignup(page);
		await mockEndpoint(page, '/sign-up/email', (route) => route.fulfill({
			status: 422, json: { code: 'USER_ALREADY_EXISTS', message: 'User already exists' }
		}));
		await signupButton(page).click();
		await expect(page.getByText('User already exists', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
		await expect(signupButton(page)).toBeEnabled();
	});

});

// ---------------------------------------------------------------------------
// Forgot / reset password
// ---------------------------------------------------------------------------

test.describe('Password reset', () => {
	test('Sign-in form | choose "Forgot password?" → email prefilled, destination in the URL', async ({ page }) => {
		await page.goto(withDestination('/login'));
		await page.getByLabel('Email', { exact: true }).fill(email);
		await page.getByRole('link', { name: 'Forgot password?', exact: true }).click();
		await expect(page).toHaveURL(/\/request-password-reset/);
		expect(new URL(page.url()).searchParams.get('callbackURL')).toBe(destination);
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
	});

	for (const account of ['existing', 'unknown']) {
		test(`Reset request form | submit an ${account} account's email → same "check your email" message`, async ({ page }) => {
			await page.goto('/request-password-reset');
			await page.getByLabel('Email', { exact: true }).fill(account === 'existing' ? email : 'nobody@example.invalid');
			await mockEndpoint(page, '/request-password-reset', (route) => route.fulfill({ json: { status: true } }));
			await sendResetButton(page).click();
			await expect(page.getByText('If an account exists with that email, we have sent a reset link', { exact: true })).toBeVisible();
		});
	}

	test('Reset request form | email request fails → retryable error, form and email kept', async ({ page }) => {
		await page.goto('/request-password-reset');
		await page.getByLabel('Email', { exact: true }).fill(email);
		await mockEndpoint(page, '/request-password-reset', (route) => route.fulfill({ status: 500, json: { message: 'Email failed' } }));
		await sendResetButton(page).click();
		await expect(page.getByRole('alert')).toBeVisible();
		await expect(page.getByLabel('Email', { exact: true })).toHaveValue(email);
		await expect(sendResetButton(page)).toBeEnabled();
	});

	test('Awaiting reset email | request another link → resend confirmed, back-to-sign-in keeps destination', async ({ page }) => {
		await page.goto(withDestination('/request-password-reset'));
		await page.getByLabel('Email', { exact: true }).fill(email);
		await mockEndpoint(page, '/request-password-reset', (route) => route.fulfill({ json: { status: true } }));
		await sendResetButton(page).click();
		const resend = page.waitForRequest('**/api/auth/request-password-reset');
		await page.getByRole('button', { name: /resend|send again/i }).click();
		await resend;
		await expect(page.getByText(/sent another/i)).toBeVisible();
		const back = page.getByRole('link', { name: /back to sign in/i });
		expect(new URL(await back.getAttribute('href') ?? '', origin).searchParams.get('callbackURL')).toBe(destination);
	});

	test('Reset request form | submit → the emailed link carries the destination', async ({ page }) => {
		await page.goto(withDestination('/request-password-reset'));
		await page.getByLabel('Email', { exact: true }).fill(email);
		await mockEndpoint(page, '/request-password-reset', (route) => route.fulfill({ json: { status: true } }));
		const request = page.waitForRequest('**/api/auth/request-password-reset');
		await sendResetButton(page).click();
		expect((await request).postDataJSON()).toEqual({
			email, redirectTo: withDestination('/reset-password')
		});
	});

	test('Reset email | open valid link in a fresh tab → new-password form shown', async ({ page }) => {
		await page.goto(`/reset-password?token=reset-test-token&callbackURL=${encodeURIComponent(destination)}`);
		await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
		await expect(resetButton(page)).toBeVisible();
	});

	for (const url of ['/reset-password', '/reset-password?token=t&error=INVALID_TOKEN']) {
		test(`Reset email | open invalid link ${url} → explains, links to a new reset request`, async ({ page }) => {
			await page.goto(url);
			await expect(page.getByText(/Invalid Password Reset request/)).toBeVisible();
			await expect(page.locator('a[href^="/request-password-reset"]')).toBeVisible();
			await expect(resetButton(page)).toHaveCount(0);
		});
	}

	test('Reset email | submit on an expired or used link → explains, offers "Send a new reset link"', async ({ page }) => {
		await page.goto('/reset-password?token=used-token');
		await fillReset(page);
		await mockEndpoint(page, '/reset-password', (route) => route.fulfill({
			status: 400, json: { code: 'INVALID_TOKEN', message: 'Invalid token' }
		}));
		await resetButton(page).click();
		await expect(page.getByRole('link', { name: /send a new reset link/i })).toBeVisible();
		await expect(resetButton(page)).toHaveCount(0);
	});

	test('New-password form | weak or mismatched passwords → submit disabled, nothing sent', async ({ page }) => {
		await page.goto('/reset-password?token=reset-test-token');
		await page.getByLabel('Password', { exact: true }).fill('short');
		await page.getByLabel('Confirm Password', { exact: true }).fill('short');
		await expect(resetButton(page)).toBeDisabled();
		await page.getByLabel('Password', { exact: true }).fill(newPassword);
		await page.getByLabel('Confirm Password', { exact: true }).fill('Different123!');
		await expect(resetButton(page)).toBeDisabled();
	});

	test('New-password form | submit valid passwords → "Password updated" with a prominent sign-in action', async ({ page }) => {
		await page.goto('/reset-password?token=reset-test-token');
		await fillReset(page);
		await mockEndpoint(page, '/reset-password', (route) => route.fulfill({ json: { status: true } }));
		await resetButton(page).click();
		await expect(page.getByRole('heading', { name: /password updated/i })).toBeVisible();
		await expect(page.getByRole('main').getByRole('link', { name: /sign in/i })).toBeVisible();
	});

	test('Password updated | choose "Sign in" → sign-in shows the success message and keeps the destination', async ({ page }) => {
		await page.goto(`/reset-password?token=reset-test-token&callbackURL=${encodeURIComponent(destination)}`);
		await fillReset(page);
		await mockEndpoint(page, '/reset-password', (route) => route.fulfill({ json: { status: true } }));
		await resetButton(page).click();
		await page.getByRole('main').getByRole('link', { name: /sign in/i }).click();
		await expect(page).toHaveURL(/\/login/);
		expect(new URL(page.url()).searchParams.get('callbackURL')).toBe(destination);
		await expect(page.getByText(/password updated/i)).toBeVisible();
	});

	test.fixme('Sign-in after reset | submit the new password → continues to the destination (journey)', () => {});
	test.fixme('Sign-in after reset | submit the old password → rejected with a normal sign-in error (journey)', () => {});
});

// ---------------------------------------------------------------------------
// Session-aware pages
// ---------------------------------------------------------------------------

test.describe('Session-aware pages', () => {
	for (const path of ['/login', '/signup']) {
		test(`Signed in | open ${path} → offers to continue as the user or switch account`, async ({ page }) => {
			await signedIn(page);
			await page.goto(path);
			await expect(page.getByText(/continue as behaviour tester/i)).toBeVisible();
			await expect(page.getByRole('button', { name: /(different|switch) account/i })).toBeVisible();
		});
	}

	for (const path of ['/account', '/change-password']) {
		test(`Signed out | open ${path} → redirected to sign-in, page kept as destination`, async ({ page }) => {
			await page.goto(path);
			await expect(page).toHaveURL(/\/login/);
			expect(new URL(page.url()).searchParams.get('callbackURL')).toBe(path);
		});
	}
});

// ---------------------------------------------------------------------------
// Change password (signed in)
// ---------------------------------------------------------------------------

test.describe('Change password', () => {
	async function fillChange(page: Page) {
		await page.getByLabel('Current password', { exact: true }).fill(password);
		await page.getByLabel('New password', { exact: true }).fill(newPassword);
		await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword);
	}
	const changeButton = (page: Page) => page.getByRole('button', { name: 'Update password', exact: true });

	test('Signed in, changing password | wrong current password → error under that field, entries kept', async ({ page }) => {
		await signedIn(page);
		await page.goto('/change-password');
		await fillChange(page);
		await mockEndpoint(page, '/change-password', (route) => route.fulfill({
			status: 400, json: { code: 'INVALID_PASSWORD', message: 'Invalid password' }
		}));
		await changeButton(page).click();
		await expect(page.getByText('Incorrect password', { exact: true })).toBeVisible();
		await expect(page.getByLabel('Current password', { exact: true })).toHaveValue(password);
	});

	test('Signed in, changing password | valid passwords → success confirmed, back on Account', async ({ page }) => {
		await signedIn(page);
		await page.goto('/change-password');
		await fillChange(page);
		await mockEndpoint(page, '/change-password', (route) => route.fulfill({
			json: { token: 'test-token', user: sessionBody.user }
		}));
		await changeButton(page).click();
		await expect(page.getByText('Password updated', { exact: true })).toBeVisible();
		await expect(page).toHaveURL(origin + '/account');
	});

	test('Changing password | submit → other devices stay signed in', async ({ page }) => {
		await signedIn(page);
		await page.goto('/change-password');
		await fillChange(page);
		await mockEndpoint(page, '/change-password', (route) => route.fulfill({
			json: { token: 'test-token', user: sessionBody.user }
		}));
		const request = page.waitForRequest('**/api/auth/change-password');
		await changeButton(page).click();
		expect((await request).postDataJSON()).toMatchObject({ revokeOtherSessions: false });
	});
});

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

test.describe('Sign out', () => {
	test('Signed in | choose "Sign out" → session ended, signed-out header shown', async ({ page }) => {
		const session = await signedIn(page);
		await mockEndpoint(page, '/sign-out', async (route) => {
			session.signOut();
			await route.fulfill({ json: { success: true } });
		});
		await page.goto('/');
		await page.getByRole('button', { name: 'Sign out', exact: true }).click();
		await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
	});

	test('Sign-out fails | choose "Sign out" → error shown, still signed in', async ({ page }) => {
		await signedIn(page);
		await mockEndpoint(page, '/sign-out', (route) => route.fulfill({ status: 500, json: { message: 'Server error' } }));
		await page.goto('/account');
		await page.getByRole('button', { name: 'Sign out', exact: true }).click();
		await expect(page.getByText(/couldn't sign (you )?out|sign out failed/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
	});
});

// ---------------------------------------------------------------------------
// Cross-cutting
// ---------------------------------------------------------------------------

test.describe('Cross-cutting', () => {
	const pendingCases = [
		{ form: 'sign-in', path: '/login', endpoint: '/sign-in/email', fill: fillLogin, button: loginButton, progress: /signing in/i },
		{ form: 'signup', path: '/signup', endpoint: '/sign-up/email', fill: fillSignup, button: signupButton, progress: /creating/i },
		{
			form: 'reset request', path: '/request-password-reset', endpoint: '/request-password-reset',
			fill: (p: Page) => p.getByLabel('Email', { exact: true }).fill(email), button: sendResetButton, progress: /sending/i
		},
		{ form: 'new password', path: '/reset-password?token=t', endpoint: '/reset-password', fill: fillReset, button: resetButton, progress: /updating/i }
	];

	for (const c of pendingCases) {
		test(`Submitting ${c.form} form | submit again while pending → one request, progress shown`, async ({ page }) => {
			await page.goto(c.path);
			await c.fill(page);
			let requests = 0;
			let release!: () => void;
			const held = new Promise<void>((resolve) => { release = resolve; });
			await mockEndpoint(page, c.endpoint, async (route) => {
				requests++;
				await held;
				await route.fulfill({ status: 400, json: { message: 'stop' } });
			});
			const submit = page.locator('form button[type="submit"]');
			await submit.click();
			await expect(submit).toBeDisabled();
			await expect(submit).toHaveText(c.progress);
			await submit.click({ force: true });
			release();
			await expect(submit).toBeEnabled();
			expect(requests).toBe(1);
		});
	}

	test('Any auth flow | approved app destination → passed through unchanged', async ({ page }) => {
		await page.goto(withDestination('/login', appDestination));
		await fillLogin(page);
		await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({ status: 401, json: { message: 'stop' } }));
		const request = page.waitForRequest('**/api/auth/sign-in/email');
		await loginButton(page).click();
		expect((await request).postDataJSON()).toMatchObject({ callbackURL: appDestination });
	});

	for (const unsafe of ['https://evil.example/phish', '//evil.example', 'javascript:alert(1)', 'https://bevsoft.com.evil.example/']) {
		test(`Any auth flow | unapproved destination ${unsafe} → replaced with Account`, async ({ page }) => {
			await page.goto(withDestination('/login', unsafe));
			await fillLogin(page);
			await mockEndpoint(page, '/sign-in/email', (route) => route.fulfill({ status: 401, json: { message: 'stop' } }));
			const request = page.waitForRequest('**/api/auth/sign-in/email');
			await loginButton(page).click();
			expect((await request).postDataJSON()).toMatchObject({ callbackURL: defaultDestination });
			expect(await storedDestination(page)).not.toBe(unsafe);
		});
	}
});
