<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { page } from "$app/state";
	import { authClient } from "$lib/client";
	import { toast } from "svelte-sonner";

	let { form }: { form?: { success?: boolean; error?: string } | null } =
		$props();
	let id = $props.id();

	let password: string = $state("");
	let confirmPassword: string = $state("");

	let validPassword = $derived(password.length >= 8);
	let passwordsMatch = $derived(
		password.length >= 8 &&
			confirmPassword.length >= 8 &&
			password === confirmPassword,
	);
	let hasError = $derived(!passwordsMatch || !validPassword);

	const error = page.url.searchParams.get("error");
	const token = page.url.searchParams.get("token") ?? "";

	let pageError = $derived(error || !token);

	let requestOutcome = $state("");

	const resetPassword = async (e: SubmitEvent) => {
		e.preventDefault();

		const { data, error } = await authClient.resetPassword({
			newPassword: password,
			token: token,
		});

		if (error) {
			toast("Error resetting password, please try again");
		}
		if (data?.status) {
			requestOutcome = "success";
		}
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Reset Password</Card.Title>
		<Card.Description>Please set your new password</Card.Description>
	</Card.Header>
	<Card.Content>
		{#if pageError}
			<p>
				Invalid Password Reset request. <br /><br />Please try the
				password reset request again:
				<a
					class="text-primary underline underline-offset-4 hover:text-primary/80"
					href="/request-password-reset">password reset</a
				>
			</p>
		{:else if requestOutcome === "success"}
			<p>
				Password changed successfully, please login using your new
				password
			</p>
			<a
				class="text-primary underline underline-offset-4 hover:text-primary/80"
				href="/login">Login</a
			>
		{:else}
			<form onsubmit={resetPassword}>
				<Field.Field>
					<Field.Label for="password">Password</Field.Label>
					<Input
						id="password"
						bind:value={password}
						name="password"
						type="password"
						required
						aria-invalid={(confirmPassword.length > 0 &&
							password.length === 0) ||
							(confirmPassword.length > 0 &&
								password.length > 0 &&
								!passwordsMatch)}
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
				<Field.Field>
					<Field.Label for="confirm-password"
						>Confirm Password</Field.Label
					>
					<Input
						id="confirm-password"
						bind:value={confirmPassword}
						name="confirm-password"
						type="password"
						required
						aria-invalid={(confirmPassword.length > 0 &&
							password.length === 0) ||
							(confirmPassword.length > 0 &&
								password.length > 0 &&
								!passwordsMatch)}
					/>
					<Field.Description
						class={passwordsMatch
							? "text-green-600 dark:text-green-500"
							: undefined}
					>
						Please confirm your password. {passwordsMatch
							? "correct"
							: ""}
					</Field.Description>
				</Field.Field>
				<Field.Group>
					<Field.Field>
						<Button type="submit" disabled={hasError}
							>Change password</Button
						>
					</Field.Field>
				</Field.Group>
			</form>
		{/if}
	</Card.Content>
</Card.Root>
