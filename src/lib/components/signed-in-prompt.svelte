<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import FormAlert from "$lib/components/form-alert.svelte";
	import { authClient } from "$lib/client";
	import { page } from "$app/state";
	import { destinationApp, resolveDestination } from "$lib/destination";

	// Accounts made without a name show their email instead
	let { name }: { name: string } = $props();

	const destination = resolveDestination(page.url);
	const app = destinationApp(destination);
	let errorMessage = $state("");

	const switchAccount = async () => {
		errorMessage = "";
		const { error } = await authClient.signOut();
		if (error) errorMessage = "We couldn't sign you out. Please try again.";
		// On success the session store clears and the page shows its form.
	};
</script>

<Card.Root>
	<Card.Header>
		<Card.Title class="text-2xl">You're signed in</Card.Title>
		<Card.Description>
			{app
				? `Continue to ${app.label}, or use a different account.`
				: "Continue where you left off, or use a different account."}
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-3">
		<Button class="w-full" href={destination}>Continue as {name}</Button>
		<Button variant="outline" class="w-full" onclick={switchAccount}>Use a different account</Button>
		{#if errorMessage}
			<FormAlert>{errorMessage}</FormAlert>
		{/if}
	</Card.Content>
</Card.Root>
