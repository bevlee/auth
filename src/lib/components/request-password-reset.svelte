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

	let id = $props.id();
	let email: string = $state("");
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	let validEmail = $derived(emailRegex.test(email));

	let requestOutcome = $state("");
	let errorMessage = $state("");

	const requestPasswordReset = async (e: SubmitEvent) => {
		e.preventDefault();

		const { data, error } = await authClient.requestPasswordReset({
			email: email,
			redirectTo: "/reset-password",
		});

		if (error) {
			requestOutcome = "error";
			errorMessage = error.message ?? "";
		}
		if (data?.status) {
			requestOutcome = "success";
		}
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Reset Password</Card.Title>
		<Card.Description
			>Enter your email below to reset your password</Card.Description
		>
	</Card.Header>
	<Card.Content>
		{#if requestOutcome === "success"}
			<p>
				If an account exists with that email, we have sent a reset link
			</p>
			<a
				class="text-primary underline underline-offset-4 hover:text-primary/80"
				href="/login">Go back</a
			>
		{:else if requestOutcome === "error"}
			<p>
				Error: {errorMessage}
				<br />
				Please try requesting another password reset
			</p>
		{:else if requestOutcome === ""}
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
					<Field>
						<Button
							type="submit"
							class="w-full"
							disabled={!validEmail}
							>Send password reset email</Button
						>

						<FieldDescription class="text-center">
							Don't have an account? <a href="/signup">Sign up</a>
						</FieldDescription>
						<FieldDescription class="text-center">
							Sign in to your account? <a href="/login">Sign in</a
							>
						</FieldDescription>
					</Field>
				</FieldGroup>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
