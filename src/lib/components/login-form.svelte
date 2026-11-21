<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Field, FieldGroup, FieldLabel, FieldSeparator } from "$lib/components/ui/field/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import FormAlert from "$lib/components/form-alert.svelte";
	import GoogleButton from "$lib/components/google-button.svelte";
	import SignedIn from "$lib/components/signed-in.svelte";
	import { authClient } from "$lib/client";
	import {
		clearDestination,
		destinationLabel,
		resolveDestination,
		withDestination,
	} from "$lib/destination";
	import { page } from "$app/state";

	const id = $props.id();
	let email = $state("");
	let password = $state("");
	let pending = $state(false);
	let signedIn = $state(false);
	let errorMessage = $state("");

	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const validEmail = $derived(emailRegex.test(email));
	const validPassword = $derived(password.length > 0);

	const destination = resolveDestination(page.url);
	const appLabel = destinationLabel(destination);
	const passwordWasReset = page.url.searchParams.get("reset") === "success";
	// Google sign-in that was cancelled or refused comes back with ?error=
	const socialError = page.url.searchParams.get("error");

	const forgotHref = $derived(
		withDestination("/request-password-reset", destination, validEmail ? { email } : {}),
	);

	const login = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		errorMessage = "";
		const { error } = await authClient.signIn.email({ email, password, callbackURL: destination });
		if (error) {
			pending = false;
			errorMessage = error.message ?? "Unable to sign in. Please try again.";
			return;
		}
		// Better Auth is now redirecting to the destination.
		clearDestination();
		signedIn = true;
	};
</script>

{#if signedIn}
	<SignedIn {appLabel} />
{:else}
	<Card.Root>
		<Card.Header>
			<Card.Title class="text-2xl">
				{appLabel ? `Sign in to continue to ${appLabel}` : "Sign in to Bevsoft"}
			</Card.Title>
			<Card.Description>
				Use your Bevsoft account. One account works for all Bevsoft apps.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form onsubmit={login}>
				<FieldGroup>
					{#if passwordWasReset}
						<FormAlert tone="success">Password updated. Sign in with your new password.</FormAlert>
					{/if}
					{#if socialError === "account_not_linked"}
						<FormAlert>
							An account with this email already exists. Sign in with your password instead.
						</FormAlert>
					{:else if socialError}
						<FormAlert>We couldn't sign you in with Google. Please try again.</FormAlert>
					{/if}
					<Field>
						<GoogleButton {destination} bind:errorMessage />
					</Field>
					<FieldSeparator>or</FieldSeparator>
					{#if errorMessage}
						<FormAlert>{errorMessage}</FormAlert>
					{/if}
					<Field>
						<FieldLabel for="email-{id}">Email</FieldLabel>
						<Input
							id="email-{id}"
							bind:value={email}
							name="email"
							type="email"
							autocomplete="email"
							placeholder="m@example.com"
							required
						/>
					</Field>
					<Field>
						<FieldLabel for="password-{id}">Password</FieldLabel>
						<Input
							id="password-{id}"
							bind:value={password}
							name="password"
							type="password"
							autocomplete="current-password"
							aria-invalid={!!errorMessage}
							required
						/>
						<a href={forgotHref} class="ms-auto inline-block text-sm underline underline-offset-4">
							Forgot password?
						</a>
					</Field>
					<Field>
						<Button
							type="submit"
							class="w-full"
							disabled={pending || !validEmail || !validPassword}
							>{pending ? "Signing in…" : "Sign in"}</Button
						>
						<p class="text-center text-sm text-muted-foreground">
							New to Bevsoft?
							<a
								class="text-foreground underline underline-offset-4"
								href={withDestination("/signup", destination)}>Create an account</a
							>
						</p>
					</Field>
				</FieldGroup>
			</form>
		</Card.Content>
	</Card.Root>
{/if}
