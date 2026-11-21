<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import FormAlert from "$lib/components/form-alert.svelte";
	import { authClient } from "$lib/client";
	import { goto } from "$app/navigation";
	import { toast } from "svelte-sonner";

	const id = $props.id();
	let currentPassword = $state("");
	let newPassword = $state("");
	let confirmPassword = $state("");
	let currentPasswordError = $state("");
	let errorMessage = $state("");
	let pending = $state(false);

	const validNewPassword = $derived(newPassword.length >= 8);
	const passwordsMatch = $derived(validNewPassword && newPassword === confirmPassword);
	const showMismatch = $derived(confirmPassword.length > 0 && newPassword !== confirmPassword);
	const canSubmit = $derived(currentPassword.length > 0 && passwordsMatch && !pending);

	const changePassword = async (e: SubmitEvent) => {
		e.preventDefault();
		if (pending) return;
		pending = true;
		currentPasswordError = "";
		errorMessage = "";
		const { error } = await authClient.changePassword({
			currentPassword,
			newPassword,
			revokeOtherSessions: false,
		});
		pending = false;
		if (error) {
			if (error.code === "INVALID_PASSWORD") currentPasswordError = "Incorrect password";
			else errorMessage = error.message ?? "Something went wrong. Please try again.";
			return;
		}
		toast.success("Password updated");
		await goto("/account");
	};
</script>

<Card.Root>
	<Card.Header>
		<a href="/account" class="mb-1 text-sm text-muted-foreground hover:text-foreground">← Account</a>
		<Card.Title class="text-2xl">Change password</Card.Title>
	</Card.Header>
	<Card.Content>
		<form onsubmit={changePassword}>
			<Field.Group>
				{#if errorMessage}
					<FormAlert>{errorMessage}</FormAlert>
				{/if}
				<Field.Field data-invalid={!!currentPasswordError}>
					<Field.Label for="current-password-{id}">Current password</Field.Label>
					<Input
						id="current-password-{id}"
						bind:value={currentPassword}
						oninput={() => (currentPasswordError = "")}
						name="current-password"
						type="password"
						autocomplete="current-password"
						aria-invalid={!!currentPasswordError}
						required
					/>
					<Field.Error errors={currentPasswordError ? [{ message: currentPasswordError }] : []} />
				</Field.Field>
				<Field.Field>
					<Field.Label for="new-password-{id}">New password</Field.Label>
					<Input
						id="new-password-{id}"
						bind:value={newPassword}
						name="new-password"
						type="password"
						autocomplete="new-password"
						aria-invalid={showMismatch}
						required
					/>
					<Field.Description class={validNewPassword ? "text-green-600 dark:text-green-500" : ""}>
						{validNewPassword ? "✓ At least 8 characters" : "At least 8 characters"}
					</Field.Description>
				</Field.Field>
				<Field.Field data-invalid={showMismatch}>
					<Field.Label for="confirm-password-{id}">Confirm new password</Field.Label>
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
				<Button type="submit" class="w-full" disabled={!canSubmit}>
					{pending ? "Updating password…" : "Update password"}
				</Button>
			</Field.Group>
		</form>
	</Card.Content>
</Card.Root>
