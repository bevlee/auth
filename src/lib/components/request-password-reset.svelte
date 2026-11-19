<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import {
		FieldGroup,
		Field,
		FieldLabel,
		FieldDescription,
	} from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { authClient } from "$lib/client";
	import { page } from "$app/state";
	import { destinationApp, resolveDestination, withDestination } from "$lib/destination";

	let id = $props.id();
	const destination = resolveDestination(page.url);
	const app = destinationApp(destination);
	let email: string = $state(page.url.searchParams.get("email") ?? "");
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	let validEmail = $derived(emailRegex.test(email));

	let pending = $state(false);
	let sent = $state(false);
	let errorMessage = $state("");
	let resendState: "idle" | "sending" | "sent" | "error" = $state("idle");

	const send = () =>
		authClient.requestPasswordReset({
			email,
			redirectTo: withDestination("/reset-password", destination),
		});

	const requestPasswordReset = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		errorMessage = "";
		const { error } = await send();
		pending = false;
		if (error) {
			errorMessage = `We couldn't send the reset email${error.message ? ` (${error.message})` : ""}. Please try again.`;
			return;
		}
		sent = true;
	};

	const resend = async () => {
		resendState = "sending";
		const { error } = await send();
		resendState = error ? "error" : "sent";
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">{sent ? "Check your email" : "Reset your password"}</Card.Title>
		<Card.Description>
			{#if sent}
				Open the reset link in your email, then sign in{app ? ` to return to ${app.label}` : ""}.
			{:else}
				Enter your email to reset your password{app ? ` and return to ${app.label}` : ""}.
			{/if}
		</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if sent}
			<div class="flex flex-col gap-4">
				<p>If an account exists with that email, we have sent a reset link</p>
				<Button
					variant="outline"
					disabled={resendState === "sending"}
					onclick={resend}
					>{resendState === "sending" ? "Sending…" : "Send again"}</Button
				>
				{#if resendState === "sent"}
					<p role="status" class="text-sm">We've sent another link.</p>
				{:else if resendState === "error"}
					<p role="alert" class="text-sm text-destructive">
						We couldn't send another link. Please wait a moment and try again.
					</p>
				{/if}
				<a
					class="text-primary underline underline-offset-4 hover:text-primary/80"
					href={withDestination("/login", destination)}>Back to sign in</a
				>
			</div>
		{:else}
			<form onsubmit={requestPasswordReset}>
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
					{#if errorMessage}
						<p role="alert" class="text-sm text-destructive">{errorMessage}</p>
					{/if}
					<Field>
						<Button
							type="submit"
							class="w-full"
							disabled={pending || !validEmail}
							>{pending ? "Sending…" : "Send password reset email"}</Button
						>

						<FieldDescription class="text-center">
							Don't have an account? <a href={withDestination("/signup", destination)}
								>Sign up</a
							>
						</FieldDescription>
						<FieldDescription class="text-center">
							Sign in to your account? <a href={withDestination("/login", destination)}
								>Sign in</a
							>
						</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
