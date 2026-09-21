<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Field from "$lib/components/ui/field/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { authClient } from "$lib/client";
	import type { ComponentProps } from "svelte";

	let { ...restProps }: ComponentProps<typeof Card.Root> = $props();

	let password: string = $state("");
	let confirmPassword: string = $state("");
	let email: string = $state("")
	let name: string = $state("")
	const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
	let validName = $derived(name.length > 1)
	let validEmail = $derived(emailRegex.test(email))
	let validPassword = $derived(password.length >= 8)
	let passwordsMatch = $derived(password.length >= 8 && confirmPassword.length > 8 && password === confirmPassword)
	let hasError = $derived(!passwordsMatch || !validName || !validEmail || !validPassword)
</script>

<Card.Root {...restProps}>
	<Card.Header>
		<Card.Title>Create an account</Card.Title>
		<Card.Description>Enter your information below to create your account</Card.Description>
	</Card.Header>
	<Card.Content>
		<form method="POST" action="?/signup">
			<Field.Group>
				<Field.Field>
					<Field.Label for="name">Name</Field.Label>
					<Input id="name" bind:value={name} name="name" type="text" placeholder="John Doe" required />
				</Field.Field>
				<Field.Field data-invalid={email.length > 0 && !validEmail}>
					<Field.Label for="email">Email</Field.Label>
					<Input
						id="email"
						bind:value={email}
						name="email"
						type="email"
						placeholder="m@example.com"
						aria-invalid={email.length > 0 && !validEmail}
						required
					/>
					<Field.Description>
						We'll use this to contact you. We will not share your email with anyone else.
					</Field.Description>
					<Field.Error
						errors={email.length > 0 && !validEmail ? [{ message: "Enter a valid email address." }] : []}
					/>
				</Field.Field>
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
						<Button type="submit" disabled={hasError}>Create Account</Button>
						<Button
							variant="outline"
							type="button"
							onclick={async () => {
								await authClient.signIn.social({
									provider: "google"
								});
							}}
						>
							Sign up with Google
						</Button>
						<Field.Description class="px-6 text-center">
							Already have an account? <a href="/login">Sign in</a>
						</Field.Description>
					</Field.Field>
				</Field.Group>
			</Field.Group>
		</form>
	</Card.Content>
</Card.Root>
