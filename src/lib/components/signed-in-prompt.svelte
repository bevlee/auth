<script lang="ts">
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { authClient } from "$lib/client";
	import { page } from "$app/state";
	import { destinationLabel, resolveDestination } from "$lib/destination";

	let { name }: { name: string } = $props();

	const destination = resolveDestination(page.url);
	const appLabel = destinationLabel(destination);
	let errorMessage = $state("");

	const switchAccount = async () => {
		errorMessage = "";
		const { error } = await authClient.signOut();
		if (error) errorMessage = "We couldn't sign you out. Please try again.";
		// On success the session store clears and the page shows its form.
	};
</script>

<Card.Root class="mx-auto w-full max-w-sm">
	<Card.Header>
		<Card.Title class="text-2xl">You're signed in</Card.Title>
		<Card.Description>
			{appLabel
				? `Continue to ${appLabel}, or use a different account.`
				: "Continue where you left off, or use a different account."}
		</Card.Description>
	</Card.Header>
	<Card.Content class="flex flex-col gap-3">
		<Button class="w-full" href={destination}>Continue as {name}</Button>
		<Button variant="outline" class="w-full" onclick={switchAccount}
			>Use a different account</Button
		>
		{#if errorMessage}
			<p role="alert" class="text-sm text-destructive">{errorMessage}</p>
		{/if}
	</Card.Content>
</Card.Root>
