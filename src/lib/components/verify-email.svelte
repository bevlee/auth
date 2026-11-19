<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Field, FieldLabel } from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { authClient } from "$lib/client";
	import { page } from "$app/state";
	import {
		resolveDestination,
		verificationCallback,
		withDestination,
	} from "$lib/destination";

	// Verification links land here (see verificationCallback). Better Auth adds
	// `?error=` when the link is expired or invalid; otherwise the user is
	// verified and signed in, so forward them to their destination.
	const destination = resolveDestination(page.url);
	const error = page.url.searchParams.get("error");

	let email = $state("");
	let resendState: "idle" | "sending" | "sent" | "error" = $state("idle");
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	$effect(() => {
		if (!error) window.location.replace(destination);
	});

	const resend = async (e: SubmitEvent) => {
		e.preventDefault();
		resendState = "sending";
		const { error } = await authClient.sendVerificationEmail({
			email,
			callbackURL: verificationCallback(destination),
		});
		resendState = error ? "error" : "sent";
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	{#if error}
		<Card.Header>
			<Card.Title class="text-2xl">Verification link can't be used</Card.Title>
			<Card.Description>
				This link has expired or is invalid. Enter your email and we'll send a
				new one.
			</Card.Description>
		</Card.Header>
		<Card.Content>
			<form class="flex flex-col gap-4" onsubmit={resend}>
				<Field>
					<FieldLabel for="verify-email">Email</FieldLabel>
					<Input id="verify-email" type="email" bind:value={email} required />
				</Field>
				<Button
					type="submit"
					disabled={resendState === "sending" || !emailRegex.test(email)}
					>{resendState === "sending"
						? "Sending…"
						: "Send a new verification email"}</Button
				>
				{#if resendState === "sent"}
					<p role="status" class="text-sm">
						We've sent another verification email. Check your inbox.
					</p>
				{:else if resendState === "error"}
					<p role="alert" class="text-sm text-destructive">
						We couldn't send the email. Please wait a moment and try again.
					</p>
				{/if}
				<a
					class="text-sm text-primary underline underline-offset-4"
					href={withDestination("/login", destination)}>Back to sign in</a
				>
			</form>
		</Card.Content>
	{:else}
		<Card.Header>
			<Card.Title class="text-2xl">Email verified</Card.Title>
			<Card.Description>Taking you back…</Card.Description>
		</Card.Header>
	{/if}
</Card.Root>
