<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { FieldGroup, Field, FieldLabel, FieldDescription } from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
    
    let { form }: { form?: { success: boolean } | null } = $props();
    let id = $props.id()
	let email: string = $state("")
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	let validEmail = $derived(emailRegex.test(email))

</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">Reset Password</Card.Title>
		<Card.Description>Enter your email below to reset your password</Card.Description>
	</Card.Header>
	<Card.Content>
    {#if form?.success}
        <p> If an account exists with that email, we have sent a reset link</p>
        <a href="/login">Go back</a>
    {:else}
		<form method="POST" action="?/resetPassword">
			<FieldGroup>
				<Field>
					<FieldLabel for="email-{id}">Email</FieldLabel>
					<Input id="email-{id}" bind:value={email} name="email" type="email" placeholder="m@example.com" required />
				</Field>
				<Field>
					<Button type="submit" class="w-full" 
						disabled={!validEmail}>Send password reset email</Button>

					<FieldDescription class="text-center">
						Don't have an account? <a href="/signup">Sign up</a>
					</FieldDescription>
					<FieldDescription class="text-center">
						Sign in to your account? <a href="/login">Sign in</a>
					</FieldDescription>
				</Field>
			</FieldGroup>
		</form>
    {/if}
	</Card.Content>
</Card.Root>
