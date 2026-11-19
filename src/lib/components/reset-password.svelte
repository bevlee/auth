<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { page } from "$app/state";
	import { authClient } from "$lib/client";
	import { destinationApp, resolveDestination, withDestination } from "$lib/destination";

	let password: string = $state("");
	let confirmPassword: string = $state("");

	let validPassword = $derived(password.length >= 8);
	let passwordsMatch = $derived(
		password.length >= 8 &&
			confirmPassword.length >= 8 &&
			password === confirmPassword,
	);
	let showMismatch = $derived(
		confirmPassword.length > 0 && password !== confirmPassword,
	);
	let hasError = $derived(!passwordsMatch || !validPassword);

	const destination = resolveDestination(page.url);
	const app = destinationApp(destination);
	const token = page.url.searchParams.get("token") ?? "";

	// The link is unusable if Better Auth flagged it, it has no token, or the
	// server rejects the token on submit (expired or already used).
	let linkInvalid = $state(!!page.url.searchParams.get("error") || !token);
	let pending = $state(false);
	let updated = $state(false);
	let errorMessage = $state("");

	const resetPassword = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		errorMessage = "";
		const { error } = await authClient.resetPassword({
			newPassword: password,
			token,
		});
		pending = false;
		if (error) {
			if (error.code === "INVALID_TOKEN") {
				linkInvalid = true;
			} else {
				errorMessage =
					error.message ?? "Something went wrong. Please try again.";
			}
			return;
		}
		updated = true;
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	{#if updated}
		<Card.Header>
			<Card.Title><h1 class="text-2xl">Password updated</h1></Card.Title>
			<Card.Description>Sign in with your new password{app ? ` to return to ${app.label}` : " to continue"}.</Card.Description>
		</Card.Header>
		<Card.Content>
			<Button
				class="w-full"
				href={withDestination("/login", destination, { reset: "success" })}
				>{app ? `Sign in and return to ${app.name}` : "Sign in"}</Button
			>
		</Card.Content>
	{:else if linkInvalid}
		<Card.Header>
			<Card.Title class="text-2xl">Reset your password</Card.Title>
		</Card.Header>
		<Card.Content class="flex flex-col gap-4">
			<p>
				Invalid Password Reset request. This link has expired or has already
				been used.
			</p>
			{#if app}
				<p>Request a new link to reset your password and return to {app.label}.</p>
			{/if}
			<Button
				class="w-full"
				href={withDestination("/request-password-reset", destination)}
				>Send a new reset link</Button
			>
		</Card.Content>
	{:else}
		<Card.Header>
			<Card.Title class="text-2xl">Reset your password</Card.Title>
			<Card.Description>Choose a new password{app ? ` to return to ${app.label}` : ""}.</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={resetPassword}>
				<Field.Field>
					<Field.Label for="password">Password</Field.Label>
					<Input
						id="password"
						bind:value={password}
						name="password"
						type="password"
						required
						aria-invalid={showMismatch}
					/>
					<Field.Description
						class={validPassword
							? "text-green-600 dark:text-green-500"
							: undefined}
					>
						Must be at least 8 characters long. {validPassword
							? "correct"
							: ""}
					</Field.Description>
				</Field.Field>
				<Field.Field data-invalid={showMismatch}>
					<Field.Label for="confirm-password">Confirm Password</Field.Label>
					<Input
						id="confirm-password"
						bind:value={confirmPassword}
						name="confirm-password"
						type="password"
						required
						aria-invalid={showMismatch}
					/>
					<Field.Description
						class={passwordsMatch
							? "text-green-600 dark:text-green-500"
							: undefined}
					>
						Please confirm your password. {passwordsMatch ? "correct" : ""}
					</Field.Description>
					<Field.Error
						errors={showMismatch ? [{ message: "Passwords don't match." }] : []}
					/>
				</Field.Field>
				{#if errorMessage}
					<p role="alert" class="text-sm text-destructive">{errorMessage}</p>
				{/if}
				<Field.Group>
					<Field.Field>
						<Button type="submit" disabled={pending || hasError}
							>{pending ? "Updating password…" : "Change password"}</Button
						>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	{/if}
</Card.Root>
