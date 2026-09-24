<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
    
    let { form }: { form?: { success: boolean } | null } = $props();
    let id = $props.id()
	
	let password: string = $state("");
	let confirmPassword: string = $state("");

	let validPassword = $derived(password.length >= 8)
	let passwordsMatch = $derived(password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword)
	let hasError = $derived(!passwordsMatch || !validPassword)

</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Reset Password</Card.Title>
		<Card.Description>Please set your new password</Card.Description>
	</Card.Header>
	<Card.Content>
    {#if form?.success}
        <p> Password changed successfully, please login using your new password</p>
        <a href="/login">Login</a>
    {:else}
		<form method="POST" action="?/resetPassword">
			<Field.Field>
					<Field.Label for="password">Password</Field.Label>
					<Input id="password" bind:value={password} name="password" type="password" required
						aria-invalid={confirmPassword.length > 0 && password.length ===0 || confirmPassword.length > 0 && password.length > 0 && !passwordsMatch } />
					<Field.Description class={validPassword ? "text-green-600 dark:text-green-500" : undefined}>
						Must be at least 8 characters long. {validPassword ? "correct" : ""}
					</Field.Description>
				</Field.Field>
				<Field.Field>
					<Field.Label for="confirm-password">Confirm Password</Field.Label>
					<Input id="confirm-password" bind:value={confirmPassword} name="confirm-password" type="password" required aria-invalid={confirmPassword.length > 0 && password.length ===0 || confirmPassword.length > 0 && password.length > 0 && !passwordsMatch }/>
					<Field.Description class={passwordsMatch ? "text-green-600 dark:text-green-500" : undefined}>
						Please confirm your password. {passwordsMatch ? "correct" : ""}
					</Field.Description>
				</Field.Field>
				<Field.Group>
					<Field.Field>
						<Button type="submit" disabled={hasError}>Change password</Button>
					</Field.Field>
				</Field.Group>
		</form>
    {/if}
	</Card.Content>
</Card.Root>
