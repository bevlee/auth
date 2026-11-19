<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from "$lib/components/ui/field/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { authClient } from "$lib/client";
	import {
		clearDestination,
		destinationApp,
		resolveDestination,
		withDestination,
	} from "$lib/destination";

	import { page } from "$app/state";
	const id = $props.id();
	let email = $state("");
	let password = $state("");
	let pending = $state(false);
	let errorMessage = $state("");

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	let validEmail = $derived(emailRegex.test(email));
	let validPassword = $derived(password.length > 0);

	const destination = resolveDestination(page.url);
	const app = destinationApp(destination);
	const passwordWasReset = page.url.searchParams.get("reset") === "success";
	const socialError = page.url.searchParams.get("error");

	let forgotHref = $derived(
		withDestination(
			"/request-password-reset",
			destination,
			validEmail ? { email } : {},
		),
	);

	const login = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		errorMessage = "";
		const { error } = await authClient.signIn.email({
			email,
			password,
			callbackURL: destination,
		});
		if (error) {
			pending = false;
			errorMessage = error.message ?? "Unable to sign in. Please try again.";
			return;
		}
		// Better Auth now redirects to the destination; keep the button disabled.
		clearDestination();
	};

	const signInWithGoogle = async () => {
		errorMessage = "";
		const { error } = await authClient.signIn.social({
			provider: "google",
			callbackURL: destination,
			errorCallbackURL: withDestination("/login", destination),
		});
		if (error) {
			errorMessage = "We couldn't start Google sign-in. Please try again.";
		}
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Login</Card.Title>
		<Card.Description>
			{#if app}
				Sign in to continue to {app.label}
			{:else}
				Enter your email below to login to your account
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if passwordWasReset}
			<p role="status" class="mb-4 text-sm text-green-600 dark:text-green-500">
				Password updated. Sign in with your new password{app ? ` to return to ${app.name}` : ""}.
			</p>
		{/if}
		{#if socialError}
			<p role="alert" class="mb-4 text-sm text-destructive">
				We couldn't sign you in with Google. Please try again.
			</p>
		{/if}
		<form onsubmit={login}>
			<FieldGroup>
				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input
						id="email-{id}"
						bind:value={email}
						name="email"
						type="email"
						placeholder="m@example.com"
						required
					/>
				</Field>
				<Field>
					<div class="flex items-center">
						<FieldLabel for="password-{id}">Password</FieldLabel>
					</div>
					<Input
						id="password-{id}"
						bind:value={password}
						name="password"
						type="password"
						required
					/>
					<a href={forgotHref} class="ms-auto inline-block text-sm underline">
						Forgot your password?
					</a>
				</Field>
				{#if errorMessage}
					<p role="alert" class="text-sm text-destructive">{errorMessage}</p>
				{/if}
				<Field>
					<Button
						type="submit"
						class="w-full"
						disabled={pending || !validEmail || !validPassword}
						>{pending ? "Signing in…" : "Login"}</Button
					>

					<Button
						variant="outline"
						type="button"
						class="w-full"
						onclick={signInWithGoogle}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
							<path
								d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
								fill="currentColor"
							/>
						</svg>
						Login with Google
					</Button>
					<FieldDescription class="text-center">
						Don't have an account? <a href={withDestination("/signup", destination)}
							>Sign up</a
						>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
	</Card.Content>
</Card.Root>
