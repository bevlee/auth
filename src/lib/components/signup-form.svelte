<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import FormAlert from "$lib/components/form-alert.svelte";
	import GoogleButton from "$lib/components/google-button.svelte";
	import SignedIn from "$lib/components/signed-in.svelte";
	import { authClient } from "$lib/client";
	import { page } from "$app/state";
	import {
		clearDestination,
		destinationApp,
		resolveDestination,
		withDestination,
	} from "$lib/destination";

	const id = $props.id();
	let email = $state("");
	let password = $state("");
	let confirmPassword = $state("");

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const validEmail = $derived(emailRegex.test(email));
	const validPassword = $derived(password.length >= 8);
	const passwordsMatch = $derived(validPassword && password === confirmPassword);
	const showEmailError = $derived(email.length > 0 && !validEmail);
	const showMismatch = $derived(confirmPassword.length > 0 && password !== confirmPassword);

	const destination = resolveDestination(page.url);
	const appLabel = destinationApp(destination)?.name ?? null;

	let pending = $state(false);
	let signedIn = $state(false);
	let errorMessage = $state("");

	const signUp = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		errorMessage = "";
		// No name at signup: apps that need a display name (e.g. multiplayer)
		// ask for it later. No verification email either; users are signed in now.
		const { error } = await authClient.signUp.email({ name: "", email, password });
		if (error) {
			pending = false;
			errorMessage = error.message ?? "An error occurred, please try again.";
			return;
		}
		clearDestination();
		signedIn = true;
		window.location.href = destination;
	};
</script>

{#if signedIn}
	<SignedIn {appLabel} />
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">Create your Bevsoft account</Card.Title>
			<Card.Description>
				{appLabel
					? `You'll use it to sign in to ${appLabel} and other Bevsoft apps.`
					: "One account for every Bevsoft app."}
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={signUp}>
				<Field.Group>
					<Field.Field>
						<GoogleButton {destination} bind:errorMessage />
					</Field.Field>
					<Field.Separator>or</Field.Separator>
					{#if errorMessage}
						<FormAlert>{errorMessage}</FormAlert>
					{/if}
					<Field.Field data-invalid={showEmailError}>
						<Field.Label for="email-{id}">Email</Field.Label>
						<Input
							id="email-{id}"
							bind:value={email}
							name="email"
							type="email"
							autocomplete="email"
							placeholder="m@example.com"
							aria-invalid={showEmailError}
							required
						/>
						<Field.Error
							errors={showEmailError ? [{ message: "Enter a valid email address." }] : []}
						/>
					</Field.Field>
					<Field.Field>
						<Field.Label for="password-{id}">Password</Field.Label>
						<Input
							id="password-{id}"
							bind:value={password}
							name="password"
							type="password"
							autocomplete="new-password"
							aria-invalid={showMismatch}
							required
						/>
						<Field.Description class={validPassword ? "text-green-600 dark:text-green-500" : ""}>
							{validPassword ? "✓ At least 8 characters" : "At least 8 characters"}
						</Field.Description>
					</Field.Field>
					<Field.Field data-invalid={showMismatch}>
						<Field.Label for="confirm-password-{id}">Confirm password</Field.Label>
						<Input
							id="confirm-password-{id}"
							bind:value={confirmPassword}
							name="confirm-password"
							type="password"
							autocomplete="new-password"
							aria-invalid={showMismatch}
							required
						/>
						{#if passwordsMatch}
							<Field.Description class="text-green-600 dark:text-green-500">
								✓ Passwords match
							</Field.Description>
						{/if}
						<Field.Error errors={showMismatch ? [{ message: "Passwords don't match." }] : []} />
					</Field.Field>
					<Field.Field>
						<Button
							type="submit"
							class="w-full"
							disabled={pending || !validEmail || !passwordsMatch}
							>{pending ? "Creating account…" : "Create account"}</Button
						>
						<p class="text-center text-sm text-muted-foreground">
							Already have an account?
							<a
								class="text-foreground underline underline-offset-4"
								href={withDestination("/login", destination)}>Sign in</a
							>
						</p>
					</Field.Field>
				</Field.Group>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
